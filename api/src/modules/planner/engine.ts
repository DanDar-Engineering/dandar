import { randomUUID } from "node:crypto";
import type { Block, Task, Preferences } from "./contract.ts";

export type Window = { start: string; end: string };
export const overlaps = (a: Window, b: Window) =>
  Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
export const dayKey = (date: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
export const duration = (b: Window) => (Date.parse(b.end) - Date.parse(b.start)) / 60000;
export function schedule(
  tasks: Task[],
  existing: Block[],
  windows: Window[],
  prefs: Preferences,
  order: string[] = [],
  now = Date.now(),
) {
  const blocks: Block[] = [];
  const warnings: string[] = [];
  const active = existing.filter((b) => b.status !== "missed");
  const ranked = tasks
    .filter((t) => t.status !== "completed")
    .sort(
      (a, b) =>
        (order.indexOf(a.id) < 0 ? 999 : order.indexOf(a.id)) -
          (order.indexOf(b.id) < 0 ? 999 : order.indexOf(b.id)) ||
        Date.parse(a.deadline) - Date.parse(b.deadline) ||
        b.priority - a.priority,
    );
  const rest = prefs.focus === 25 ? 5 : 10;
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
        const minutes = Math.min(prefs.focus, remaining);
        const candidate: Block = {
          id: randomUUID(),
          taskId: task.id,
          start: new Date(cursor).toISOString(),
          end: new Date(cursor + minutes * 60000).toISOString(),
          status: "planned",
          actualMinutes: 0,
        };
        const all = [...active, ...blocks];
        const collision = all.find(
          (b) =>
            cursor < Date.parse(b.end) + rest * 60000 &&
            Date.parse(candidate.end) + rest * 60000 > Date.parse(b.start),
        );
        if (collision) {
          cursor = Date.parse(collision.end) + rest * 60000;
          continue;
        }
        const key = dayKey(candidate.start, prefs.timeZone);
        const used = all
          .filter((b) => dayKey(b.start, prefs.timeZone) === key)
          .reduce((sum, b) => sum + duration(b), 0);
        if (
          Date.parse(candidate.end) > end ||
          dayKey(candidate.end, prefs.timeZone) !== key ||
          used + minutes > prefs.dailyLimit
        ) {
          cursor += 60000;
          continue;
        }
        blocks.push(candidate);
        remaining -= minutes;
        cursor = Date.parse(candidate.end) + rest * 60000;
      }
    }
    if (remaining > 0)
      warnings.push(
        `${task.title}: ${remaining} минут багтсангүй. Сул цаг нэмэх эсвэл хугацаагаа өөрчилнө үү.`,
      );
  }
  return { blocks, warnings };
}
