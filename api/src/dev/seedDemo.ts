// Demo data for a showcase: scanned notes and exam papers (photos from
// demo/scans), study decks with ten days of review history, exam dates,
// reminder settings and a planner week with sessions and reminders.
//
//   pnpm run seed:demo                                  student = the erxes owner
//   pnpm run seed:demo -- --student a@x.mn --teacher b@x.mn
//   pnpm run seed:demo -- --dry-run                     print what would be added
//   pnpm run seed:demo -- --reset                       remove the demo data only
//
// Every record it writes has a `demo_` id (planner tasks and sessions a
// `demo-` id), so running it again replaces the demo and --reset leaves the
// student's own records alone. Card states come from the real scheduler
// replaying the history, so mastery, readiness and progress all agree.
// Dev tool: it writes to MONGO_URL directly and skips GraphQL validation.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connect, connection, disconnect } from "mongoose";
import { env } from "../config.ts";
import type { Block, PlannerState, Task } from "../modules/planner/contract.ts";
import {
  DAY_MS,
  type Grade,
  applyExam,
  dueCards,
  newCard,
  review,
} from "../modules/study/logic/learning.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const NOW = Date.now();
const HOUR = 3_600_000;
const MINUTE = 60_000;
const demoId = () => `demo_${randomBytes(12).toString("base64url")}`;

// Seeded so every run tells the same story.
let seed = 20261024;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

// ------------------------------------------------------------------ time

// Study days use the same offset as the progress page (Ulaanbaatar = 480).
const TZ = env.STUDY_TZ_OFFSET_MINUTES * MINUTE;
const studyDay = (offset: number, hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const midnight = Math.floor((NOW + TZ) / DAY_MS) * DAY_MS - TZ;
  return midnight + offset * DAY_MS + h * HOUR + m * MINUTE;
};

// Planner times follow the planner's own time zone.
const zoneOffset = (timeZone: string, at: number) => {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(new Date(at))
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  return name.replace("GMT", "") || "Z";
};
const plannerAt = (timeZone: string, offset: number, hhmm: string) => {
  const at = NOW + offset * DAY_MS;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
  return Date.parse(`${date}T${hhmm}:00${zoneOffset(timeZone, at)}`);
};

// A fixed date printed on a demo paper while it is still ahead, otherwise
// the same distance from today.
const examDate = (printed: string, fallbackDays: number) => {
  const at = Date.parse(`${printed}T08:00:00+08:00`);
  return at - DAY_MS > NOW ? at : studyDay(fallbackDays, "08:00");
};

// ------------------------------------------------------------------ scans

type ScanSeed = {
  key: string;
  file: string;
  kind: "note" | "exam" | "other";
  title: string;
  subject: string;
  text: string;
  summary?: string;
  status: "processed" | "awaiting_teacher" | "sent" | "reviewed";
  ago: number;
  teacherComment?: string;
};

const SCANS: ScanSeed[] = [
  {
    key: "quadratic",
    file: "note-quadratic.jpg",
    kind: "note",
    title: "Квадрат тэгшитгэл",
    subject: "Математик",
    text: [
      "Математик 10.20",
      "Квадрат тэгшитгэл",
      "ax² + bx + c = 0, a ≠ 0",
      "Дискриминант: D = b² − 4ac",
      "• D > 0 бол 2 ялгаатай бодит шийдтэй",
      "• D = 0 бол 1 (давхар) шийдтэй",
      "• D < 0 бол бодит шийдгүй",
      "Шийдийн томьёо: x = (−b ± √D) / 2a",
      "Виетийн теорем:",
      "x₁ + x₂ = −b/a",
      "x₁ · x₂ = c/a",
      "Жишээ: x² − 5x + 6 = 0",
      "D = 25 − 24 = 1",
      "x₁ = 2, x₂ = 3",
    ].join("\n"),
    summary: [
      "- Квадрат тэгшитгэлийн ерөнхий хэлбэр: ax² + bx + c = 0 (a ≠ 0)",
      "- Шийдийн тоог дискриминант D = b² − 4ac тодорхойлно",
      "- Шийдийн томьёо: x = (−b ± √D) / 2a",
      "- Виетийн теорем: x₁ + x₂ = −b/a, x₁ · x₂ = c/a",
    ].join("\n"),
    status: "processed",
    ago: 4 * DAY_MS,
  },
  {
    key: "photosynthesis",
    file: "note-photosynthesis.jpg",
    kind: "note",
    title: "Фотосинтез",
    subject: "Биологи",
    text: [
      "Биологи 10.22",
      "Фотосинтез",
      "Ногоон ургамал гэрлийн энергийг ашиглан",
      "CO₂ ба уснаас органик бодис (глюкоз) үүсгэх процесс.",
      "Хаана: хлоропластад (хлорофилл пигмент)",
      "Ерөнхий тэгшитгэл:",
      "6CO₂ + 6H₂O —гэрэл→ C₆H₁₂O₆ + 6O₂",
      "1) Гэрлийн үе шат — тилакоидын мембранд:",
      "ус задарч O₂ ялгарна, ATP ба NADPH үүснэ",
      "2) Харанхуй үе шат (Кальвины цикл) — строманд:",
      "CO₂ шингээгдэж глюкоз нийлэгжинэ",
      "Ач холбогдол: агаарт O₂ нэмэгдэнэ,",
      "хүнсний гинжин хэлхээний эхлэл болно.",
    ].join("\n"),
    summary: [
      "- Фотосинтез нь гэрлийн энергиээр CO₂ ба уснаас глюкоз үүсгэдэг",
      "- Хлоропласт дахь хлорофилл гэрлийг шингээнэ",
      "- Гэрлийн үе шатанд O₂ ялгарч ATP, NADPH үүснэ",
      "- Кальвины циклд CO₂ шингээгдэж глюкоз нийлэгжинэ",
    ].join("\n"),
    status: "processed",
    ago: 2 * DAY_MS,
  },
  {
    key: "newton",
    file: "note-newton.jpg",
    kind: "note",
    title: "Ньютоны хуулиуд",
    subject: "Физик",
    text: [
      "Физик 10.23",
      "Ньютоны хуулиуд",
      "I хууль (инерцийн хууль):",
      "Биед хүч үйлчлэхгүй бол бие тайван",
      "эсвэл шулуун жигд хөдөлгөөнөө хадгална.",
      "II хууль: F = m · a",
      "F — хүч (Н), m — масс (кг), a — хурдатгал (м/с²)",
      "III хууль: F₁₂ = −F₂₁",
      "Үйлчлэл ба эсрэг үйлчлэл хэмжээгээрээ",
      "тэнцүү, чиглэлээрээ эсрэг.",
      "Жишээ: m = 2 кг, a = 3 м/с²",
      "F = 2 · 3 = 6 Н",
    ].join("\n"),
    summary: [
      "- I хууль: хүч үйлчлэхгүй бол бие хөдөлгөөний төлөвөө хадгална",
      "- II хууль: F = m · a",
      "- III хууль: үйлчлэл ба эсрэг үйлчлэл тэнцүү, эсрэг чиглэлтэй",
      "- Жишээ: 2 кг биед 3 м/с² хурдатгал өгөх хүч 6 Н",
    ].join("\n"),
    status: "processed",
    ago: 1 * DAY_MS,
  },
  {
    key: "mathTest",
    file: "exam-math-test3.jpg",
    kind: "exam",
    title: "Математикийн сорил №3",
    subject: "Математик",
    text: [
      "ЕБС-ийн XI анги · Математик",
      "СОРИЛ №3",
      "Огноо: 2026.11.06 Хугацаа: 40 минут",
      "1. 2x² − 7x + 3 = 0 тэгшитгэлийг бод.",
      "2. a₁ = 4, d = 3 бол арифметик прогрессийн 10 дахь гишүүнийг ол.",
      "3. sin 30° + cos 60° илэрхийллийн утгыг ол.",
      "4. log₂ 32 илэрхийллийн утгыг ол.",
      "5. Радиус нь 5 см тойргийн талбайг ол.",
      "6. x² − 9 < 0 тэнцэтгэл бишийг бод.",
      "Амжилт хүсье!",
    ].join("\n"),
    status: "sent",
    ago: 3 * HOUR,
  },
  {
    key: "physicsMidterm",
    file: "exam-physics-midterm.jpg",
    kind: "exam",
    title: "Физикийн явцын шалгалт",
    subject: "Физик",
    text: [
      "Физик · XI анги",
      "ЯВЦЫН ШАЛГАЛТ (А хувилбар)",
      "Сэдэв: Динамик Хугацаа: 35 минут",
      "1. Ньютоны хоёрдугаар хуулийг томьёолж бич.",
      "2. 5 кг масстай биед 20 Н хүч үйлчилбэл бие ямар хурдатгалтай хөдлөх вэ?",
      "a = F/m = 20/5 = 4 м/с²",
      "3. Масс нь 3 кг, хурдатгал нь 2 м/с² бол биед үйлчилж буй хүчийг ол.",
      "F = 3 · 2 = 6",
      "4. Үйлчлэл ба эсрэг үйлчлэлийн нэг жишээ бич.",
      "5. 72 км/цаг хурдыг м/с-ээр илэрхийл.",
    ].join("\n"),
    status: "reviewed",
    ago: 2 * DAY_MS,
    teacherComment:
      "Материалыг хүлээж авлаа. 3-р бодлогын хариуд нэгжээ (Н) бичихээ мартжээ. 5-р бодлогыг бас бодоод үзээрэй: 72 км/цаг = 20 м/с.",
  },
  {
    key: "englishSchedule",
    file: "exam-english-schedule.jpg",
    kind: "exam",
    title: "Англи хэлний улирлын шалгалтын хуваарь",
    subject: "Англи хэл",
    text: [
      "English · Grade 11",
      "MID-TERM EXAM",
      "Date: November 14, 2026 Time: 10:00–11:20 Room 204",
      "1. Grammar: Present Perfect vs Past Simple; 1st and 2nd Conditionals",
      "2. Vocabulary: Units 4–6 (environment, technology)",
      "3. Reading: 2 texts, 10 questions",
      "4. Writing: an opinion essay (120–150 words)",
      "5. Bring a pen, a pencil and an eraser. No phones.",
      "Good luck!",
    ].join("\n"),
    status: "awaiting_teacher",
    ago: 40 * MINUTE,
  },
];

// ------------------------------------------------------------------ cards

type DeckSeed = {
  deck: string;
  // Days ago the cards were added; null keeps a card new (never reviewed).
  introduced: (index: number) => number | null;
  // Chance of forgot / unsure / know (the rest is easy).
  grades: [number, number, number];
  cards: [front: string, back: string, scan?: string][];
};

const DECKS: DeckSeed[] = [
  {
    deck: "Математик",
    introduced: (i) => (i < 7 ? 9 : 8),
    grades: [0.1, 0.2, 0.5],
    cards: [
      ["Квадрат тэгшитгэлийн дискриминантын томьёо", "D = b² − 4ac", "quadratic"],
      ["D < 0 үед квадрат тэгшитгэл хэдэн бодит шийдтэй вэ?", "Бодит шийдгүй", "quadratic"],
      ["D = 0 үед квадрат тэгшитгэл хэдэн шийдтэй вэ?", "Нэг (давхар) шийдтэй", "quadratic"],
      ["Квадрат тэгшитгэлийн шийдийн томьёо", "x = (−b ± √D) / 2a", "quadratic"],
      ["Виетийн теоремоор x₁ + x₂ = ?", "−b/a", "quadratic"],
      ["Виетийн теоремоор x₁ · x₂ = ?", "c/a", "quadratic"],
      ["x² − 5x + 6 = 0 тэгшитгэлийн шийд", "x₁ = 2, x₂ = 3", "quadratic"],
      ["(a + b)² = ?", "a² + 2ab + b²"],
      ["(a − b)(a + b) = ?", "a² − b²"],
      ["Арифметик прогрессийн n дэх гишүүний томьёо", "aₙ = a₁ + (n − 1)d"],
      ["log₂ 32 = ?", "5"],
      ["sin 30° = ?", "1/2"],
      ["Тойргийн талбайн томьёо", "S = πr²"],
    ],
  },
  {
    deck: "Физик",
    introduced: (i) => (i < 5 ? 7 : 6),
    grades: [0.35, 0.3, 0.3],
    cards: [
      [
        "Ньютоны I хууль (инерцийн хууль)",
        "Биед хүч үйлчлэхгүй бол бие тайван эсвэл шулуун жигд хөдөлгөөнөө хадгална",
      ],
      ["Ньютоны II хууль", "F = m · a"],
      [
        "Ньютоны III хууль",
        "Үйлчлэл ба эсрэг үйлчлэл хэмжээгээрээ тэнцүү, чиглэлээрээ эсрэг: F₁₂ = −F₂₁",
      ],
      ["Хүчний СИ нэгж", "Ньютон (Н) = кг · м/с²"],
      [
        "5 кг масстай биед 20 Н хүч үйлчилбэл хурдатгал нь хэд вэ?",
        "a = F/m = 4 м/с²",
        "physicsMidterm",
      ],
      ["Масс 3 кг, хурдатгал 2 м/с² бол хүч нь хэд вэ?", "F = 6 Н", "physicsMidterm"],
      ["72 км/цаг хэдэн м/с вэ?", "20 м/с", "physicsMidterm"],
      ["Кинетик энергийн томьёо", "Eₖ = mv² / 2"],
      ["Чөлөөт уналтын хурдатгал", "g ≈ 9.8 м/с²"],
      ["Хэлхээний хэсгийн Омын хууль", "I = U / R"],
    ],
  },
  {
    deck: "Биологи",
    introduced: (i) => (i < 5 ? 5 : 4),
    grades: [0.05, 0.15, 0.5],
    cards: [
      ["Фотосинтез эсийн аль органоидод явагддаг вэ?", "Хлоропластад", "photosynthesis"],
      ["Фотосинтезийн ерөнхий тэгшитгэл", "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", "photosynthesis"],
      ["Ургамлыг ногоон харагдуулдаг пигмент", "Хлорофилл", "photosynthesis"],
      [
        "Фотосинтезийн гэрлийн үе шатанд ямар хий ялгардаг вэ?",
        "Хүчилтөрөгч (O₂)",
        "photosynthesis",
      ],
      ["Кальвины цикл хлоропластын аль хэсэгт явагддаг вэ?", "Строманд", "photosynthesis"],
      ["Эсийн «энергийн станц» гэж аль органоидыг нэрлэдэг вэ?", "Митохондри"],
      ["ДНХ-ийн бүтцийн нэгж", "Нуклеотид"],
    ],
  },
  {
    deck: "Англи хэл",
    introduced: (i) => (i < 4 ? 2 : null),
    grades: [0.15, 0.25, 0.45],
    cards: [
      ["to postpone", "хойшлуулах"],
      ["reliable", "найдвартай"],
      ["to improve", "сайжруулах"],
      ["although", "хэдийгээр … ч гэсэн"],
      ["I have lived here ___ 2020. (for / since)", "since"],
      ["“go” үйл үгийн V2, V3 хэлбэр", "went, gone"],
      ["Present Perfect цагийн бүтэц", "have/has + V3 (past participle)"],
      ["If I ___ (be) you, I would study more.", "were"],
    ],
  },
];

// Days with a review session (days ago); 3 days ago was skipped on purpose.
const SESSION_DAYS = [9, 8, 7, 6, 5, 4, 2, 1];

const pickGrade = ([forgot, unsure, know]: [number, number, number]): Grade => {
  const roll = random();
  if (roll < forgot) return "forgot";
  if (roll < forgot + unsure) return "unsure";
  if (roll < forgot + unsure + know) return "know";
  return "easy";
};

type CardDoc = {
  _id: string;
  userId: string;
  topicId: string;
  front: string;
  back: string;
  scanIds: string[];
  stability: number;
  lapses: number;
  reviews: number;
  lastReviewedAt: Date | null;
  dueAt: Date;
  createdAt: Date;
};
type NewCardDoc = Omit<CardDoc, "stability" | "lapses" | "reviews" | "lastReviewedAt" | "dueAt">;
type ReviewDoc = {
  _id: string;
  userId: string;
  cardId: string;
  deck: string;
  grade: Grade;
  source: "review" | "quiz";
  at: Date;
};

// Replays the history through the scheduler: every session reviews what was
// due, most forgotten first, like the review page does.
const simulateCards = (
  userId: string,
  scanIds: Map<string, string>,
  exams: Map<string, number>,
) => {
  const cards = DECKS.flatMap(({ deck, introduced, grades, cards: list }) =>
    list.map(([front, back, scan], index) => {
      const ago = introduced(index);
      const createdAt = ago === null ? NOW - 2 * HOUR : studyDay(-ago, "19:00");
      const doc: NewCardDoc = {
        _id: demoId(),
        userId,
        topicId: deck,
        front,
        back,
        scanIds: scan ? [scanIds.get(scan) ?? ""].filter(Boolean) : [],
        createdAt: new Date(createdAt),
      };
      return {
        doc,
        grades,
        state: applyExam(newCard("", deck, createdAt), exams.get(deck) ?? null, createdAt),
      };
    }),
  );
  const reviews: ReviewDoc[] = [];
  const grade = (
    card: (typeof cards)[number],
    value: Grade,
    at: number,
    source: "review" | "quiz",
  ) => {
    card.state = applyExam(review(card.state, value, at), exams.get(card.doc.topicId) ?? null, at);
    reviews.push({
      _id: demoId(),
      userId,
      cardId: card.doc._id,
      deck: card.doc.topicId,
      grade: value,
      source,
      at: new Date(at),
    });
  };

  const sessions = SESSION_DAYS.map((ago) => studyDay(-ago, "19:30"));
  // A short morning round today, when the morning is already over.
  const morning = studyDay(0, "08:10");
  if (morning < NOW - 30 * MINUTE) sessions.push(morning);

  for (const start of sessions) {
    let at = start;
    const live = cards.filter((card) => card.doc.createdAt.getTime() <= start);
    const due = dueCards(
      live.map((card) => ({ ...card.state, id: card.doc._id })),
      start,
    ).slice(0, start === morning ? 6 : 30);
    for (const { id } of due) {
      const card = live.find((item) => item.doc._id === id);
      if (!card) continue;
      grade(card, pickGrade(card.grades), at, "review");
      at += 45_000 + Math.floor(random() * 40_000);
    }
  }

  // Yesterday's quiz on the exam decks: right counts as know, wrong as forgot.
  let at = studyDay(-1, "20:15");
  const quizzed = cards.filter(
    (card) =>
      card.state.reviews > 0 && (card.doc.topicId === "Физик" || card.doc.topicId === "Математик"),
  );
  for (const card of quizzed.filter(() => random() < 0.4).slice(0, 8)) {
    grade(card, random() < 0.7 ? "know" : "forgot", at, "quiz");
    at += 30_000;
  }

  const docs: CardDoc[] = cards.map(({ doc, state }) => ({
    ...doc,
    stability: state.stability,
    lapses: state.lapses,
    reviews: state.reviews,
    lastReviewedAt: state.lastReviewedAt === null ? null : new Date(state.lastReviewedAt),
    dueAt: new Date(state.dueAt),
  }));

  return { cards: docs, reviews };
};

// ------------------------------------------------------------------ planner

const plannerSeed = (prefs: PlannerState["preferences"], examAt: Map<string, number>) => {
  const zone = prefs.timeZone;
  const at = (offset: number, hhmm: string) => plannerAt(zone, offset, hhmm);
  const iso = (time: number) => new Date(time).toISOString();
  // Due in ~22 hours, so its one-day reminder is already in the inbox.
  const essayDue = Math.ceil((NOW + 22 * HOUR) / (30 * MINUTE)) * 30 * MINUTE;
  const tasks: Task[] = [
    {
      id: "demo-task-math",
      title: "Математикийн сорил №3-д бэлдэх",
      subject: "Математик",
      deadline: iso(examAt.get("Математик") ?? at(13, "08:00")),
      minutes: 300,
      priority: 3,
      status: "started",
      reminders: [1440, 60],
    },
    {
      id: "demo-task-physics",
      title: "Физикийн шалгалтад давтах",
      subject: "Физик",
      deadline: iso(examAt.get("Физик") ?? at(3, "08:00")),
      minutes: 150,
      priority: 3,
      status: "started",
      reminders: [1440, 60],
    },
    {
      id: "demo-task-essay",
      title: "Англи хэлний эссэ бичих (120–150 үг)",
      subject: "Англи хэл",
      deadline: iso(essayDue),
      minutes: 50,
      priority: 2,
      status: "todo",
      reminders: [1440, 60, 0],
    },
    {
      id: "demo-task-biology",
      title: "Фотосинтезийн бүлгийг давтах",
      subject: "Биологи",
      deadline: iso(at(-1, "21:00")),
      minutes: 50,
      priority: 2,
      status: "completed",
      reminders: [1440],
    },
    {
      id: "demo-task-history",
      title: "Түүхийн илтгэлийн слайд бэлдэх",
      subject: "Түүх",
      deadline: iso(at(6, "20:00")),
      minutes: 90,
      priority: 1,
      status: "todo",
      reminders: [1440, 60],
    },
  ];

  const blocks: Block[] = [];
  const add = (taskId: string, start: number, status: Block["status"] = "planned") => {
    const end = start + 25 * MINUTE;
    const task = tasks.find((item) => item.id === taskId);
    // Keep every session inside its task's deadline and off the others.
    if (!task || (status === "planned" && (start < NOW || end > Date.parse(task.deadline)))) return;
    if (
      blocks.some(
        (b) => start < Date.parse(b.end) + 5 * MINUTE && end + 5 * MINUTE > Date.parse(b.start),
      )
    ) {
      return;
    }
    blocks.push({
      id: `demo-block-${blocks.length + 1}`,
      taskId,
      start: iso(start),
      end: iso(end),
      status,
      actualMinutes: status === "completed" ? 23 + Math.floor(random() * 4) : 0,
      ...(status === "completed" ? { startedAt: iso(start) } : {}),
      breakMinutes: 5,
    });
  };

  // The last three evenings: finished sessions and one that was missed.
  add("demo-task-math", at(-3, "19:00"), "completed");
  add("demo-task-biology", at(-3, "19:30"), "completed");
  add("demo-task-physics", at(-2, "19:00"), "completed");
  add("demo-task-physics", at(-2, "20:00"), "missed");
  add("demo-task-biology", at(-1, "19:00"), "completed");
  add("demo-task-math", at(-1, "19:30"), "completed");
  // Starts in ~10 minutes: its session reminder is due, the focus card offers it.
  add("demo-task-physics", Math.ceil((NOW + 10 * MINUTE) / (5 * MINUTE)) * 5 * MINUTE);
  add("demo-task-essay", at(0, "20:00"));
  add("demo-task-math", at(0, "20:30"));
  // The coming week.
  add("demo-task-physics", at(1, "18:00"));
  add("demo-task-math", at(1, "18:30"));
  add("demo-task-physics", at(2, "18:00"));
  add("demo-task-math", at(2, "18:30"));
  add("demo-task-math", at(3, "18:00"));
  add("demo-task-history", at(3, "18:30"));
  add("demo-task-math", at(4, "18:00"));
  add("demo-task-history", at(5, "18:00"));
  add("demo-task-math", at(5, "18:30"));

  return { tasks, blocks };
};

const DEFAULT_PREFERENCES: PlannerState["preferences"] = {
  enabled: true,
  quietStart: 22,
  quietEnd: 7,
  timeZone: "Asia/Ulaanbaatar",
  focus: 25,
  dailyLimit: 180,
  sessionReminderMinutes: 15,
  energy: "normal",
};

// ------------------------------------------------------------------ main

type UserDoc = {
  _id: string;
  email?: string;
  username?: string;
  isOwner?: boolean;
  details?: { fullName?: string };
};
// Plugin collections hold string ids (erxes ids), not ObjectIds.
type Doc = { _id: string; [field: string]: unknown };
type PlannerDoc = PlannerState & { _id: string };

const main = async () => {
  if (!env.MONGO_URL) throw new Error("MONGO_URL is not set in the plugin .env");
  await connect(env.MONGO_URL);
  const db = connection.db;
  if (!db) throw new Error("No database connection");
  const dryRun = flag("dry-run");

  // Demo records are recognised by their id, never by owner or content.
  const DEMO = { $regex: "^demo[_-]" };
  const reset = async () => {
    for (const name of [
      "dandar_scans",
      "dandar_study_cards",
      "dandar_study_reviews",
      "dandar_study_exams",
      "dandar_study_settings",
    ]) {
      const { deletedCount } = await db.collection<Doc>(name).deleteMany({ _id: DEMO });
      if (deletedCount) console.log(`  removed ${deletedCount} from ${name}`);
    }
    const planners = db.collection<PlannerDoc>("dandar_planners");
    await planners.deleteMany({ _id: DEMO });
    const { modifiedCount } = await planners.updateMany(
      { $or: [{ "tasks.id": DEMO }, { "blocks.id": DEMO }] },
      {
        $pull: {
          tasks: { id: DEMO },
          blocks: { id: DEMO },
          snoozed: { id: { $regex: "demo-" } },
          delivered: { $regex: "demo-" },
          dismissed: { $regex: "demo-" },
        },
        $inc: { version: 1 },
      },
    );
    if (modifiedCount) console.log(`  removed demo tasks from ${modifiedCount} planner(s)`);
  };

  if (flag("reset")) {
    console.log("Removing demo data…");
    if (!dryRun) await reset();
    await disconnect();
    return;
  }

  const users = db.collection<UserDoc>("users");
  const studentEmail = option("student");
  const teacherEmail = option("teacher");
  const student = studentEmail
    ? await users.findOne({ email: studentEmail })
    : await users.findOne({ isOwner: true });
  if (!student) throw new Error(`No erxes user ${studentEmail ?? "(owner)"}`);
  const teacher = teacherEmail ? await users.findOne({ email: teacherEmail }) : student;
  if (!teacher) throw new Error(`No erxes user ${teacherEmail}`);
  const name = (user: UserDoc) => user.details?.fullName || user.email || user.username || user._id;
  console.log(
    `Student: ${name(student)}\nTeacher: ${name(teacher)}${teacher === student ? " (same account)" : ""}`,
  );

  const examAt = new Map([
    ["Физик", studyDay(3, "08:00")],
    ["Математик", examDate("2026-11-06", 13)],
    ["Англи хэл", examDate("2026-11-14", 21)],
  ]);

  // Scans
  const scanIds = new Map<string, string>();
  const scans = SCANS.map((scan) => {
    const _id = demoId();
    scanIds.set(scan.key, _id);
    const createdAt = new Date(NOW - scan.ago);
    const sent = scan.status === "sent" || scan.status === "reviewed";
    return {
      _id,
      studentId: student._id,
      ...(sent
        ? { teacherId: teacher._id, sentAt: new Date(createdAt.getTime() + 5 * MINUTE) }
        : {}),
      fileName: scan.file,
      mimeType: "image/jpeg",
      imageData: readFileSync(join(__dirname, "../../../demo/scans", scan.file)).toString("base64"),
      text: scan.text,
      kind: scan.kind,
      title: scan.title,
      subject: scan.subject,
      ...(scan.summary ? { summary: scan.summary } : {}),
      status: scan.status,
      ...(scan.teacherComment
        ? {
            teacherComment: scan.teacherComment,
            reviewedAt: new Date(createdAt.getTime() + DAY_MS),
          }
        : {}),
      createdAt,
    };
  });

  const { cards, reviews } = simulateCards(student._id, scanIds, examAt);

  // Exams: a deck that already has the student's own exam keeps it.
  const existingExams = new Set(
    (
      await db
        .collection<Doc>("dandar_study_exams")
        .find({ userId: student._id, _id: { $not: /^demo_/ } })
        .toArray()
    ).map((exam) => String(exam.deck)),
  );
  const exams = [...examAt]
    .filter(([deck]) => !existingExams.has(deck))
    .map(([deck, at]) => ({ _id: demoId(), userId: student._id, deck, examAt: new Date(at) }));

  const hasSettings = await db
    .collection("dandar_study_settings")
    .findOne({ userId: student._id, _id: { $not: /^demo_/ } });

  const planners = db.collection<PlannerDoc>("dandar_planners");
  const ownPlanner = await planners.findOne({ userId: student._id, _id: { $not: /^demo_/ } });
  const preferences = ownPlanner?.preferences ?? DEFAULT_PREFERENCES;
  const planner = plannerSeed(preferences, examAt);

  const due = cards.filter((card) => card.dueAt.getTime() <= NOW);
  const recent = reviews.filter((item) => item.at.getTime() > NOW - 7 * DAY_MS);
  console.log(
    [
      `Scans: ${scans.length} (3 notes, 3 exam papers: sent, reviewed, waiting for a teacher)`,
      `Cards: ${cards.length} in ${DECKS.length} decks; due now ${due.length} (${due.filter((c) => c.reviews === 0).length} new)`,
      `Review history: ${reviews.length} grades, ${recent.length} in the last 7 days`,
      `Exams: ${exams.map((e) => `${e.deck} ${e.examAt.toISOString().slice(0, 10)}`).join(", ") || "kept the student's own"}`,
      `Planner: ${planner.tasks.length} tasks, ${planner.blocks.length} sessions (${planner.blocks.filter((b) => b.status === "planned").length} planned)`,
      `Reminder settings: ${hasSettings ? "kept the student's own" : "19:00, quiet 22:00–07:00"}`,
    ].join("\n"),
  );
  if (dryRun) {
    await disconnect();
    return;
  }

  console.log("\nReplacing the previous demo data…");
  await reset();
  await db.collection<Doc>("dandar_scans").insertMany(scans);
  await db.collection<Doc>("dandar_study_cards").insertMany(cards);
  await db.collection<Doc>("dandar_study_reviews").insertMany(reviews);
  if (exams.length) await db.collection<Doc>("dandar_study_exams").insertMany(exams);
  if (!hasSettings) {
    await db.collection<Doc>("dandar_study_settings").insertOne({
      _id: demoId(),
      userId: student._id,
      reviewReminder: true,
      reminderHour: 19,
      examAlerts: true,
      quietStart: 22,
      quietEnd: 7,
    });
  }
  if (ownPlanner) {
    await planners.updateOne(
      { _id: ownPlanner._id },
      {
        $push: { tasks: { $each: planner.tasks }, blocks: { $each: planner.blocks } },
        $inc: { version: 1 },
      },
    );
  } else {
    await planners.insertOne({
      _id: demoId(),
      userId: student._id,
      version: 1,
      tasks: planner.tasks,
      blocks: planner.blocks,
      preferences,
      delivered: [],
      dismissed: [],
      snoozed: [],
      availability: [],
      dayLimits: {},
    });
  }
  console.log("Done. Open /dandar, /dandar/scans and /dandar/study in erxes.");
  await disconnect();
};

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
  await disconnect();
});
