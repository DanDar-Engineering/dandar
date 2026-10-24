import test from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, DEFAULT_REMINDER_SETTINGS, isQuietHour, planReminders } from "./learning.ts";

// 2026-03-02 16:10 in Ulaanbaatar (UTC+8) = 08:10 UTC.
const UB = 480;
const AT_16 = Date.UTC(2026, 2, 2, 8, 10);
const base = { tzOffsetMinutes: UB, settings: DEFAULT_REMINDER_SETTINGS, dueCount: 12, exams: [] };

test("quiet hours wrap past midnight", () => {
  assert.equal(isQuietHour(22, 21, 7), true);
  assert.equal(isQuietHour(3, 21, 7), true);
  assert.equal(isQuietHour(16, 21, 7), false);
  assert.equal(isQuietHour(16, 9, 9), false);
});

test("review reminder only at the chosen local hour, with a per-day key", () => {
  const [reminder] = planReminders({ ...base, now: AT_16 });
  assert.equal(reminder?.kind, "review");
  assert.equal(reminder?.key, "review:2026-03-02");
  assert.match(reminder?.message ?? "", /12 карт/);
  assert.deepEqual(planReminders({ ...base, now: AT_16 + 3_600_000 }), []);
});

test("nothing when nothing is due, reminders are off, or the hour is quiet", () => {
  assert.deepEqual(planReminders({ ...base, now: AT_16, dueCount: 0 }), []);
  const off = { ...DEFAULT_REMINDER_SETTINGS, reviewReminder: false };
  assert.deepEqual(planReminders({ ...base, now: AT_16, settings: off }), []);
  const quiet = { ...DEFAULT_REMINDER_SETTINGS, reminderHour: 22 };
  const at22 = AT_16 + 6 * 3_600_000;
  assert.deepEqual(planReminders({ ...base, now: at22, settings: quiet }), []);
});

test("exam alerts 7, 3 and 1 days before, and the last one asks for a light review", () => {
  const exam = (days: number) => ({
    deck: "Физик",
    examAt: AT_16 + days * DAY_MS - 3_600_000,
    readiness: 62,
  });
  for (const days of [7, 3, 1]) {
    const plans = planReminders({ ...base, now: AT_16, dueCount: 0, exams: [exam(days)] });
    assert.equal(plans.length, 1, `days ${days}`);
    assert.equal(plans[0]?.kind, "exam");
  }
  assert.match(
    planReminders({ ...base, now: AT_16, dueCount: 0, exams: [exam(1)] })[0]?.message ?? "",
    /хөнгөн/,
  );
  assert.deepEqual(planReminders({ ...base, now: AT_16, dueCount: 0, exams: [exam(5)] }), []);
});
