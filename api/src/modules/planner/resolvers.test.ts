import { test } from "node:test";
import assert from "node:assert/strict";
import type { Context } from "../../connectionResolvers.ts";
import type { PlannerState } from "./contract.ts";
import { plannerQueries, plannerMutations } from "./resolvers.ts";

const fixture = () => {
  const records = new Map<string, PlannerState>();
  const permissions: string[] = [];
  const Planner = {
    findOneAndUpdate: (
      query: { userId: string; version?: number },
      update: { $set?: Partial<PlannerState>; $inc?: { version: number } },
    ) => ({
      lean: async () => {
        let state = records.get(query.userId);
        if (!state) {
          state = {
            userId: query.userId,
            version: 0,
            tasks: [],
            blocks: [],
            delivered: [],
            preferences: {
              enabled: true,
              quietStart: 0,
              quietEnd: 0,
              timeZone: "UTC",
              focus: 25,
              dailyLimit: 180,
            },
          };
          records.set(query.userId, state);
        }
        if (query.version !== undefined && query.version !== state.version) return null;
        if (update.$set) Object.assign(state, structuredClone(update.$set));
        if (update.$inc) state.version += update.$inc.version;
        return structuredClone(state);
      },
    }),
  };
  const context = (id: string): Context =>
    ({
      user: { _id: id },
      subdomain: "school",
      models: { Planner },
      checkPermission: async (action: string) => {
        permissions.push(action);
      },
    }) as unknown as Context;
  return { context, permissions };
};
const task = (deadline = new Date(Date.now() + 86400000).toISOString()) => ({
  id: "task1",
  title: "Math",
  subject: "Algebra",
  deadline,
  minutes: 100,
  priority: 3,
  status: "todo",
  reminders: [60],
});
const update = (context: Context, version: number, action: string, data: unknown) =>
  plannerMutations.dandarPlannerUpdate(
    null,
    { version, action, data: JSON.stringify(data) },
    context,
  );
test("planner requires authenticated tenant and checks platform permissions", async () => {
  const f = fixture();
  await assert.rejects(() => plannerQueries.dandarPlanner(null, null, f.context("")), /Login/);
  await plannerQueries.dandarPlanner(null, null, f.context("alice"));
  assert.ok(f.permissions.includes("dandarPlannerRead"));
  await update(f.context("alice"), 0, "task", task());
  assert.ok(f.permissions.includes("dandarPlannerWrite"));
});
test("users have separate snapshots and stale updates cannot overwrite", async () => {
  const f = fixture();
  await update(f.context("alice"), 0, "task", task());
  const bob = await plannerQueries.dandarPlanner(null, null, f.context("bob"));
  assert.equal((JSON.parse(bob.data) as PlannerState).tasks.length, 0);
  await assert.rejects(() => update(f.context("alice"), 0, "deleteTask", "task1"));
  const alice = await plannerQueries.dandarPlanner(null, null, f.context("alice"));
  assert.equal(alice.version, 1);
  assert.equal((JSON.parse(alice.data) as PlannerState).tasks.length, 1);
});
test("reminder claims are single-use and do not complete tasks", async () => {
  const f = fixture();
  const context = f.context("alice");
  const t = task(new Date(Date.now() + 60000).toISOString());
  await update(context, 0, "task", t);
  const id = `task1:${t.deadline}:60`;
  const claimed = await update(context, 1, "claimReminders", [id]);
  assert.equal((JSON.parse(claimed.data) as PlannerState).tasks[0]!.status, "todo");
  await assert.rejects(() => update(context, 2, "claimReminders", [id]), /already handled/);
  await update(context, 2, "preferences", {
    enabled: false,
    quietStart: 0,
    quietEnd: 0,
    timeZone: "UTC",
    focus: 25,
    dailyLimit: 180,
  });
  await assert.rejects(() => update(context, 3, "claimReminders", []), /disabled/);
});
test("confirmation revalidates overlap and cannot partially save bad proposals", async () => {
  const f = fixture();
  const context = f.context("alice");
  await update(context, 0, "task", task(new Date(Date.now() + 3 * 86400000).toISOString()));
  const start = Date.now() + 86400000;
  const block = (id: string, minutes: number) => ({
    id,
    taskId: "task1",
    start: new Date(start + minutes * 60000).toISOString(),
    end: new Date(start + (minutes + 25) * 60000).toISOString(),
    status: "planned",
    actualMinutes: 0,
  });
  await assert.rejects(
    () => update(context, 1, "confirm", [block("a", 0), block("b", 20)]),
    /conflict/,
  );
  const state = await plannerQueries.dandarPlanner(null, null, context);
  assert.equal(state.version, 1);
  assert.equal((JSON.parse(state.data) as PlannerState).blocks.length, 0);
  await update(context, 1, "confirm", [block("a", 0)]);
  await assert.rejects(
    () => update(context, 2, "block", { id: "a", status: "completed" }),
    /Start the session/,
  );
});
