import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS,
  intervalForRetention,
  retrievability,
  newCard,
  review,
  capToExam,
  dueCards,
  topicMastery,
} from "./learning.ts";

const t0 = Date.UTC(2026, 0, 1);

test("retrievability: 0 хоногт 1, цаг өнгөрөх тусам буурна", () => {
  assert.equal(retrievability(0, 2), 1);
  assert.ok(retrievability(5, 2) < retrievability(1, 2));
});

test("интервал нь босго дээр R=0.9 болно", () => {
  const d = intervalForRetention(3, 0.9);
  assert.ok(Math.abs(retrievability(d, 3) - 0.9) < 1e-9);
});

test("'know' дараалан интервал ургана", () => {
  let c = newCard("a", "t", t0);
  let prev = 0,
    now = t0;
  for (let i = 0; i < 4; i++) {
    c = review(c, "know", now);
    const gap = c.dueAt - now;
    assert.ok(gap > prev);
    prev = gap;
    now = c.dueAt;
  }
});

test("'forgot' stability бууруулж, lapse нэмнэ, тэр даруй дахин харуулна", () => {
  let c = review(newCard("a", "t", t0), "know", t0);
  const s = c.stability;
  c = review(c, "forgot", c.dueAt);
  assert.ok(c.stability < s);
  assert.equal(c.lapses, 1);
  assert.ok(c.dueAt - (c.lastReviewedAt ?? 0) < DAY_MS);
});

test("шалгалтын өмнөх өдрөөс хэтрэхгүй", () => {
  let c = newCard("a", "t", t0);
  for (let i = 0; i < 5; i++) c = review(c, "know", c.dueAt);
  const exam = c.lastReviewedAt! + 3 * DAY_MS;
  assert.ok(capToExam(c, exam).dueAt <= exam - DAY_MS);
});

test("dueCards хамгийн мартсанг эхэнд эрэмбэлнэ, сул сэдэв илрүүлнэ", () => {
  const strong = review(review(newCard("s", "algebra", t0), "know", t0), "know", t0 + DAY_MS);
  const weak = review(newCard("w", "geometry", t0), "forgot", t0);
  const now = t0 + 30 * DAY_MS;
  assert.equal(dueCards([strong, weak], now)[0]?.id, "w");
  const m = topicMastery([strong, weak], t0 + DAY_MS);
  assert.equal(m.find((x) => x.topicId === "geometry")?.weak, true);
});
