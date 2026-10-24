import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, overlaps, duration } from "./engine.ts";
import type { Task, Preferences, Block } from "./contract.ts";
const prefs: Preferences = {
  enabled: true,
  quietStart: 22,
  quietEnd: 7,
  timeZone: "UTC",
  focus: 25,
  dailyLimit: 180,
};
const now = Date.parse("2030-01-01T08:00:00Z");
const task: Task = {
  id: "a",
  title: "Exam",
  subject: "Math",
  deadline: "2030-01-02T17:00:00Z",
  minutes: 100,
  priority: 3,
  status: "todo",
  reminders: [60],
};
const windows = [{ start: "2030-01-01T09:00:00Z", end: "2030-01-01T12:00:00Z" }];
test("splits work with required breaks and never crosses deadline", () => {
  const result = schedule([task], [], windows, prefs, [], now);
  assert.equal(result.blocks.length, 4);
  assert.equal(result.warnings.length, 0);
  for (let i = 0; i < result.blocks.length; i++) {
    const b = result.blocks[i]!;
    assert.equal(duration(b), 25);
    assert.ok(Date.parse(b.end) <= Date.parse(task.deadline));
    if (i) assert.ok(Date.parse(b.start) - Date.parse(result.blocks[i - 1]!.end) >= 300000);
  }
});
test("existing sessions are counted and cannot be duplicated", () => {
  const first = schedule([task], [], windows, prefs, [], now);
  assert.equal(schedule([task], first.blocks, windows, prefs, [], now).blocks.length, 0);
});
test("overload warns and distributes examination work across days", () => {
  const limit = { ...prefs, dailyLimit: 50 };
  const one = schedule([task], [], windows, limit, [], now);
  assert.equal(one.blocks.length, 2);
  assert.equal(one.warnings.length, 1);
  const two = schedule(
    [task],
    [],
    [...windows, { start: "2030-01-02T09:00:00Z", end: "2030-01-02T12:00:00Z" }],
    limit,
    [],
    now,
  );
  assert.equal(two.blocks.length, 4);
  assert.equal(two.warnings.length, 0);
});
test("missed blocks are rescheduled; completed effort remains credited", () => {
  const b: Block = {
    id: "old",
    taskId: "a",
    start: windows[0]!.start,
    end: "2030-01-01T09:25:00Z",
    status: "missed",
    actualMinutes: 0,
  };
  const result = schedule([task], [b], windows, prefs, [], now);
  assert.equal(result.blocks.length, 4);
  assert.equal(
    schedule([{ ...task, status: "completed" }], [b], windows, prefs, [], now).blocks.length,
    0,
  );
});
test("overlapping free windows do not duplicate sessions", () => {
  const result = schedule([task], [], [...windows, ...windows], prefs, [], now);
  assert.equal(result.blocks.length, 4);
  result.blocks.forEach((a, i) =>
    result.blocks.slice(i + 1).forEach((b) => assert.equal(overlaps(a, b), false)),
  );
});
test("past deadlines cannot produce sessions; 45/10 mode respects longer breaks", () => {
  assert.equal(
    schedule([{ ...task, deadline: "2029-12-31T00:00:00Z" }], [], windows, prefs, [], now).blocks
      .length,
    0,
  );
  const r = schedule([{ ...task, minutes: 90 }], [], windows, { ...prefs, focus: 45 }, [], now);
  assert.equal(r.blocks.length, 2);
  assert.equal(Date.parse(r.blocks[1]!.start) - Date.parse(r.blocks[0]!.end), 600000);
});
