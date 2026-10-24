import test from "node:test";
import assert from "node:assert/strict";
import { type CardOptions, MAX_GENERATED_CARDS, cardSystemPrompt, parseDraft } from "./cardGen.ts";

const NOW = Date.UTC(2026, 0, 1);

test("parseDraft: код блок доторх JSON, хоосон болон буруу мөрийг хасна", () => {
  const raw =
    '```json\n{"deck":"Математик","examDate":"2026-12-10","cards":[{"front":"Q1","back":"A1"},{"front":"","back":"x"},{"front":1,"back":"y"}]}\n```';
  assert.deepEqual(parseDraft(raw, NOW), {
    deck: "Математик",
    examDate: "2026-12-10",
    cards: [{ front: "Q1", back: "A1" }],
  });
});

test("parseDraft: бүтэн массив ч хүлээн авна", () => {
  assert.deepEqual(parseDraft('[{"front":"a","back":"b"}]', NOW).cards, [
    { front: "a", back: "b" },
  ]);
});

test("parseDraft: өнгөрсөн, буруу хэлбэртэй огноог null болгоно", () => {
  assert.equal(parseDraft('{"examDate":"2020-01-01","cards":[]}', NOW).examDate, null);
  assert.equal(parseDraft('{"examDate":"маргааш","cards":[]}', NOW).examDate, null);
});

test("parseDraft: эвдэрсэн хариунд хоосон жагсаалт, хэтэрхий олныг тасална", () => {
  assert.deepEqual(parseDraft("уучлаарай", NOW).cards, []);
  assert.deepEqual(parseDraft("{broken", NOW).cards, []);
  const many = JSON.stringify({
    cards: Array.from({ length: 40 }, (_, i) => ({ front: `q${i}`, back: "a" })),
  });
  assert.equal(parseDraft(many, NOW).cards.length, MAX_GENERATED_CARDS);
});

test("cardSystemPrompt: тохиргоо prompt-д орно", () => {
  const options: CardOptions = {
    count: 6,
    level: "hard",
    kind: "cloze",
    lang: "mn",
    focus: "томьёо",
    instructions: "богино",
  };
  const prompt = cardSystemPrompt(options);
  for (const part of [
    "6",
    "шалгалтын түвшний",
    "нөхөх",
    "Монгол хэлээр",
    "томьёо",
    "богино",
    "ӨГӨГДӨЛ",
  ]) {
    assert.ok(prompt.includes(part), part);
  }
});
