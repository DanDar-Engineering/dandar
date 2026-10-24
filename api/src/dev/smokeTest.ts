// End-to-end check of every feature against the running plugin API, in the
// order a student uses them, including the hand-offs between features
// (scan → cards → review → quiz → progress → exams, planner → voice plan).
//
//   pnpm run smoke                  (needs dev:api running and MONGO_URL in .env)
//   SMOKE_SKIP_AI=1 pnpm run smoke  (no Gemma calls; skips the AI steps)
//
// It talks to the API directly with the gateway's `user` header, as three
// throwaway owner users, so no erxes login is needed. Never point it at a
// production API: forwarded identity headers are only trusted on the private
// network. Everything it creates is deleted at the end.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connect, connection, disconnect } from "mongoose";
import { env, manifest } from "../config.ts";

const API = process.env.SMOKE_API_URL ?? `http://localhost:${manifest.api.port}`;
const SKIP_AI = process.env.SMOKE_SKIP_AI === "1";
const DAY = 86_400_000;
const run = Date.now().toString(36);

type User = { _id: string; email: string; isOwner: true };
const user = (role: string): User => ({
  _id: `smoke-${role}-${run}`,
  email: `${role}@smoke.test`,
  isOwner: true,
});
const student = user("student");
const teacher = user("teacher");
const stranger = user("stranger");

class GraphQLFailure extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
  }
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};

const call = async <T>(as: User, query: string, variables: Record<string, unknown> = {}) => {
  const response = await fetch(`${API}${manifest.api.graphql}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      hostname: "localhost",
      user: Buffer.from(JSON.stringify(as)).toString("base64"),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(240_000),
  });
  const body = (await response.json()) as GraphQLResponse<T>;
  const error = body.errors?.[0];
  if (error) throw new GraphQLFailure(error.message, error.extensions?.code);
  if (!body.data) throw new Error(`HTTP ${response.status} without data`);

  return body.data;
};

// Resolves to the error code; fails when the call succeeds.
const rejects = async (as: User, query: string, variables: Record<string, unknown>) => {
  try {
    await call(as, query, variables);
  } catch (error) {
    if (error instanceof GraphQLFailure) return error.code ?? error.message;
    throw error;
  }
  throw new Error("expected an error, the call succeeded");
};

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const image = (file: string) => ({
  mimeType: "image/jpeg",
  imageData: readFileSync(join(__dirname, "../../../demo/scans", file)).toString("base64"),
});

const isoDate = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

type Outcome = "pass" | "fail" | "skip";
const results: { name: string; outcome: Outcome; ms: number; note: string }[] = [];

const step = async (
  name: string,
  body: () => Promise<string | void>,
  options: { ai?: boolean; optional?: boolean } = {},
) => {
  const started = Date.now();
  if (options.ai && SKIP_AI) {
    results.push({ name, outcome: "skip", ms: 0, note: "SMOKE_SKIP_AI=1" });
    console.log(`  –  ${name} (skipped)`);
    return;
  }
  try {
    const note = (await body()) ?? "";
    results.push({ name, outcome: "pass", ms: Date.now() - started, note });
    console.log(`  ✓  ${name}${note ? ` — ${note}` : ""}`);
  } catch (error) {
    const note = error instanceof Error ? error.message : String(error);
    const outcome = options.optional ? "skip" : "fail";
    results.push({ name, outcome, ms: Date.now() - started, note });
    console.log(`  ${outcome === "fail" ? "✗" : "–"}  ${name} — ${note}`);
  }
};

// ---------------------------------------------------------------- documents

const SCAN_FIELDS =
  "_id studentId teacherId kind title subject summary status teacherComment imageUrl";
const SCAN_SAVE = `mutation ($fileName: String!, $mimeType: String!, $imageData: String!, $text: String!,
  $kind: DandarScanKind!, $title: String!, $subject: String, $summary: String, $teacherId: String) {
  dandarScanSave(fileName: $fileName, mimeType: $mimeType, imageData: $imageData, text: $text,
    kind: $kind, title: $title, subject: $subject, summary: $summary, teacherId: $teacherId) { ${SCAN_FIELDS} } }`;
const CARD_FIELDS =
  "_id deck front back scanIds reviews retention dueAt preview { forgot unsure know easy }";
const DRAFT = `mutation ($notes: String, $scanIds: [String!], $options: DandarCardOptionsInput) {
  dandarCardsDraft(notes: $notes, scanIds: $scanIds, options: $options) { deck examDate examMode cards { front back } } }`;
const PLANNER_UPDATE = `mutation ($version: Int!, $action: String!, $data: String!) {
  dandarPlannerUpdate(version: $version, action: $action, data: $data) { version data } }`;

type Scan = {
  _id: string;
  studentId: string;
  teacherId: string | null;
  kind: string;
  title: string;
  subject: string | null;
  summary: string | null;
  status: string;
  teacherComment: string | null;
  imageUrl: string | null;
};
type Card = {
  _id: string;
  deck: string;
  front: string;
  back: string;
  scanIds: string[];
  reviews: number;
  retention: number;
  dueAt: string;
  preview: { forgot: number; unsure: number; know: number; easy: number } | null;
};
type Draft = {
  deck: string;
  examDate: string | null;
  examMode: boolean;
  cards: { front: string; back: string }[];
};
type Exam = { deck: string; examAt: string; cards: number; daysLeft: number; readiness: number };
type PlannerTask = {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  minutes: number;
  priority: number;
  status: string;
  reminders: number[];
};
type PlannerBlock = { id: string; taskId: string; start: string; end: string; status: string };
type PlannerData = {
  tasks: PlannerTask[];
  blocks: PlannerBlock[];
  reminderItems: { id: string; notificationId: string; dueAt: string; expiresAt: string }[];
};
type Planner = { version: number; data: string };

// ---------------------------------------------------------------- scenario

const main = async () => {
  console.log(`DanDar smoke test against ${API} (run ${run})${SKIP_AI ? ", AI skipped" : ""}\n`);
  let aiReady = !SKIP_AI;

  console.log("Platform");
  await step("API /health answers", async () => {
    const response = await fetch(`${API}${manifest.api.health}`);
    check(response.ok, `HTTP ${response.status}`);
  });
  await step("dandarStatus sees the forwarded user", async () => {
    const { dandarStatus } = await call<{ dandarStatus: { plugin: string; userId: string } }>(
      student,
      "{ dandarStatus { plugin userId } }",
    );
    check(dandarStatus.plugin === manifest.name, `plugin ${dandarStatus.plugin}`);
    check(dandarStatus.userId === student._id, "userId mismatch");
  });
  await step("Gemma and voice are configured", async () => {
    const data = await call<{
      dandarAiStatus: { provider: string; model: string; configured: boolean };
      dandarVoiceStatus: { configured: boolean; sttConfigured: boolean; provider: string };
    }>(
      student,
      "{ dandarAiStatus { provider model configured } dandarVoiceStatus { configured sttConfigured provider } }",
    );
    aiReady = aiReady && data.dandarAiStatus.configured;
    check(data.dandarAiStatus.configured || SKIP_AI, "Gemma is not configured (.env)");
    return `${data.dandarAiStatus.provider}/${data.dandarAiStatus.model}; TTS ${data.dandarVoiceStatus.provider} ${data.dandarVoiceStatus.configured ? "on" : "off"}, STT ${data.dandarVoiceStatus.sttConfigured ? "Chimege" : "browser"}`;
  });
  await step("anonymous requests are rejected", async () => {
    const response = await fetch(`${API}${manifest.api.graphql}`, {
      method: "POST",
      headers: { "content-type": "application/json", hostname: "localhost" },
      body: JSON.stringify({ query: "{ dandarScans { _id } }" }),
    });
    const body = (await response.json()) as GraphQLResponse<unknown>;
    // erxes-api-shared's own login guard answers before the resolver runs.
    check(body.errors?.[0]?.message === "Login required", "an anonymous request got data");
  });

  console.log("\nScans (Gemma 4 OCR)");
  const note = image("note-quadratic.jpg");
  const exam = image("exam-math-test3.jpg");
  let noteReading = {
    text: "Квадрат тэгшитгэл\nax² + bx + c = 0\nD = b² − 4ac\nx² − 5x + 6 = 0 → x₁ = 2, x₂ = 3",
    kind: "note",
    title: "Квадрат тэгшитгэл",
    subject: "Математик",
    summary: "- Дискриминант D = b² − 4ac\n- Виетийн теорем",
  };
  let examReading = {
    text: "Математик · Сорил №3\n1. 2x² − 7x + 3 = 0 тэгшитгэлийг бод.\n2. log₂ 32 илэрхийллийн утгыг ол.",
    kind: "exam",
    title: "Математикийн сорил №3",
    subject: "Математик",
    summary: "",
  };
  type Reading = {
    text: string;
    kind: string;
    title: string;
    subject: string | null;
    summary: string | null;
    confident: boolean;
  };
  const READ = `mutation ($mimeType: String!, $imageData: String!) {
    dandarScanRead(mimeType: $mimeType, imageData: $imageData) { text kind title subject summary confident } }`;
  await step(
    "dandarScanRead transcribes and classifies a note photo",
    async () => {
      const { dandarScanRead: r } = await call<{ dandarScanRead: Reading }>(student, READ, note);
      check(/тэгшитгэл/i.test(r.text), `text does not mention тэгшитгэл: ${r.text.slice(0, 80)}`);
      check(r.kind === "note", `kind ${r.kind}`);
      noteReading = { ...r, subject: r.subject ?? "", summary: r.summary ?? "" };
      return `«${r.title}» · ${r.subject ?? "—"} · confident ${r.confident}`;
    },
    { ai: true },
  );
  await step(
    "dandarScanRead recognises an exam paper",
    async () => {
      const { dandarScanRead: r } = await call<{ dandarScanRead: Reading }>(student, READ, exam);
      check(r.kind === "exam", `kind ${r.kind}`);
      examReading = { ...r, subject: r.subject ?? "", summary: "" };
      return `«${r.title}»`;
    },
    { ai: true },
  );
  await step("dandarScanRead rejects a non-image upload", async () => {
    const code = await rejects(student, READ, { mimeType: "application/pdf", imageData: "AAAA" });
    check(code === "BAD_USER_INPUT", code);
  });

  let noteScan: Scan | undefined;
  let examScan: Scan | undefined;
  let laterScan: Scan | undefined;
  await step("save a note: processed, summary kept", async () => {
    noteScan = (
      await call<{ dandarScanSave: Scan }>(student, SCAN_SAVE, {
        fileName: "note-quadratic.jpg",
        ...note,
        ...noteReading,
        kind: "note",
      })
    ).dandarScanSave;
    check(noteScan.status === "processed", noteScan.status);
    check(!!noteScan.summary, "summary dropped");
  });
  await step("save an exam with a teacher: sent", async () => {
    examScan = (
      await call<{ dandarScanSave: Scan }>(student, SCAN_SAVE, {
        fileName: "exam-math-test3.jpg",
        ...exam,
        ...examReading,
        kind: "exam",
        teacherId: teacher._id,
      })
    ).dandarScanSave;
    check(examScan.status === "sent" && examScan.teacherId === teacher._id, examScan.status);
    check(examScan.summary === null, "exam kept a summary");
  });
  await step("save an exam without a teacher, send it later", async () => {
    laterScan = (
      await call<{ dandarScanSave: Scan }>(student, SCAN_SAVE, {
        fileName: "exam-physics-midterm.jpg",
        ...image("exam-physics-midterm.jpg"),
        text: "Физик · Явцын шалгалт\n1. Ньютоны хоёрдугаар хуулийг томьёолж бич.",
        kind: "exam",
        title: "Физикийн явцын шалгалт",
        subject: "Физик",
      })
    ).dandarScanSave;
    check(laterScan.status === "awaiting_teacher", laterScan.status);
    const { dandarScanSendToTeacher: sent } = await call<{ dandarScanSendToTeacher: Scan }>(
      student,
      `mutation ($_id: String!, $teacherId: String!) { dandarScanSendToTeacher(_id: $_id, teacherId: $teacherId) { ${SCAN_FIELDS} } }`,
      { _id: laterScan._id, teacherId: teacher._id },
    );
    check(sent.status === "sent", sent.status);
  });
  await step("student list: own scans, no photos", async () => {
    const { dandarScans } = await call<{ dandarScans: Scan[] }>(
      student,
      `{ dandarScans(limit: 20) { ${SCAN_FIELDS} } }`,
    );
    check(dandarScans.length === 3, `${dandarScans.length} scans`);
    check(
      dandarScans.every((scan) => scan.imageUrl === null),
      "a list returned a photo",
    );
  });
  await step("teacher inbox: only what was sent to them", async () => {
    const { dandarScansInbox } = await call<{ dandarScansInbox: Scan[] }>(
      teacher,
      `{ dandarScansInbox(limit: 20) { ${SCAN_FIELDS} } }`,
    );
    check(dandarScansInbox.length === 2, `${dandarScansInbox.length} in inbox`);
    check(
      dandarScansInbox.every((scan) => scan.kind === "exam"),
      "a note reached the inbox",
    );
  });
  await step("detail returns the photo to its owner only", async () => {
    const DETAIL = `query ($_id: String!) { dandarScanDetail(_id: $_id) { ${SCAN_FIELDS} } }`;
    const own = await call<{ dandarScanDetail: Scan | null }>(student, DETAIL, {
      _id: noteScan?._id,
    });
    check(own.dandarScanDetail?.imageUrl?.startsWith("data:image/jpeg;base64,"), "no photo");
    const other = await call<{ dandarScanDetail: Scan | null }>(stranger, DETAIL, {
      _id: noteScan?._id,
    });
    check(other.dandarScanDetail === null, "another user can read the scan");
    const assigned = await call<{ dandarScanDetail: Scan | null }>(teacher, DETAIL, {
      _id: examScan?._id,
    });
    check(!!assigned.dandarScanDetail?.imageUrl, "the teacher cannot open the sent exam");
  });
  await step("teacher answers; the student sees the comment", async () => {
    const comment = "Материалыг хүлээж авлаа. 1-р бодлогын шийдийг дахин шалгаарай.";
    const REVIEW = `mutation ($_id: String!, $comment: String!) { dandarScanReview(_id: $_id, comment: $comment) { ${SCAN_FIELDS} } }`;
    const { dandarScanReview: reviewed } = await call<{ dandarScanReview: Scan }>(teacher, REVIEW, {
      _id: examScan?._id,
      comment,
    });
    check(reviewed.status === "reviewed", reviewed.status);
    const { dandarScans } = await call<{ dandarScans: Scan[] }>(
      student,
      `{ dandarScans { ${SCAN_FIELDS} } }`,
    );
    check(
      dandarScans.find((scan) => scan._id === examScan?._id)?.teacherComment === comment,
      "student does not see the comment",
    );
    const code = await rejects(stranger, REVIEW, { _id: noteScan?._id, comment: "x" });
    check(code === "NOT_FOUND", `stranger review gave ${code}`);
  });

  console.log("\nCards from scans (Gemma 4)");
  let noteDraft: Draft = {
    deck: "Математик",
    examDate: null,
    examMode: false,
    cards: [
      { front: "Квадрат тэгшитгэлийн дискриминант", back: "D = b² − 4ac" },
      { front: "x² − 5x + 6 = 0 тэгшитгэлийн шийд", back: "x₁ = 2, x₂ = 3" },
      { front: "Виетийн теоремоор x₁ + x₂ = ?", back: "−b/a" },
    ],
  };
  await step(
    "draft cards from the saved note (no photo re-upload)",
    async () => {
      const { dandarCardsDraft } = await call<{ dandarCardsDraft: Draft }>(student, DRAFT, {
        scanIds: [noteScan?._id],
        options: { count: 5, level: "medium", kind: "qa", lang: "auto" },
      });
      check(dandarCardsDraft.cards.length > 0, "no cards");
      check(!dandarCardsDraft.examMode, "a note came back in exam mode");
      noteDraft = dandarCardsDraft;
      return `${dandarCardsDraft.cards.length} cards, deck «${dandarCardsDraft.deck}»`;
    },
    { ai: true },
  );
  await step(
    "draft from an exam paper switches to practice mode",
    async () => {
      const { dandarCardsDraft } = await call<{ dandarCardsDraft: Draft }>(student, DRAFT, {
        scanIds: [examScan?._id],
        options: { count: 5 },
      });
      check(dandarCardsDraft.examMode, "examMode is false");
      check(dandarCardsDraft.cards.length > 0, "no cards");
      return `${dandarCardsDraft.cards.length} practice cards${dandarCardsDraft.examDate ? `, exam date ${dandarCardsDraft.examDate}` : ""}`;
    },
    { ai: true },
  );
  await step("another user cannot draft from this student's scan", async () => {
    const code = await rejects(stranger, DRAFT, { scanIds: [noteScan?._id] });
    check(code === "BAD_USER_INPUT", code);
  });

  const mathDeck = `Smoke Математик ${run}`;
  const physicsDeck = `Smoke Физик ${run}`;
  let saved: Card[] = [];
  await step("save the checked cards with an exam date", async () => {
    const { dandarCardsSave } = await call<{ dandarCardsSave: Card[] }>(
      student,
      `mutation ($deck: String!, $cards: [DandarCardInput!]!, $examDate: String, $scanIds: [String!]) {
        dandarCardsSave(deck: $deck, cards: $cards, examDate: $examDate, scanIds: $scanIds) { ${CARD_FIELDS} } }`,
      {
        deck: mathDeck,
        cards: noteDraft.cards.slice(0, 6),
        examDate: isoDate(10),
        scanIds: [noteScan?._id],
      },
    );
    saved = dandarCardsSave;
    check(saved.length > 0, "nothing saved");
    check(
      saved.every((card) => card.scanIds.includes(noteScan?._id ?? "")),
      "cards lost their scan link",
    );
    return `${saved.length} cards`;
  });
  await step("the scan now shows how many cards it became", async () => {
    const { dandarScanCardCounts } = await call<{
      dandarScanCardCounts: { scanId: string; cards: number }[];
    }>(student, "{ dandarScanCardCounts { scanId cards } }");
    const row = dandarScanCardCounts.find((item) => item.scanId === noteScan?._id);
    check(row?.cards === saved.length, `count ${row?.cards}`);
  });
  await step("the exam date scheduled the deck", async () => {
    const { dandarExams } = await call<{ dandarExams: Exam[] }>(
      student,
      "{ dandarExams { deck examAt cards daysLeft readiness } }",
    );
    const examRow = dandarExams.find((item) => item.deck === mathDeck);
    check(examRow, "exam missing");
    check(examRow.cards === saved.length, `exam counts ${examRow.cards} cards`);
    check(examRow.daysLeft >= 9 && examRow.daysLeft <= 11, `daysLeft ${examRow.daysLeft}`);
    const lastDay = Date.parse(examRow.examAt) - DAY;
    check(
      saved.every((card) => Date.parse(card.dueAt) <= lastDay),
      "a card is due after the day before the exam",
    );
  });
  const manual = [
    { front: "Ньютоны хоёрдугаар хууль", back: "F = m·a" },
    { front: "Хүчний нэгж", back: "Ньютон (Н)" },
    { front: "Кинетик энерги", back: "E = mv²/2" },
  ];
  await step("add cards by hand", async () => {
    for (const card of manual) {
      await call(
        student,
        `mutation ($deck: String!, $front: String!, $back: String!) { dandarCardAdd(deck: $deck, front: $front, back: $back) { _id } }`,
        { deck: physicsDeck, ...card },
      );
    }
  });

  console.log("\nReview, quiz and progress");
  let due: Card[] = [];
  await step("today's queue counts every new card", async () => {
    const { dandarStudyCounts: counts } = await call<{
      dandarStudyCounts: { newCards: number; dueCards: number; total: number };
    }>(student, "{ dandarStudyCounts { newCards dueCards total } }");
    const total = saved.length + manual.length;
    check(counts.total === total && counts.newCards === total, JSON.stringify(counts));
    due = (
      await call<{ dandarDueCards: Card[] }>(
        student,
        `{ dandarDueCards(limit: 20) { ${CARD_FIELDS} } }`,
      )
    ).dandarDueCards;
    check(due.length === total, `${due.length} due`);
    const preview = due[0]?.preview;
    check(preview && preview.forgot < preview.know && preview.know <= preview.easy, "bad preview");
  });
  const grades = ["forgot", "unsure", "know", "easy"] as const;
  await step("grade four cards (1–4)", async () => {
    for (const [i, grade] of grades.entries()) {
      const card = due[i];
      check(card, "not enough due cards");
      const { dandarCardReview } = await call<{ dandarCardReview: Card }>(
        student,
        `mutation ($_id: String!, $grade: DandarCardGrade!) { dandarCardReview(_id: $_id, grade: $grade) { ${CARD_FIELDS} } }`,
        { _id: card._id, grade },
      );
      check(dandarCardReview.reviews === 1, "reviews not counted");
      check(Date.parse(dandarCardReview.dueAt) > Date.now(), "card still due");
    }
  });
  await step("a stranger cannot grade the student's card", async () => {
    const code = await rejects(
      stranger,
      `mutation ($_id: String!) { dandarCardReview(_id: $_id, grade: know) { _id } }`,
      { _id: due[4]?._id },
    );
    check(code === "BAD_USER_INPUT", code);
  });
  type Quiz = { cardId: string; deck: string; front: string; choices: string[] };
  let quiz: Quiz[] = [];
  await step("quiz builds questions without leaking answers", async () => {
    quiz = (
      await call<{ dandarQuiz: Quiz[] }>(
        student,
        "{ dandarQuiz(size: 5) { cardId deck front choices } }",
      )
    ).dandarQuiz;
    check(quiz.length > 0, "no questions");
    check(
      quiz.every((q) => q.choices.length >= 2 && new Set(q.choices).size === q.choices.length),
      "duplicate or missing choices",
    );
    return `${quiz.length} questions, ${quiz[0]?.choices.length} choices`;
  });
  await step("quiz answers are checked and rescheduled", async () => {
    const all = [...saved, ...due];
    const ANSWER = `mutation ($cardId: String!, $choice: String!) { dandarQuizAnswer(cardId: $cardId, choice: $choice) { correct answer card { reviews } } }`;
    const first = quiz[0];
    const second = quiz[1];
    check(first && second, "need two questions");
    const answer = all.find((card) => card._id === first.cardId)?.back ?? "";
    const right = await call<{ dandarQuizAnswer: { correct: boolean } }>(student, ANSWER, {
      cardId: first.cardId,
      choice: answer,
    });
    check(right.dandarQuizAnswer.correct, "right answer marked wrong");
    const wrongChoice = second.choices.find(
      (choice) => choice !== all.find((card) => card._id === second.cardId)?.back,
    );
    const wrong = await call<{ dandarQuizAnswer: { correct: boolean } }>(student, ANSWER, {
      cardId: second.cardId,
      choice: wrongChoice,
    });
    check(!wrong.dandarQuizAnswer.correct, "wrong answer marked right");
  });
  await step("progress counts reviews and quiz answers", async () => {
    const { dandarStudyProgress: p } = await call<{
      dandarStudyProgress: {
        activeDays: number;
        reviewedThisWeek: number;
        rememberedRate: number;
        days: { date: string; reviewed: number }[];
        forecast: { due: number }[];
      };
    }>(
      student,
      "{ dandarStudyProgress { activeDays reviewedThisWeek rememberedRate days { date reviewed } forecast { due } } }",
    );
    check(p.reviewedThisWeek === 6, `reviewed ${p.reviewedThisWeek}`);
    check(p.activeDays === 1 && p.days.length === 7, "days");
    check(p.rememberedRate === 50, `remembered ${p.rememberedRate}%`);
    check(p.forecast.length === 7, "forecast");
  });
  await step(
    "Gemma gives a hint for a card",
    async () => {
      const { dandarCardHelp } = await call<{ dandarCardHelp: string }>(
        student,
        `mutation ($_id: String!) { dandarCardHelp(_id: $_id, mode: hint) }`,
        { _id: saved[0]?._id },
      );
      check(dandarCardHelp.trim().length > 0, "empty hint");
      return dandarCardHelp.slice(0, 60).replace(/\s+/g, " ");
    },
    { ai: true },
  );

  console.log("\nLibrary, exams and settings");
  await step("search, edit and deck mastery", async () => {
    const term = manual[0]?.front.slice(0, 8) ?? "";
    const { dandarStudyCards } = await call<{ dandarStudyCards: Card[] }>(
      student,
      `query ($search: String) { dandarStudyCards(search: $search) { ${CARD_FIELDS} } }`,
      { search: term },
    );
    const found = dandarStudyCards.find((card) => card.front === manual[0]?.front);
    check(found, "search missed the card");
    const { dandarCardUpdate } = await call<{ dandarCardUpdate: Card }>(
      student,
      `mutation ($_id: String!, $deck: String!, $front: String!, $back: String!) {
        dandarCardUpdate(_id: $_id, deck: $deck, front: $front, back: $back) { ${CARD_FIELDS} } }`,
      { _id: found._id, deck: physicsDeck, front: found.front, back: "F = m · a" },
    );
    check(dandarCardUpdate.back === "F = m · a", "edit lost");
    const { dandarDeckMastery } = await call<{ dandarDeckMastery: { deck: string }[] }>(
      student,
      "{ dandarDeckMastery { deck cards mastery weak } }",
    );
    check(dandarDeckMastery.length === 2, `${dandarDeckMastery.length} decks`);
  });
  await step("exam set / past date rejected / rename moves the exam", async () => {
    const SET = `mutation ($deck: String!, $date: String!) { dandarExamSet(deck: $deck, date: $date) { deck daysLeft } }`;
    await call(student, SET, { deck: physicsDeck, date: isoDate(5) });
    const code = await rejects(student, SET, { deck: physicsDeck, date: isoDate(-1) });
    check(code === "BAD_USER_INPUT", code);
    const renamed = `${physicsDeck} (2)`;
    const { dandarDeckRename } = await call<{ dandarDeckRename: number }>(
      student,
      `mutation ($from: String!, $to: String!) { dandarDeckRename(from: $from, to: $to) }`,
      { from: physicsDeck, to: renamed },
    );
    check(dandarDeckRename === manual.length, `${dandarDeckRename} moved`);
    const { dandarExams } = await call<{ dandarExams: Exam[] }>(
      student,
      "{ dandarExams { deck cards } }",
    );
    check(
      dandarExams.some((e) => e.deck === renamed && e.cards === manual.length),
      "exam did not follow the rename",
    );
    const removed = await call<{ dandarExamDelete: boolean }>(
      student,
      `mutation ($deck: String!) { dandarExamDelete(deck: $deck) }`,
      { deck: renamed },
    );
    check(removed.dandarExamDelete, "exam not deleted");
  });
  await step("reminder settings validate quiet hours", async () => {
    const SAVE = `mutation ($input: DandarStudySettingsInput!) { dandarStudySettingsSave(input: $input) { reminderHour } }`;
    const code = await rejects(student, SAVE, {
      input: {
        reviewReminder: true,
        reminderHour: 23,
        examAlerts: true,
        quietStart: 22,
        quietEnd: 7,
      },
    });
    check(code === "BAD_USER_INPUT", code);
    await call(student, SAVE, {
      input: {
        reviewReminder: true,
        reminderHour: 19,
        examAlerts: true,
        quietStart: 22,
        quietEnd: 7,
      },
    });
    const { dandarStudySettings } = await call<{ dandarStudySettings: { reminderHour: number } }>(
      student,
      "{ dandarStudySettings { reminderHour } }",
    );
    check(dandarStudySettings.reminderHour === 19, "not saved");
  });

  console.log("\nPlanner");
  let planner: Planner = (
    await call<{ dandarPlanner: Planner }>(student, "{ dandarPlanner { version data } }")
  ).dandarPlanner;
  const update = async (action: string, data: unknown, version = planner.version) => {
    planner = (
      await call<{ dandarPlannerUpdate: Planner }>(student, PLANNER_UPDATE, {
        version,
        action,
        data: JSON.stringify(data),
      })
    ).dandarPlannerUpdate;
    return JSON.parse(planner.data) as PlannerData;
  };
  const task: PlannerTask = {
    id: `smoke-task-${run}`,
    title: "Математикийн сорилд бэлдэх",
    subject: "Математик",
    deadline: new Date(Date.now() + 3 * DAY).toISOString(),
    minutes: 75,
    priority: 3,
    status: "todo",
    reminders: [1440, 60, 0],
  };
  await step("preferences and a task are saved", async () => {
    await update("preferences", {
      enabled: true,
      quietStart: 0,
      quietEnd: 0,
      timeZone: "Asia/Ulaanbaatar",
      focus: 25,
      dailyLimit: 180,
      sessionReminderMinutes: 15,
    });
    const data = await update("task", task);
    check(
      data.tasks.some((t) => t.id === task.id),
      "task missing",
    );
  });
  await step("a stale version is refused (two tabs)", async () => {
    const code = await rejects(student, PLANNER_UPDATE, {
      version: planner.version - 1,
      action: "task",
      data: JSON.stringify(task),
    });
    check(code === "CONFLICT", code);
  });
  type Proposal = {
    version: number;
    data: string;
    warnings: string[];
    model: string;
    replaceIds: string[];
    policy: string;
  };
  let proposal: Proposal | undefined;
  const tomorrow = new Date(Date.now() + DAY);
  tomorrow.setUTCHours(2, 0, 0, 0); // 10:00 in Ulaanbaatar
  const windows = [
    {
      start: tomorrow.toISOString(),
      end: new Date(tomorrow.getTime() + 3 * 3_600_000).toISOString(),
    },
  ];
  await step("Gemma ranks tasks and the engine proposes sessions", async () => {
    proposal = (
      await call<{ dandarPlanPropose: Proposal }>(
        student,
        `mutation ($windows: String!, $options: String) { dandarPlanPropose(windows: $windows, options: $options) { version data warnings model replaceIds policy } }`,
        { windows: JSON.stringify(windows), options: JSON.stringify({ energy: "normal" }) },
      )
    ).dandarPlanPropose;
    const blocks = JSON.parse(proposal.data) as PlannerBlock[];
    check(blocks.length === 3, `${blocks.length} sessions for 75 minutes`);
    return `${blocks.length} sessions by ${proposal.model}${proposal.warnings.length ? `; ${proposal.warnings.join(" ")}` : ""}`;
  });
  await step("the confirmed plan is stored", async () => {
    check(proposal, "no proposal");
    const data = await update(
      "applyPlan",
      {
        blocks: JSON.parse(proposal.data),
        replaceIds: proposal.replaceIds,
        policy: proposal.policy,
      },
      proposal.version,
    );
    check(data.blocks.length === 3, `${data.blocks.length} blocks`);
  });
  await step("start, finish, move and mark sessions", async () => {
    let data = JSON.parse(planner.data) as PlannerData;
    const [first, second, third] = data.blocks;
    check(first && second && third, "blocks missing");
    data = await update("block", { id: first.id, status: "started" });
    check(data.tasks.find((t) => t.id === task.id)?.status === "started", "task not started");
    const code = await rejects(student, PLANNER_UPDATE, {
      version: planner.version,
      action: "block",
      data: JSON.stringify({ id: second.id, status: "started" }),
    });
    check(code === "BAD_USER_INPUT", "two sessions could run at once");
    data = await update("block", { id: first.id, status: "completed" });
    check(data.blocks.find((b) => b.id === first.id)?.status === "completed", "not completed");
    const later = new Date(Date.parse(third.start) + DAY).toISOString();
    data = await update("move", { id: third.id, start: later });
    check(data.blocks.find((b) => b.id === third.id)?.start === later, "not moved");
    data = await update("block", { id: second.id, status: "missed" });
    check(data.blocks.find((b) => b.id === second.id)?.status === "missed", "not missed");
  });
  await step("deadline reminders come due and are claimed once", async () => {
    const soon: PlannerTask = {
      ...task,
      id: `smoke-soon-${run}`,
      title: "Англи хэлний эссэ",
      deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
      minutes: 30,
      reminders: [60],
    };
    let data = await update("task", soon);
    const reminder = data.reminderItems.find(
      (r) => r.id.startsWith(soon.id) && Date.parse(r.dueAt) <= Date.now(),
    );
    check(reminder, "reminder not due");
    await update("claimReminders", [reminder.notificationId]);
    const code = await rejects(student, PLANNER_UPDATE, {
      version: planner.version,
      action: "claimReminders",
      data: JSON.stringify([reminder.notificationId]),
    });
    check(code === "BAD_USER_INPUT", "claimed twice");
    data = await update("reminderAction", { id: reminder.id, action: "dismiss" });
    check(!data.reminderItems.some((r) => r.id === reminder.id), "not dismissed");
  });
  await step("what-if simulation compares two plans", async () => {
    const { dandarPlannerSimulate } = await call<{
      dandarPlannerSimulate: { baseline: { data: string }; scenario: { data: string } };
    }>(
      student,
      `mutation ($input: String!) { dandarPlannerSimulate(input: $input) { baseline { data } scenario { data } } }`,
      {
        input: JSON.stringify({ windows, options: { energy: "low" } }),
      },
    );
    check(Array.isArray(JSON.parse(dandarPlannerSimulate.scenario.data)), "no scenario");
  });
  await step(
    "voice plan: Mongolian speech becomes tasks and sessions",
    async () => {
      const { dandarPlanFromSpeech } = await call<{
        dandarPlanFromSpeech: { tasks: string; blocks: string; warnings: string[] };
      }>(
        student,
        `mutation ($text: String!) { dandarPlanFromSpeech(text: $text) { tasks blocks warnings model } }`,
        {
          text: "Маргааш оройн долоогоос есөн цаг хүртэл математикийн сорилд бэлдэнэ. Баасан гаригт физикийн шалгалттай.",
        },
      );
      const tasks = JSON.parse(dandarPlanFromSpeech.tasks) as PlannerTask[];
      check(tasks.length > 0, "no tasks");
      return `${tasks.length} tasks, ${(JSON.parse(dandarPlanFromSpeech.blocks) as unknown[]).length} sessions: ${tasks.map((t) => t.title).join("; ")}`;
    },
    { ai: true },
  );
  await step("deleting a task removes its sessions", async () => {
    const data = await update("deleteTask", task.id);
    check(!data.blocks.some((b) => b.taskId === task.id), "orphan sessions");
  });

  console.log("\nTutor and voice");
  await step(
    "Ask Pure (dandarAsk) answers in Mongolian",
    async () => {
      const { dandarAsk } = await call<{ dandarAsk: { text: string; model: string } }>(
        student,
        `mutation ($prompt: String!) { dandarAsk(prompt: $prompt) { text model } }`,
        { prompt: "Пифагорын теоремыг нэг өгүүлбэрээр тайлбарла." },
      );
      check(/[а-яөү]/i.test(dandarAsk.text), "answer is not Mongolian");
      return dandarAsk.text.slice(0, 60).replace(/\s+/g, " ");
    },
    { ai: true },
  );
  await step(
    "text-to-speech reads a reminder aloud",
    async () => {
      const { dandarSpeak } = await call<{ dandarSpeak: { audioUrl: string } }>(
        student,
        `mutation ($text: String!) { dandarSpeak(text: $text) { audioUrl } }`,
        { text: "Сайн байна уу. Математикийн давтлагын цаг боллоо." },
      );
      check(dandarSpeak.audioUrl.startsWith("data:audio/"), "no audio");
      return `${Math.round(dandarSpeak.audioUrl.length / 1024)} KB audio`;
    },
    { optional: true },
  );

  console.log("\nCleanup");
  await step("deck delete removes cards and exam", async () => {
    const { dandarDeckDelete } = await call<{ dandarDeckDelete: number }>(
      student,
      `mutation ($deck: String!) { dandarDeckDelete(deck: $deck) }`,
      { deck: mathDeck },
    );
    check(dandarDeckDelete === saved.length, `${dandarDeckDelete} deleted`);
  });
  await step("test data deleted from MongoDB", async () => {
    check(env.MONGO_URL, "MONGO_URL is not set; delete smoke-* records by hand");
    await connect(env.MONGO_URL);
    const db = connection.db;
    check(db, "no database");
    const ids = [student._id, teacher._id, stranger._id];
    let removed = 0;
    for (const [collection, field] of [
      ["dandar_scans", "studentId"],
      ["dandar_study_cards", "userId"],
      ["dandar_study_exams", "userId"],
      ["dandar_study_reviews", "userId"],
      ["dandar_study_settings", "userId"],
      ["dandar_planners", "userId"],
    ] as const) {
      removed += (await db.collection(collection).deleteMany({ [field]: { $in: ids } }))
        .deletedCount;
    }
    await disconnect();
    return `${removed} records`;
  });

  const failed = results.filter((r) => r.outcome === "fail");
  const skipped = results.filter((r) => r.outcome === "skip");
  console.log(
    `\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  );
  process.exitCode = failed.length ? 1 : 0;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
