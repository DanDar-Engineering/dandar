import { gql } from "graphql-tag";
import type { Context } from "../connectionResolvers.ts";
import { type AiImage, askGemma } from "../modules/ai/gemma.ts";
import {
  CARD_COUNT,
  CARD_KINDS,
  CARD_LANGS,
  CARD_LEVELS,
  CARD_TEXT_MAX_LENGTH,
  type CardOptions,
  DECK_MAX_LENGTH,
  FOCUS_MAX_LENGTH,
  HELP_MODES,
  HELP_SYSTEM_PROMPT,
  INSTRUCTIONS_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  type DraftSource,
  cardSystemPrompt,
  mergeDrafts,
  parseDraft,
} from "../modules/study/cardGen.ts";
import type { IStudyCardDocument } from "../modules/study/db/definitions/study.ts";
import {
  type CardState,
  type Grade,
  TARGET_ROUNDS,
  applyExam,
  dueCards,
  examProgress,
  newCard,
  retrievabilityOf,
  review,
  topicMastery,
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
  isQuietHour,
} from "../modules/study/logic/learning.ts";
import { STUDY_READ, STUDY_WRITE } from "../permissions.ts";
import { RECORD_ID, assertPage, badInput, requireTenantUser, toAiError } from "./guards.ts";
import { assertImage } from "./scan.ts";

export const studyTypeDefs = gql`
  enum DandarCardLevel {
    easy
    medium
    hard
  }

  enum DandarCardKind {
    qa
    cloze
    term
  }

  enum DandarCardLang {
    auto
    mn
    en
  }

  enum DandarCardGrade {
    forgot
    unsure
    know
    easy
  }

  enum DandarCardHelpMode {
    hint
    explain
    mnemonic
  }

  "How soon the card comes back for each grade, in minutes"
  type DandarCardPreview {
    forgot: Float!
    unsure: Float!
    know: Float!
    easy: Float!
  }

  type DandarStudyCard {
    _id: String!
    "The deck; also the topic mastery is grouped by"
    deck: String!
    front: String!
    back: String!
    "dandar_scans _ids the card was generated from"
    scanIds: [String!]!
    reviews: Int!
    stability: Float!
    "Estimated chance the student still remembers it, 0–100"
    retention: Int!
    dueAt: String!
    "Only dandarDueCards fills this"
    preview: DandarCardPreview
  }

  type DandarStudyCounts {
    newCards: Int!
    dueCards: Int!
    total: Int!
    "When the next card comes due, if none is due now"
    nextDueAt: String
  }

  type DandarDeckMastery {
    deck: String!
    cards: Int!
    "0–100"
    mastery: Int!
    weak: Boolean!
  }

  type DandarExam {
    deck: String!
    examAt: String!
    cards: Int!
    daysLeft: Int!
    "Chance the student remembers the deck on exam day, 0–100"
    readiness: Int!
    "Share of the target review rounds done, 0–100"
    rounds: Int!
    targetRounds: Int!
  }

  "A card Gemma proposed; nothing is stored until dandarCardsSave"
  type DandarCardDraftCard {
    front: String!
    back: String!
  }

  type DandarCardDraft {
    deck: String!
    "YYYY-MM-DD when the material states an exam date"
    examDate: String
    cards: [DandarCardDraftCard!]!
    "True when exam material was turned into new practice questions; the student should check the answers"
    examMode: Boolean!
  }

  input DandarCardOptionsInput {
    count: Int = 8
    level: DandarCardLevel = medium
    kind: DandarCardKind = qa
    lang: DandarCardLang = auto
    focus: String
    instructions: String
  }

  input DandarCardInput {
    front: String!
    back: String!
  }

  type DandarStudySettings {
    reviewReminder: Boolean!
    "Local hour 0–23 the daily review and exam reminders go out"
    reminderHour: Int!
    examAlerts: Boolean!
    "No notifications from quietStart until quietEnd (local hours)"
    quietStart: Int!
    quietEnd: Int!
  }

  input DandarStudySettingsInput {
    reviewReminder: Boolean!
    reminderHour: Int!
    examAlerts: Boolean!
    quietStart: Int!
    quietEnd: Int!
  }

  "How many of the student's cards came from one scan"
  type DandarScanCardCount {
    scanId: String!
    cards: Int!
  }

  extend type Query {
    dandarStudyCounts: DandarStudyCounts!
    "Cards due now, the most forgotten first"
    dandarDueCards(limit: Int = 20): [DandarStudyCard!]!
    "search matches the front or back, ignoring case"
    dandarStudyCards(
      deck: String
      search: String
      limit: Int = 20
      offset: Int = 0
    ): [DandarStudyCard!]!
    dandarDeckMastery: [DandarDeckMastery!]!
    dandarExams: [DandarExam!]!
    dandarStudySettings: DandarStudySettings!
    dandarScanCardCounts: [DandarScanCardCount!]!
  }

  extend type Mutation {
    dandarCardAdd(deck: String!, front: String!, back: String!): DandarStudyCard!
    dandarCardDelete(_id: String!): Boolean!
    dandarCardReview(_id: String!, grade: DandarCardGrade!): DandarStudyCard!
    "Gemma 4 proposes cards from notes, a photo or up to 5 saved scans; nothing is stored"
    dandarCardsDraft(
      notes: String
      scanIds: [String!]
      "Send each scan's stored photo with its text (better for diagrams and formulas, slower)"
      useScanImages: Boolean = false
      mimeType: String
      imageData: String
      options: DandarCardOptionsInput
    ): DandarCardDraft!
    "Stores the cards the student checked; a given examDate also schedules the deck"
    dandarCardsSave(
      deck: String!
      cards: [DandarCardInput!]!
      examDate: String
      scanIds: [String!]
    ): [DandarStudyCard!]!
    dandarExamSet(deck: String!, date: String!): DandarExam!
    dandarExamDelete(deck: String!): Boolean!
    dandarCardHelp(_id: String!, mode: DandarCardHelpMode!): String!
    dandarStudySettingsSave(input: DandarStudySettingsInput!): DandarStudySettings!
    dandarCardUpdate(_id: String!, deck: String!, front: String!, back: String!): DandarStudyCard!
    "Moves every card (and the exam) of a deck to a new name; returns the cards moved"
    dandarDeckRename(from: String!, to: String!): Int!
    "Deletes a deck's cards and exam; returns the cards deleted"
    dandarDeckDelete(deck: String!): Int!
  }
`;

const MAX_SAVED_CARDS = 30;
const MAX_CARDS_READ = 5000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GRADES: Grade[] = ["forgot", "unsure", "know", "easy"];

export const toState = (card: IStudyCardDocument): CardState => ({
  id: String(card._id),
  topicId: card.topicId,
  stability: card.stability,
  lapses: card.lapses,
  reviews: card.reviews,
  lastReviewedAt: card.lastReviewedAt ? card.lastReviewedAt.getTime() : null,
  dueAt: card.dueAt.getTime(),
});

export const examTimes = async (context: Context, userId: string) => {
  const exams = await context.models.StudyExams.find({ userId })
    .limit(200)
    .lean<{ deck: string; examAt: Date }[]>();

  return new Map(exams.map((exam) => [exam.deck, exam.examAt.getTime()]));
};

export const toCardOutput = (
  card: IStudyCardDocument,
  now: number,
  exams?: Map<string, number>,
) => {
  const state = toState(card);
  const examAt = exams?.get(card.topicId) ?? null;

  return {
    _id: String(card._id),
    deck: card.topicId,
    front: card.front,
    back: card.back,
    scanIds: card.scanIds ?? [],
    reviews: card.reviews,
    stability: card.stability,
    retention: Math.round(retrievabilityOf(state, now) * 100),
    dueAt: card.dueAt.toISOString(),
    preview: exams
      ? Object.fromEntries(
          GRADES.map((grade) => [
            grade,
            (applyExam(review(state, grade, now), examAt, now).dueAt - now) / 60_000,
          ]),
        )
      : null,
  };
};

const toExamOutput = async (context: Context, userId: string, deck: string, examAt: number) => {
  const docs = await context.models.StudyCards.find({ userId, topicId: deck })
    .limit(MAX_CARDS_READ)
    .lean<IStudyCardDocument[]>();

  return {
    deck,
    examAt: new Date(examAt).toISOString(),
    cards: docs.length,
    ...examProgress(docs.map(toState), examAt, Date.now()),
    targetRounds: TARGET_ROUNDS,
  };
};

const cleanText = (value: string, label: string, max = CARD_TEXT_MAX_LENGTH) => {
  const text = value.trim();
  if (!text || text.length > max) {
    throw badInput(`${label} 1–${max} тэмдэгт байна`);
  }

  return text;
};

const cleanDeck = (value: string) => cleanText(value, "Багцын нэр", DECK_MAX_LENGTH);

export const assertRecordId = (value: string, label: string) => {
  if (!RECORD_ID.test(value)) {
    throw badInput(`${label} буруу байна`);
  }
};

const examTimestamp = (date: string) => {
  const at = DATE.test(date) ? Date.parse(`${date}T08:00:00`) : NaN;
  if (!Number.isFinite(at) || at <= Date.now()) {
    throw badInput("Ирээдүйн огноо сонгоно уу (ЖЖЖЖ-СС-ӨӨ)");
  }

  return at;
};

type OptionsInput = {
  count?: number | null;
  level?: CardOptions["level"] | null;
  kind?: CardOptions["kind"] | null;
  lang?: CardOptions["lang"] | null;
  focus?: string | null;
  instructions?: string | null;
};

const toCardOptions = (input: OptionsInput | null | undefined): CardOptions => {
  const count = input?.count ?? CARD_COUNT.default;
  if (!Number.isInteger(count) || count < CARD_COUNT.min || count > CARD_COUNT.max) {
    throw badInput(`Картын тоо ${CARD_COUNT.min}–${CARD_COUNT.max} байна`);
  }
  const focus = input?.focus?.trim() ?? "";
  const instructions = input?.instructions?.trim() ?? "";
  if (focus.length > FOCUS_MAX_LENGTH || instructions.length > INSTRUCTIONS_MAX_LENGTH) {
    throw badInput("Онцлох сэдэв эсвэл нэмэлт хүсэлт хэт урт байна");
  }

  return {
    count,
    level: input?.level && CARD_LEVELS.includes(input.level) ? input.level : "medium",
    kind: input?.kind && CARD_KINDS.includes(input.kind) ? input.kind : "qa",
    lang: input?.lang && CARD_LANGS.includes(input.lang) ? input.lang : "auto",
    focus,
    instructions,
  };
};

const MAX_DRAFT_SCANS = 5;

// A student may generate cards only from material they uploaded themselves.
const ownScan = async (context: Context, userId: string, scanId: string) => {
  assertRecordId(scanId, "scanId");
  const scan = await context.models.Scans.findVisible(scanId, userId);
  if (!scan || scan.studentId !== userId) {
    throw badInput("Материал олдсонгүй");
  }

  return scan;
};

const ownScans = async (context: Context, userId: string, scanIds: string[] | null | undefined) => {
  const ids = [...new Set(scanIds ?? [])];
  if (ids.length > MAX_DRAFT_SCANS) {
    throw badInput(`Нэг дор ${MAX_DRAFT_SCANS} хүртэл материал сонгоно уу`);
  }

  return Promise.all(ids.map((id) => ownScan(context, userId, id)));
};

const HOUR = (value: number, label: string) => {
  if (!Number.isInteger(value) || value < 0 || value > 23) {
    throw badInput(`${label} 0–23 цагийн хооронд байна`);
  }

  return value;
};

type PageArgs = { limit?: number; offset?: number };

export const studyResolvers = {
  Query: {
    dandarStudyCounts: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      const now = new Date();
      const [total, due, fresh] = await Promise.all([
        context.models.StudyCards.countDocuments({ userId }),
        context.models.StudyCards.countDocuments({
          userId,
          dueAt: { $lte: now },
          reviews: { $gt: 0 },
        }),
        context.models.StudyCards.countDocuments({ userId, dueAt: { $lte: now }, reviews: 0 }),
      ]);

      const next =
        due + fresh === 0
          ? await context.models.StudyCards.findOne({ userId }, { dueAt: 1 })
              .sort({ dueAt: 1 })
              .lean<{ dueAt: Date }>()
          : null;

      return {
        total,
        dueCards: due,
        newCards: fresh,
        nextDueAt: next?.dueAt.toISOString() ?? null,
      };
    },
    dandarDueCards: async (_parent: unknown, { limit = 20 }: PageArgs, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      assertPage(limit, 0);
      const now = Date.now();
      const docs = await context.models.StudyCards.find({ userId, dueAt: { $lte: new Date(now) } })
        .limit(500)
        .lean<IStudyCardDocument[]>();
      const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
      const exams = await examTimes(context, userId);

      return dueCards(docs.map(toState), now)
        .slice(0, limit)
        .flatMap((state) => byId.get(state.id) ?? [])
        .map((doc) => toCardOutput(doc, now, exams));
    },
    dandarStudyCards: async (
      _parent: unknown,
      {
        deck,
        search,
        limit = 20,
        offset = 0,
      }: PageArgs & { deck?: string | null; search?: string | null },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      assertPage(limit, offset);
      const term = search?.trim().slice(0, 100) ?? "";
      const pattern = term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
      const docs = await context.models.StudyCards.find({
        userId,
        ...(deck ? { topicId: deck } : {}),
        ...(pattern ? { $or: [{ front: pattern }, { back: pattern }] } : {}),
      })
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean<IStudyCardDocument[]>();
      const now = Date.now();

      return docs.map((doc) => toCardOutput(doc, now));
    },
    dandarDeckMastery: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      const docs = await context.models.StudyCards.find({ userId })
        .limit(MAX_CARDS_READ)
        .lean<IStudyCardDocument[]>();
      const counts = new Map<string, number>();
      for (const doc of docs) counts.set(doc.topicId, (counts.get(doc.topicId) ?? 0) + 1);

      return topicMastery(docs.map(toState), Date.now()).map((topic) => ({
        deck: topic.topicId,
        cards: counts.get(topic.topicId) ?? 0,
        mastery: Math.round(topic.mastery * 100),
        weak: topic.weak,
      }));
    },
    dandarStudySettings: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      const stored = await context.models.StudySettings.findOne({
        userId,
      }).lean<ReminderSettings>();

      return stored ?? DEFAULT_REMINDER_SETTINGS;
    },
    dandarScanCardCounts: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      const rows = await context.models.StudyCards.aggregate<{ _id: string; cards: number }>([
        { $match: { userId, "scanIds.0": { $exists: true } } },
        { $unwind: "$scanIds" },
        { $group: { _id: "$scanIds", cards: { $sum: 1 } } },
        { $limit: 1000 },
      ]);

      return rows.map((row) => ({ scanId: row._id, cards: row.cards }));
    },
    dandarExams: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      const exams = await examTimes(context, userId);

      return Promise.all([...exams].map(([deck, at]) => toExamOutput(context, userId, deck, at)));
    },
  },
  Mutation: {
    dandarCardAdd: async (
      _parent: unknown,
      args: { deck: string; front: string; back: string },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const deck = cleanDeck(args.deck);
      const now = Date.now();
      const exams = await examTimes(context, userId);
      const state = applyExam(newCard("", deck, now), exams.get(deck) ?? null, now);
      const doc = await context.models.StudyCards.create({
        userId,
        topicId: deck,
        front: cleanText(args.front, "Асуулт"),
        back: cleanText(args.back, "Хариулт"),
        stability: state.stability,
        dueAt: new Date(state.dueAt),
      });

      return toCardOutput(doc.toObject(), now);
    },
    dandarCardDelete: async (_parent: unknown, { _id }: { _id: string }, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      assertRecordId(_id, "_id");

      return (await context.models.StudyCards.deleteOne({ _id, userId })).deletedCount === 1;
    },
    dandarCardReview: async (
      _parent: unknown,
      { _id, grade }: { _id: string; grade: Grade },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      assertRecordId(_id, "_id");
      if (!GRADES.includes(grade)) throw badInput("Үнэлгээ буруу байна");
      const doc = await context.models.StudyCards.findOne({ _id, userId });
      if (!doc) throw badInput("Карт олдсонгүй");

      const now = Date.now();
      const exams = await examTimes(context, userId);
      const next = applyExam(review(toState(doc), grade, now), exams.get(doc.topicId) ?? null, now);
      doc.set({
        stability: next.stability,
        lapses: next.lapses,
        reviews: next.reviews,
        lastReviewedAt: new Date(next.lastReviewedAt ?? now),
        dueAt: new Date(next.dueAt),
      });
      await Promise.all([
        doc.save(),
        context.models.StudyReviews.create({
          userId,
          cardId: _id,
          deck: doc.topicId,
          grade,
          source: "review",
          at: new Date(now),
        }),
      ]);

      return toCardOutput(doc.toObject(), now);
    },
    dandarCardsDraft: async (
      _parent: unknown,
      args: {
        notes?: string | null;
        scanIds?: string[] | null;
        useScanImages?: boolean | null;
        mimeType?: string | null;
        imageData?: string | null;
        options?: OptionsInput | null;
      },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const options = toCardOptions(args.options);

      const notes = args.notes?.trim() ?? "";
      if (notes.length > NOTES_MAX_LENGTH) {
        throw badInput(`Тэмдэглэл ${NOTES_MAX_LENGTH} тэмдэгтээс хэтрэхгүй байна`);
      }
      let upload: AiImage | undefined;
      if (args.mimeType || args.imageData) {
        assertImage(args.mimeType ?? "", args.imageData ?? "");
        upload = { mimeType: args.mimeType ?? "", data: args.imageData ?? "" };
      }
      const scans = await ownScans(context, userId, args.scanIds);
      const scanText = (scan: (typeof scans)[number]) => `${scan.title}\n${scan.text}`;

      // askGemma takes one photo, so each scan sent with its photo is its own
      // call. Exam papers always get their own call: they use the practice
      // rules (new questions of the same kind, never their own answers).
      type Call = { notes: string; image?: AiImage; source: DraftSource };
      const calls: Call[] = [];
      if (args.useScanImages) {
        for (const scan of scans) {
          calls.push({
            notes: scanText(scan),
            image: { mimeType: scan.mimeType, data: scan.imageData },
            source: { mode: scan.kind === "exam" ? "exam" : "notes", withImage: true },
          });
        }
        if (notes || upload)
          calls.push({ notes, image: upload, source: { mode: "notes", withImage: false } });
      } else {
        const plain = [notes, ...scans.filter((scan) => scan.kind !== "exam").map(scanText)]
          .filter(Boolean)
          .join("\n\n");
        if (plain || upload)
          calls.push({ notes: plain, image: upload, source: { mode: "notes", withImage: false } });
        const exams = scans.filter((scan) => scan.kind === "exam");
        if (exams.length) {
          calls.push({
            notes: exams.map(scanText).join("\n\n"),
            source: { mode: "exam", withImage: false },
          });
        }
      }
      if (!calls.length) throw badInput("Тэмдэглэл бичих, зураг оруулах эсвэл уншуулсан материал сонгоно уу");

      const perCall = Math.max(CARD_COUNT.min, Math.ceil(options.count / calls.length));
      const settled = await Promise.allSettled(
        calls.map(async (call) => {
          const material = call.notes.slice(0, NOTES_MAX_LENGTH);
          const { text } = await askGemma(
            material ? `Материал:\n"""\n${material}\n"""` : "Хавсаргасан зургаас карт гарга.",
            cardSystemPrompt({ ...options, count: perCall }, call.source),
            { image: call.image, temperature: 0.3 },
          );
          return parseDraft(text);
        }),
      );
      const drafts = settled.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      // One failed call (say, a slow photo) still returns the other cards.
      const failure = settled.find((result) => result.status === "rejected");
      if (!drafts.length && failure?.status === "rejected") throw toAiError(failure.reason);

      const draft = mergeDrafts(drafts, MAX_SAVED_CARDS);
      if (!draft.cards.length) {
        throw badInput("Gemma энэ материалаас карт гаргаж чадсангүй. Дахин оролдоно уу.");
      }
      const scanDeck = scans[0] ? scans[0].subject || scans[0].title : "";

      return {
        ...draft,
        deck: draft.deck || scanDeck.slice(0, DECK_MAX_LENGTH),
        examMode: calls.some((call) => call.source.mode === "exam"),
      };
    },
    dandarCardsSave: async (
      _parent: unknown,
      args: {
        deck: string;
        cards: { front: string; back: string }[];
        examDate?: string | null;
        scanIds?: string[] | null;
      },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const deck = cleanDeck(args.deck);
      if (args.cards.length < 1 || args.cards.length > MAX_SAVED_CARDS) {
        throw badInput(`Нэг дор 1–${MAX_SAVED_CARDS} карт хадгална`);
      }
      const cards = args.cards.map((card) => ({
        front: cleanText(card.front, "Асуулт"),
        back: cleanText(card.back, "Хариулт"),
      }));
      const scanIds = (await ownScans(context, userId, args.scanIds)).map((scan) => scan._id);

      const now = Date.now();
      if (args.examDate) {
        const examAt = examTimestamp(args.examDate);
        await context.models.StudyExams.updateOne(
          { userId, deck },
          { $set: { examAt: new Date(examAt) } },
          { upsert: true },
        );
      }
      const exams = await examTimes(context, userId);
      const examAt = exams.get(deck) ?? null;
      const created = await context.models.StudyCards.insertMany(
        cards.map((card) => {
          const state = applyExam(newCard("", deck, now), examAt, now);
          return {
            userId,
            topicId: deck,
            ...card,
            scanIds,
            stability: state.stability,
            dueAt: new Date(state.dueAt),
          };
        }),
      );
      // A new exam date also reschedules the cards the deck already had.
      if (args.examDate && examAt) {
        const existing = await context.models.StudyCards.find({ userId, topicId: deck }).limit(
          MAX_CARDS_READ,
        );
        await Promise.all(
          existing.map((doc) => {
            doc.set({ dueAt: new Date(applyExam(toState(doc), examAt, now).dueAt) });
            return doc.save();
          }),
        );
      }

      return created.map((doc) => toCardOutput(doc.toObject(), now));
    },
    dandarExamSet: async (
      _parent: unknown,
      { deck, date }: { deck: string; date: string },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const name = cleanDeck(deck);
      const examAt = examTimestamp(date);
      if (!(await context.models.StudyCards.exists({ userId, topicId: name }))) {
        throw badInput("Багц олдсонгүй");
      }
      await context.models.StudyExams.updateOne(
        { userId, deck: name },
        { $set: { examAt: new Date(examAt) } },
        { upsert: true },
      );
      const now = Date.now();
      const docs = await context.models.StudyCards.find({ userId, topicId: name }).limit(
        MAX_CARDS_READ,
      );
      await Promise.all(
        docs.map((doc) => {
          doc.set({ dueAt: new Date(applyExam(toState(doc), examAt, now).dueAt) });
          return doc.save();
        }),
      );

      return toExamOutput(context, userId, name, examAt);
    },
    dandarExamDelete: async (_parent: unknown, { deck }: { deck: string }, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);

      return (
        (await context.models.StudyExams.deleteOne({ userId, deck: cleanDeck(deck) }))
          .deletedCount === 1
      );
    },
    dandarStudySettingsSave: async (
      _parent: unknown,
      { input }: { input: ReminderSettings },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const settings: ReminderSettings = {
        reviewReminder: input.reviewReminder,
        reminderHour: HOUR(input.reminderHour, "Сануулах цаг"),
        examAlerts: input.examAlerts,
        quietStart: HOUR(input.quietStart, "Чимээгүй цагийн эхлэл"),
        quietEnd: HOUR(input.quietEnd, "Чимээгүй цагийн төгсгөл"),
      };
      if (isQuietHour(settings.reminderHour, settings.quietStart, settings.quietEnd)) {
        throw badInput("Сануулах цаг чимээгүй цаг дотор байна. Өөр цаг сонгоно уу");
      }
      await context.models.StudySettings.updateOne(
        { userId },
        { $set: settings },
        { upsert: true },
      );

      return settings;
    },
    dandarCardUpdate: async (
      _parent: unknown,
      args: { _id: string; deck: string; front: string; back: string },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      assertRecordId(args._id, "_id");
      const doc = await context.models.StudyCards.findOneAndUpdate(
        { _id: args._id, userId },
        {
          $set: {
            topicId: cleanDeck(args.deck),
            front: cleanText(args.front, "Асуулт"),
            back: cleanText(args.back, "Хариулт"),
          },
        },
        { new: true },
      ).lean<IStudyCardDocument>();
      if (!doc) throw badInput("Карт олдсонгүй");

      return toCardOutput(doc, Date.now());
    },
    dandarDeckRename: async (
      _parent: unknown,
      args: { from: string; to: string },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const from = cleanDeck(args.from);
      const to = cleanDeck(args.to);
      if (from === to) return 0;
      // The target deck's own exam wins; otherwise the renamed deck keeps its exam.
      const [moved] = await Promise.all([
        context.models.StudyCards.updateMany({ userId, topicId: from }, { $set: { topicId: to } }),
        (async () => {
          if (await context.models.StudyExams.exists({ userId, deck: to })) {
            await context.models.StudyExams.deleteOne({ userId, deck: from });
          } else {
            await context.models.StudyExams.updateOne(
              { userId, deck: from },
              { $set: { deck: to } },
            );
          }
        })(),
      ]);

      return moved.modifiedCount;
    },
    dandarDeckDelete: async (_parent: unknown, { deck }: { deck: string }, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const name = cleanDeck(deck);
      const [deleted] = await Promise.all([
        context.models.StudyCards.deleteMany({ userId, topicId: name }),
        context.models.StudyExams.deleteOne({ userId, deck: name }),
      ]);

      return deleted.deletedCount;
    },
    dandarCardHelp: async (
      _parent: unknown,
      { _id, mode }: { _id: string; mode: (typeof HELP_MODES)[number] },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      assertRecordId(_id, "_id");
      if (!HELP_MODES.includes(mode)) throw badInput("Тусламжийн төрөл буруу байна");
      const doc = await context.models.StudyCards.findOne({
        _id,
        userId,
      }).lean<IStudyCardDocument>();
      if (!doc) throw badInput("Карт олдсонгүй");

      try {
        return (
          await askGemma(
            `mode=${mode}\nАсуулт: ${doc.front}\nХариу: ${doc.back}`,
            HELP_SYSTEM_PROMPT,
            {
              temperature: 0.4,
            },
          )
        ).text;
      } catch (error) {
        throw toAiError(error);
      }
    },
  },
};
