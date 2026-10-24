import test from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, buildQuiz, dailyActivity, dueForecast, isCorrectChoice } from "./learning.ts";

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const card = (id: string, deck: string, back: string) => ({ id, deck, front: `Q ${id}`, back });

test("buildQuiz: right answer among unique choices, same deck first", () => {
  const cards = [
    card("a", "Хими", "ус"),
    card("b", "Хими", "давс"),
    card("c", "Хими", "Ус "),
    card("d", "Хими", "хүчил"),
    card("e", "Физик", "v = s / t"),
  ];
  const [q] = buildQuiz(cards, 1, seeded(7));
  assert.ok(q);
  assert.equal(q.cardId, "a");
  assert.equal(q.choices.length, 4);
  assert.ok(q.choices.includes("ус"));
  assert.equal(new Set(q.choices.map((c) => c.trim().toLowerCase())).size, 4);
  assert.ok(q.choices.includes("давс") && q.choices.includes("хүчил"));
});

test("buildQuiz: borrows from other decks, skips cards with no wrong choice, honours size", () => {
  assert.deepEqual(buildQuiz([card("a", "X", "1")], 5), []);
  const two = buildQuiz([card("a", "X", "1"), card("b", "Y", "2")], 5, seeded(3));
  assert.equal(two.length, 2);
  assert.equal(two[0]?.choices.length, 2);
  const many = Array.from({ length: 30 }, (_, i) => card(String(i), "D", `ans ${i}`));
  assert.equal(buildQuiz(many, 10, seeded(1)).length, 10);
});

test("isCorrectChoice ignores case and outer spaces", () => {
  assert.equal(isCorrectChoice(" Ус ", "ус"), true);
  assert.equal(isCorrectChoice("давс", "ус"), false);
});

// 2026-03-02 12:00 Ulaanbaatar = 04:00 UTC.
const NOW = Date.UTC(2026, 2, 2, 4);
const UB = 480;

test("dailyActivity: last 7 local days, oldest first, remembered = know/easy", () => {
  const days = dailyActivity(
    [
      { at: NOW, grade: "know" },
      { at: NOW - 1000, grade: "forgot" },
      { at: NOW - 2 * DAY_MS, grade: "easy" },
      { at: NOW - 10 * DAY_MS, grade: "know" },
    ],
    NOW,
    UB,
  );
  assert.equal(days.length, 7);
  assert.equal(days[6]?.date, "2026-03-02");
  assert.equal(days[0]?.date, "2026-02-24");
  assert.deepEqual(days[6], { date: "2026-03-02", reviewed: 2, remembered: 1 });
  assert.deepEqual(days[4], { date: "2026-02-28", reviewed: 1, remembered: 1 });
  assert.equal(days.filter((d) => d.reviewed > 0).length, 2);
});

test("dueForecast: overdue counts today, later days by local date, beyond range dropped", () => {
  const f = dueForecast([NOW - DAY_MS, NOW + 3600_000, NOW + DAY_MS, NOW + 20 * DAY_MS], NOW, UB);
  assert.equal(f.length, 7);
  assert.equal(f[0]?.date, "2026-03-02");
  assert.equal(f[0]?.due, 2);
  assert.equal(f[1]?.due, 1);
  assert.equal(
    f.reduce((s, d) => s + d.due, 0),
    3,
  );
});
