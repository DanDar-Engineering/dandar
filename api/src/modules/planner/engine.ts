import { randomUUID } from "node:crypto";
import type { Block, Task, Preferences, Energy } from "./contract.ts";

export type Window = { start: string; end: string };
export const overlaps = (a: Window, b: Window) =>
  Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
const formatters = new Map<string, Intl.DateTimeFormat>();
export const dayKey = (date: string, timeZone: string) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    if (formatters.size >= 16) formatters.clear();
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter.format(new Date(date));
};
export const energyProfile = (energy: Energy = "normal", focus: 25 | 45 = 25) =>
  energy === "low"
    ? { focus: 25, rest: 10 }
    : energy === "high"
      ? { focus: 45, rest: 10 }
      : { focus, rest: focus === 25 ? 5 : 10 };
export const blockRest = (block: Block, prefs: Preferences) =>
  block.breakMinutes ?? (prefs.focus === 25 ? 5 : 10);
export type ScheduleOptions = { breakMinutes?: number; dailyCaps?: Record<string, number> };
export const duration = (b: Window) => (Date.parse(b.end) - Date.parse(b.start)) / 60000;
export function schedule(
  tasks: Task[],
  existing: Block[],
  windows: Window[],
  prefs: Preferences,
  order: string[] = [],
  now = Date.now(),
  options: ScheduleOptions = {},
) {
  const blocks: Block[] = [];
  const warnings: string[] = [];
  const unscheduled: { taskId: string; minutes: number }[] = [];
  const active = existing.filter((b) => b.status !== "missed");
  const ranked = tasks
    .filter((t) => t.status !== "completed")
    .sort(
      (a, b) =>
        (order.indexOf(a.id) < 0 ? 999 : order.indexOf(a.id)) -
          (order.indexOf(b.id) < 0 ? 999 : order.indexOf(b.id)) ||
        Date.parse(a.deadline) - Date.parse(b.deadline) ||
        b.priority - a.priority ||
        (prefs.energy === "low"
          ? a.minutes - b.minutes
          : prefs.energy === "high"
            ? b.minutes - a.minutes
            : 0),
    );
  const profile = energyProfile(prefs.energy, prefs.focus);
  const rest = Math.max(profile.rest, options.breakMinutes ?? profile.rest);
  for (const task of ranked) {
    let remaining = Math.max(
      0,
      task.minutes -
        active.filter((b) => b.taskId === task.id).reduce((sum, b) => sum + duration(b), 0),
    );
    for (const w of [...windows].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
      let cursor = Math.max(Date.parse(w.start), Math.ceil(now / 60000) * 60000);
      const end = Math.min(Date.parse(w.end), Date.parse(task.deadline));
      while (remaining > 0 && cursor < end) {
        const minutes = Math.min(profile.focus, remaining);
        const candidate: Block = {
          id: randomUUID(),
          taskId: task.id,
          start: new Date(cursor).toISOString(),
          end: new Date(cursor + minutes * 60000).toISOString(),
          status: "planned",
          actualMinutes: 0,
          breakMinutes: rest,
        };
        const all = [...active, ...blocks];
        const collision = all.find(
          (b) =>
            cursor < Date.parse(b.end) + Math.max(rest, blockRest(b, prefs)) * 60000 &&
            Date.parse(candidate.end) + Math.max(rest, blockRest(b, prefs)) * 60000 >
              Date.parse(b.start),
        );
        if (collision) {
          cursor = Date.parse(collision.end) + Math.max(rest, blockRest(collision, prefs)) * 60000;
          continue;
        }
        const key = dayKey(candidate.start, prefs.timeZone);
        const used = all
          .filter((b) => dayKey(b.start, prefs.timeZone) === key)
          .reduce((sum, b) => sum + duration(b), 0);
        if (
          Date.parse(candidate.end) > end ||
          dayKey(candidate.end, prefs.timeZone) !== key ||
          used + minutes > Math.min(prefs.dailyLimit, options.dailyCaps?.[key] ?? prefs.dailyLimit)
        ) {
          cursor += 60000;
          continue;
        }
        blocks.push(candidate);
        remaining -= minutes;
        cursor = Date.parse(candidate.end) + rest * 60000;
      }
    }
    if (remaining > 0) {
      unscheduled.push({ taskId: task.id, minutes: remaining });
      warnings.push(
        `${task.title}: ${remaining} минут багтсангүй. Сул цаг нэмэх эсвэл хугацаагаа өөрчилнө үү.`,
      );
    }
  }
  return { blocks, warnings, unscheduled };
}
