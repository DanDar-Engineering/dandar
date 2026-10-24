import test from "node:test";
import assert from "node:assert/strict";
import {
  type CardOptions,
  MAX_GENERATED_CARDS,
  cardSystemPrompt,
  mergeDrafts,
  parseDraft,
} from "./cardGen.ts";

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

const OPTIONS: CardOptions = {
  count: 8,
  level: "medium",
  kind: "qa",
  lang: "auto",
  focus: "",
  instructions: "",
};

test("cardSystemPrompt: exam material never asks for its own answers", () => {
  const exam = cardSystemPrompt(OPTIONS, { mode: "exam", withImage: false });
  assert.match(exam, /яг өөрсдийнх нь хариуг БҮҮ/);
  assert.match(exam, /өөрчилсөн шинэ дасгал/);
  assert.doesNotMatch(cardSystemPrompt(OPTIONS), /БҮҮ гарга/);
});

test("cardSystemPrompt: image mode tells Gemma to trust the photo", () => {
  assert.match(cardSystemPrompt(OPTIONS, { mode: "notes", withImage: true }), /зургийг баримтал/);
  assert.doesNotMatch(cardSystemPrompt(OPTIONS), /зургийг баримтал/);
});

test("mergeDrafts: first deck and date, no duplicate fronts, capped", () => {
  const merged = mergeDrafts(
    [
      {
        deck: "",
        examDate: null,
        cards: [
          { front: "Q1", back: "a" },
          { front: "Q2", back: "b" },
        ],
      },
      {
        deck: "Хими",
        examDate: "2026-12-01",
        cards: [
          { front: "q1 ", back: "x" },
          { front: "Q3", back: "c" },
        ],
      },
    ],
    2,
  );
  assert.equal(merged.deck, "Хими");
  assert.equal(merged.examDate, "2026-12-01");
  assert.deepEqual(
    merged.cards.map((card) => card.front),
    ["Q1", "Q2"],
  );
  assert.equal(mergeDrafts([], 5).cards.length, 0);
});
