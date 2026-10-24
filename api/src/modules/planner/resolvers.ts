import { GraphQLError } from "graphql";
import { z } from "zod";
import type { Context } from "../../connectionResolvers.ts";
import { taskInput, preferencesInput, type PlannerState, type Block } from "./contract.ts";
import { overlaps, duration, dayKey, energyProfile, blockRest } from "./engine.ts";
import { reminderItems, dueReminders, quietHours } from "./reminders.ts";
import {
  windowsInput,
  optionsInput,
  policyInput,
  validateWindows,
  rankWithGemma,
  ruleRanking,
  makePlan,
  simulate,
} from "./planning.ts";

export const plannerTypeDefs = `
 type DandarPlanner { version: Int!, data: String! }
 type DandarPlanPreview { version: Int!, data: String!, warnings: [String!]!, model: String!, replaceIds: [String!]!, policy: String!, metrics: String! }
 type DandarSimulation { baseline: DandarPlanPreview!, scenario: DandarPlanPreview! }
 extend type Query { dandarPlanner: DandarPlanner! }
 extend type Mutation {
   dandarPlannerUpdate(version: Int!, action: String!, data: String!): DandarPlanner!
   dandarPlanPropose(windows: String!, options: String): DandarPlanPreview!
   dandarPlannerSimulate(input: String!): DandarSimulation!
 }
`;
const bad = (message: string): never => {
  throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
};
const parse = (text: string): unknown => {
  if (text.length > 100000) return bad("Input too large");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return bad("Invalid JSON");
  }
};
async function getState(context: Context, write = false) {
  if (!context.user?._id || !context.subdomain)
    throw new GraphQLError("Login and tenant required", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  await context.checkPermission(write ? "dandarPlannerWrite" : "dandarPlannerRead");
  const userId = context.user._id;
  // Unique user index makes concurrent first requests safe without cross-user access.
  try {
    return (await context.models.Planner.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true },
    ).lean())!;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return (await context.models.Planner.findOne({ userId }).lean())!;
  }
}
const output = (state: PlannerState) => ({
  version: state.version,
  data: JSON.stringify({
    tasks: state.tasks,
    blocks: state.blocks,
    preferences: state.preferences,
    delivered: state.delivered,
    dismissed: state.dismissed ?? [],
    snoozed: state.snoozed ?? [],
    reminderItems: reminderItems(state),
    availability: state.availability ?? [],
    dayLimits: state.dayLimits ?? {},
  }),
});
const blockInput = z.object({
  id: z.string().min(1).max(64),
  taskId: z.string().min(1).max(64),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  status: z.literal("planned"),
  actualMinutes: z.literal(0),
  breakMinutes: z.number().int().min(5).max(15).optional(),
});
export const plannerQueries = {
  dandarPlanner: async (_: unknown, _args: unknown, context: Context) =>
    output(await getState(context)),
};
export const plannerMutations = {
  dandarPlanPropose: async (
    _: unknown,
    { windows, options }: { windows: string; options?: string | null },
    context: Context,
  ) => {
    const state = await getState(context, true);
    const w = windowsInput.safeParse(parse(windows));
    const opts = optionsInput.safeParse(options ? parse(options) : {});
    if (!w.success || !opts.success) return bad("Invalid planning options");
    validateWindows(w.data);
    if (!state.tasks.some((t) => t.status !== "completed"))
      return bad("Add an unfinished task first");
    const energy = opts.data.energy ?? state.preferences.energy ?? "normal";
    const ranking = await rankWithGemma(state, w.data, energy);
    return makePlan(state, w.data, energy, opts.data.replacePlanned, opts.data.dailyCaps, ranking);
  },
  dandarPlannerSimulate: async (_: unknown, { input }: { input: string }, context: Context) => {
    const state = await getState(context, true);
    const schema = z.object({
      windows: windowsInput,
      options: optionsInput,
      candidate: taskInput.optional(),
    });
    const request = schema.safeParse(parse(input));
    if (!request.success) return bad("Даалгавар, сул цаг болон ачааллын тохиргоог шалгана уу.");
    const { windows, options, candidate } = request.data;
    validateWindows(windows);
    if (candidate && !state.tasks.some((t) => t.id === candidate.id) && state.tasks.length >= 100)
      return bad("Maximum 100 tasks");
    const energy = options.energy ?? state.preferences.energy ?? "normal";
    const ranking = candidate
      ? ruleRanking(state, energy)
      : await rankWithGemma(state, windows, energy);
    return simulate(state, windows, energy, options.dailyCaps, candidate, ranking);
  },
  dandarPlannerUpdate: async (
    _: unknown,
    args: { version: number; action: string; data: string },
    context: Context,
  ) => {
    const state = await getState(context, true);
    const data = parse(args.data);
    if (state.version !== args.version)
      throw new GraphQLError("Өөр табаас өөрчлөгдсөн байна. Шинэчлээд дахин оролдоно уу.", {
        extensions: { code: "CONFLICT" },
      });
    const action = args.action;
    if (action === "task") {
      const parsed = taskInput.safeParse(data);
      if (!parsed.success) return bad("Invalid task fields");
      const task = parsed.data;
      const old = state.tasks.find((t) => t.id === task.id);
      if (!old && state.tasks.length >= 100) return bad("Maximum 100 tasks");
      if (
        old &&
        state.blocks.some(
          (b) =>
            b.taskId === task.id &&
            b.status !== "missed" &&
            b.status !== "completed" &&
            Date.parse(b.end) > Date.parse(task.deadline),
        )
      )
        return bad("Move or mark conflicting sessions missed before shortening the deadline");
      state.tasks = [...state.tasks.filter((t) => t.id !== task.id), task];
      if (task.status === "completed")
        state.blocks = state.blocks.filter((b) => b.taskId !== task.id || b.status === "completed");
    } else if (action === "deleteTask") {
      const id = z.string().parse(data);
      state.tasks = state.tasks.filter((t) => t.id !== id);
      state.blocks = state.blocks.filter((b) => b.taskId !== id);
    } else if (action === "preferences") {
      const parsed = preferencesInput.safeParse(data);
      if (!parsed.success) return bad("Invalid preferences");
      try {
        new Intl.DateTimeFormat("en", { timeZone: parsed.data.timeZone }).format();
      } catch {
        return bad("Invalid timezone");
      }
      state.preferences = parsed.data;
    } else if (action === "confirm" || action === "applyPlan") {
      const applySchema = z.object({
        blocks: z.array(blockInput).max(500),
        replaceIds: z.array(z.string()).max(500),
        policy: z.string().max(20000),
        reminderId: z.string().max(200).optional(),
      });
      const applied = action === "applyPlan" ? applySchema.safeParse(data) : null;
      if (applied && !applied.success) return bad("Invalid plan confirmation");
      const request = applied?.success ? applied.data : undefined;
      const parsed = z
        .array(blockInput)
        .max(500)
        .safeParse(request?.blocks ?? data);
      if (!parsed.success) return bad("Invalid study blocks");
      const policyResult = request ? policyInput.safeParse(parse(request.policy)) : undefined;
      if (policyResult && !policyResult.success) return bad("Invalid plan constraints");
      const policy = policyResult?.success ? policyResult.data : undefined;
      if (policy) validateWindows(policy.windows);
      const replaceIds = request?.replaceIds ?? [];
      if (
        new Set(replaceIds).size !== replaceIds.length ||
        replaceIds.some((id) => !state.blocks.some((b) => b.id === id && b.status === "planned"))
      )
        return bad("Only existing planned sessions can be replaced");
      if (request?.reminderId && !reminderItems(state).some((r) => r.id === request.reminderId))
        return bad("Reminder changed; refresh and retry");
      const fixed = state.blocks.filter((b) => !replaceIds.includes(b.id));
      const prefs = { ...state.preferences, energy: policy?.energy ?? state.preferences.energy };
      const profile = energyProfile(prefs.energy, prefs.focus);
      const caps = policy?.dailyCaps ?? state.dayLimits ?? {};
      const accepted: Block[] = [];
      for (const b of parsed.data) {
        const task = state.tasks.find((t) => t.id === b.taskId && t.status !== "completed");
        const all = [...fixed.filter((x) => x.status !== "missed"), ...accepted];
        const rest = policy?.breakMinutes ?? b.breakMinutes ?? profile.rest;
        if (rest < profile.rest || (policy && b.breakMinutes !== policy.breakMinutes))
          return bad("Break is too short or differs from the preview");
        if (state.blocks.some((x) => x.id === b.id)) return bad("Duplicate session ID");
        if (
          policy &&
          !policy.windows.some(
            (w) =>
              Date.parse(b.start) >= Date.parse(w.start) && Date.parse(b.end) <= Date.parse(w.end),
          )
        )
          return bad("Session is outside the confirmed free time");
        if (
          !task ||
          Date.parse(b.start) < Date.now() ||
          duration(b) < 1 ||
          duration(b) > profile.focus ||
          Date.parse(b.end) > Date.parse(task.deadline) ||
          all.some(
            (x) =>
              x.id === b.id ||
              overlaps(
                {
                  start: new Date(
                    Date.parse(b.start) - Math.max(rest, blockRest(x, prefs)) * 60000,
                  ).toISOString(),
                  end: new Date(
                    Date.parse(b.end) + Math.max(rest, blockRest(x, prefs)) * 60000,
                  ).toISOString(),
                },
                x,
              ),
          )
        )
          return bad("Sessions conflict, are expired, or exceed the deadline/focus length");
        const key = dayKey(b.start, prefs.timeZone);
        if (
          dayKey(b.end, prefs.timeZone) !== key ||
          all
            .filter((x) => dayKey(x.start, prefs.timeZone) === key)
            .reduce((n, x) => n + duration(x), 0) +
            duration(b) >
            Math.min(prefs.dailyLimit, caps[key] ?? prefs.dailyLimit)
        )
          return bad("Daily workload exceeded");
        if (
          all.filter((x) => x.taskId === task.id).reduce((n, x) => n + duration(x), 0) +
            duration(b) >
          task.minutes
        )
          return bad("Task effort already scheduled");
        accepted.push({ ...b, breakMinutes: rest });
      }
      state.blocks = [...fixed, ...accepted];
      if (state.blocks.length > 500)
        return bad("Maximum 500 sessions; delete completed tasks to archive sessions");
      if (policy) {
        state.preferences = prefs;
        state.availability = policy.windows;
        state.dayLimits = policy.dailyCaps;
      }
      if (request?.reminderId)
        state.dismissed = [...new Set([...(state.dismissed ?? []), request.reminderId])].slice(
          -2000,
        );
    } else if (action === "block") {
      const input = z
        .object({
          id: z.string(),
          status: z.enum(["started", "completed", "missed"]),
          actualMinutes: z.number().int().min(0).max(480).default(0),
        })
        .parse(data);
      const b = state.blocks.find((x) => x.id === input.id);
      if (!b) return bad("Session missing");
      if (b.status === "completed" || b.status === "missed") return bad("Session already closed");
      if (input.status === "started" && (b.status !== "planned" || Date.now() > Date.parse(b.end)))
        return bad("Session expired or already started; mark missed and replan");
      if (
        input.status === "started" &&
        state.blocks.some((x) => x.id !== b.id && x.status === "started")
      )
        return bad("Another focus session is running");
      if (input.status === "completed" && b.status !== "started")
        return bad("Start the session first");
      if (input.status === "started") b.startedAt = new Date().toISOString();
      b.status = input.status;
      b.actualMinutes =
        input.status === "completed"
          ? Math.min(480, Math.max(0, Math.round((Date.now() - Date.parse(b.startedAt!)) / 60000)))
          : 0;
      const task = state.tasks.find((t) => t.id === b.taskId);
      if (task && input.status === "started") task.status = "started";
    } else if (action === "move") {
      const input = z.object({ id: z.string(), start: z.iso.datetime() }).parse(data);
      const b = state.blocks.find((x) => x.id === input.id && x.status === "planned");
      if (!b) return bad("Only planned sessions can move");
      const candidate = {
        ...b,
        start: input.start,
        end: new Date(Date.parse(input.start) + duration(b) * 60000).toISOString(),
      };
      const task = state.tasks.find((t) => t.id === b.taskId);
      const rest =
        Math.max(
          blockRest(b, state.preferences),
          ...state.blocks
            .filter((x) => x.status !== "missed")
            .map((x) => blockRest(x, state.preferences)),
        ) * 60000;
      const others = state.blocks.filter((x) => x.id !== b.id && x.status !== "missed");
      if (
        !task ||
        Date.parse(candidate.start) < Date.now() ||
        Date.parse(candidate.end) > Date.parse(task.deadline) ||
        others.some((x) =>
          overlaps(
            {
              start: new Date(Date.parse(candidate.start) - rest).toISOString(),
              end: new Date(Date.parse(candidate.end) + rest).toISOString(),
            },
            x,
          ),
        )
      )
        return bad("Session conflicts with another session or deadline");
      const key = dayKey(candidate.start, state.preferences.timeZone);
      if (
        dayKey(candidate.end, state.preferences.timeZone) !== key ||
        others
          .filter((x) => dayKey(x.start, state.preferences.timeZone) === key)
          .reduce((n, x) => n + duration(x), 0) +
          duration(candidate) >
          Math.min(
            state.preferences.dailyLimit,
            state.dayLimits?.[key] ?? state.preferences.dailyLimit,
          )
      )
        return bad("Daily workload exceeded");
      Object.assign(b, candidate);
    } else if (action === "claimReminders") {
      const ids = z.array(z.string().max(256)).max(100).parse(data);
      if (!state.preferences.enabled || quietHours(state))
        return bad("Notifications disabled or quiet hours active");
      const due = dueReminders(state).map((r) => r.notificationId);
      if (ids.some((id) => !due.includes(id) || state.delivered.includes(id)))
        return bad("Reminder already handled or not due");
      state.delivered = [...new Set([...state.delivered, ...ids])].slice(-2000);
    } else if (action === "dismissReminders") {
      const ids = z.array(z.string().max(200)).max(100).parse(data);
      const valid = dueReminders(state).map((r) => r.id);
      if (ids.some((id) => !valid.includes(id))) return bad("Reminder changed or is not due");
      state.dismissed = [...new Set([...(state.dismissed ?? []), ...ids])].slice(-2000);
    } else if (action === "reminderAction") {
      const input = z
        .object({ id: z.string().max(200), action: z.enum(["start", "snooze", "dismiss"]) })
        .parse(data);
      const reminder = dueReminders(state).find((r) => r.id === input.id);
      if (!reminder) return bad("Reminder changed or is not due");
      const task = state.tasks.find((t) => t.id === reminder.taskId)!;
      if (input.action === "snooze") {
        const until = new Date(Date.now() + 15 * 60000).toISOString();
        if (Date.parse(until) >= Date.parse(reminder.expiresAt))
          return bad("Сесс дуусахаас өмнө 15 минут үлдээгүй. Дахин төлөвлөхийг сонгоно уу.");
        state.snoozed = [
          ...(state.snoozed ?? []).filter((s) => s.id !== input.id),
          { id: input.id, until },
        ].slice(-1000);
      } else {
        if (input.action === "start") {
          if (state.blocks.some((b) => b.status === "started"))
            return bad("Another focus session is running");
          const b = reminder.blockId
            ? state.blocks.find((b) => b.id === reminder.blockId)
            : state.blocks
                .filter(
                  (b) =>
                    b.taskId === task.id &&
                    b.status === "planned" &&
                    Date.parse(b.end) > Date.now(),
                )
                .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
          if (b) {
            b.status = "started";
            b.startedAt = new Date().toISOString();
            b.actualMinutes = 0;
          }
          task.status = "started";
        }
        state.dismissed = [...new Set([...(state.dismissed ?? []), input.id])].slice(-2000);
      }
    } else return bad("Unknown action");
    const updated = await context.models.Planner.findOneAndUpdate(
      { userId: state.userId, version: args.version },
      {
        $set: {
          tasks: state.tasks,
          blocks: state.blocks,
          preferences: state.preferences,
          delivered: state.delivered,
          dismissed: state.dismissed ?? [],
          snoozed: state.snoozed ?? [],
          availability: state.availability ?? [],
          dayLimits: state.dayLimits ?? {},
        },
        $inc: { version: 1 },
      },
      { new: true },
    ).lean();
    if (!updated)
      throw new GraphQLError("Planner changed; refresh and retry", {
        extensions: { code: "CONFLICT" },
      });
    return output(updated);
  },
};
