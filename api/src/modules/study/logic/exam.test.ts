import test from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, TARGET_ROUNDS, applyExam, examProgress, newCard, review } from "./learning.ts";

const t0 = Date.UTC(2026, 0, 1);

test("сорилгүй бол картыг өөрчлөхгүй", () => {
  const c = review(newCard("a", "t", t0), "know", t0);
  assert.equal(applyExam(c, null, t0), c);
});

test("сорил ойр үед интервал богиносч, сорилын өмнөх өдрөөс хэтрэхгүй", () => {
  const exam = t0 + 6 * DAY_MS;
  const c = { ...review(newCard("a", "t", t0), "know", t0), dueAt: t0 + 30 * DAY_MS };
  const a = applyExam(c, exam, t0);
  assert.ok(a.dueAt < c.dueAt);
  assert.ok(a.dueAt <= exam - DAY_MS);
});

test("зорилтот давталтад хүрсэн карт сорилын өмнө ихэвчлэн хугацаагаа хадгална", () => {
  let c = newCard("a", "t", t0);
  for (let i = 0; i < TARGET_ROUNDS; i++) c = review(c, "know", t0 + i * 1000);
  assert.equal(c.reviews, TARGET_ROUNDS);
  assert.ok(applyExam(c, t0 + 400 * DAY_MS, t0).dueAt === c.dueAt);
});

test("examProgress: давталт ба бэлэн байдал өснө", () => {
  const exam = t0 + 5 * DAY_MS;
  const cards = [newCard("a", "t", t0)];
  assert.equal(examProgress(cards, exam, t0).rounds, 0);
  const done = review(cards[0]!, "easy", t0);
  const p = examProgress([done], exam, t0);
  assert.ok(p.rounds > 0 && p.readiness > 0 && p.daysLeft === 5);
});

test("the day before the exam a reviewed card does not come straight back", () => {
  const exam = t0 + 6 * DAY_MS;
  let c = newCard("a", "t", t0);
  let now = t0;
  for (let i = 0; i < 6 && now < exam; i++) {
    c = applyExam(review(c, "easy", now), exam, now);
    assert.ok(c.dueAt > now, `review ${i} at day ${(now - t0) / DAY_MS} is due again at once`);
    now = c.dueAt;
  }
});

test("exam schedule still lands at least once on the day before the exam", () => {
  const exam = t0 + 6 * DAY_MS;
  let c = newCard("a", "t", t0);
  let now = t0;
  const days: number[] = [];
  while (now < exam - DAY_MS) {
    c = applyExam(review(c, "easy", now), exam, now);
    now = c.dueAt;
    days.push((now - t0) / DAY_MS);
  }
  assert.ok(days.some((day) => day >= 5 && day < 6), `due days ${days.join(", ")}`);
});
