import { gql } from "graphql-tag";
import type { Context } from "../connectionResolvers.ts";
import { askGemma } from "../modules/ai/gemma.ts";
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
  cardSystemPrompt,
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
    "dandar_scans _id the card was generated from"
    scanId: String
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

  extend type Query {
    dandarStudyCounts: DandarStudyCounts!
    "Cards due now, the most forgotten first"
    dandarDueCards(limit: Int = 20): [DandarStudyCard!]!
    dandarStudyCards(deck: String, limit: Int = 20, offset: Int = 0): [DandarStudyCard!]!
    dandarDeckMastery: [DandarDeckMastery!]!
    dandarExams: [DandarExam!]!
  }

  extend type Mutation {
    dandarCardAdd(deck: String!, front: String!, back: String!): DandarStudyCard!
    dandarCardDelete(_id: String!): Boolean!
    dandarCardReview(_id: String!, grade: DandarCardGrade!): DandarStudyCard!
    "Gemma 4 proposes cards from notes, a photo or a saved scan; nothing is stored"
    dandarCardsDraft(
      notes: String
      scanId: String
      mimeType: String
      imageData: String
      options: DandarCardOptionsInput
    ): DandarCardDraft!
    "Stores the cards the student checked; a given examDate also schedules the deck"
    dandarCardsSave(
      deck: String!
      cards: [DandarCardInput!]!
      examDate: String
      scanId: String
    ): [DandarStudyCard!]!
    dandarExamSet(deck: String!, date: String!): DandarExam!
    dandarExamDelete(deck: String!): Boolean!
    dandarCardHelp(_id: String!, mode: DandarCardHelpMode!): String!
  }
`;

const MAX_SAVED_CARDS = 30;
const MAX_CARDS_READ = 5000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GRADES: Grade[] = ["forgot", "unsure", "know", "easy"];

const toState = (card: IStudyCardDocument): CardState => ({
  id: String(card._id),
  topicId: card.topicId,
  stability: card.stability,
  lapses: card.lapses,
  reviews: card.reviews,
  lastReviewedAt: card.lastReviewedAt ? card.lastReviewedAt.getTime() : null,
  dueAt: card.dueAt.getTime(),
});

const examTimes = async (context: Context, userId: string) => {
  const exams = await context.models.StudyExams.find({ userId })
    .limit(200)
    .lean<{ deck: string; examAt: Date }[]>();

  return new Map(exams.map((exam) => [exam.deck, exam.examAt.getTime()]));
};

const toCardOutput = (card: IStudyCardDocument, now: number, exams?: Map<string, number>) => {
  const state = toState(card);
  const examAt = exams?.get(card.topicId) ?? null;

  return {
    _id: String(card._id),
    deck: card.topicId,
    front: card.front,
    back: card.back,
    scanId: card.scanId ?? null,
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
    throw badInput(`${label} must be 1–${max} characters`);
  }

  return text;
};

const cleanDeck = (value: string) => cleanText(value, "Deck", DECK_MAX_LENGTH);

const assertRecordId = (value: string, label: string) => {
  if (!RECORD_ID.test(value)) {
    throw badInput(`Invalid ${label}`);
  }
};

const examTimestamp = (date: string) => {
  const at = DATE.test(date) ? Date.parse(`${date}T08:00:00`) : NaN;
  if (!Number.isFinite(at) || at <= Date.now()) {
    throw badInput("Use a future date as YYYY-MM-DD");
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
    throw badInput(`Card count must be ${CARD_COUNT.min}–${CARD_COUNT.max}`);
  }
  const focus = input?.focus?.trim() ?? "";
  const instructions = input?.instructions?.trim() ?? "";
  if (focus.length > FOCUS_MAX_LENGTH || instructions.length > INSTRUCTIONS_MAX_LENGTH) {
    throw badInput("Focus or instructions are too long");
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

// A student may generate cards only from material they uploaded themselves.
const ownScan = async (context: Context, userId: string, scanId: string) => {
  assertRecordId(scanId, "scanId");
  const scan = await context.models.Scans.findVisible(scanId, userId);
  if (!scan || scan.studentId !== userId) {
    throw badInput("Material not found");
  }

  return scan;
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

      return { total, dueCards: due, newCards: fresh };
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
      { deck, limit = 20, offset = 0 }: PageArgs & { deck?: string | null },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      assertPage(limit, offset);
      const docs = await context.models.StudyCards.find({
        userId,
        ...(deck ? { topicId: deck } : {}),
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
        front: cleanText(args.front, "Front"),
        back: cleanText(args.back, "Back"),
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
      if (!GRADES.includes(grade)) throw badInput("Unknown grade");
      const doc = await context.models.StudyCards.findOne({ _id, userId });
      if (!doc) throw badInput("Card not found");

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
      await doc.save();

      return toCardOutput(doc.toObject(), now);
    },
    dandarCardsDraft: async (
      _parent: unknown,
      args: {
        notes?: string | null;
        scanId?: string | null;
        mimeType?: string | null;
        imageData?: string | null;
        options?: OptionsInput | null;
      },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const options = toCardOptions(args.options);

      let notes = args.notes?.trim() ?? "";
      if (notes.length > NOTES_MAX_LENGTH) {
        throw badInput(`Notes must be at most ${NOTES_MAX_LENGTH} characters`);
      }
      // A saved scan already holds Gemma's transcription, so its text is
      // reused instead of sending the photo again.
      let scanDeck = "";
      if (args.scanId) {
        const scan = await ownScan(context, userId, args.scanId);
        notes = [notes, scan.text].filter(Boolean).join("\n\n").slice(0, NOTES_MAX_LENGTH);
        scanDeck = scan.subject || scan.title;
      }
      let image: { mimeType: string; data: string } | undefined;
      if (args.mimeType || args.imageData) {
        assertImage(args.mimeType ?? "", args.imageData ?? "");
        image = { mimeType: args.mimeType ?? "", data: args.imageData ?? "" };
      }
      if (!notes && !image) throw badInput("Add notes, a photo or pick a scanned material");

      let draft;
      try {
        const { text } = await askGemma(
          notes ? `Материал:\n"""\n${notes}\n"""` : "Хавсаргасан зургаас карт гарга.",
          cardSystemPrompt(options),
          { image, temperature: 0.3 },
        );
        draft = parseDraft(text);
      } catch (error) {
        throw toAiError(error);
      }
      if (!draft.cards.length)
        throw badInput("Gemma could not make cards from this material. Try again.");

      return { ...draft, deck: draft.deck || scanDeck.slice(0, DECK_MAX_LENGTH) };
    },
    dandarCardsSave: async (
      _parent: unknown,
      args: {
        deck: string;
        cards: { front: string; back: string }[];
        examDate?: string | null;
        scanId?: string | null;
      },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      const deck = cleanDeck(args.deck);
      if (args.cards.length < 1 || args.cards.length > MAX_SAVED_CARDS) {
        throw badInput(`Save 1–${MAX_SAVED_CARDS} cards at a time`);
      }
      const cards = args.cards.map((card) => ({
        front: cleanText(card.front, "Front"),
        back: cleanText(card.back, "Back"),
      }));
      if (args.scanId) await ownScan(context, userId, args.scanId);

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
            scanId: args.scanId || undefined,
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
        throw badInput("Deck not found");
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
    dandarCardHelp: async (
      _parent: unknown,
      { _id, mode }: { _id: string; mode: (typeof HELP_MODES)[number] },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      assertRecordId(_id, "_id");
      if (!HELP_MODES.includes(mode)) throw badInput("Unknown mode");
      const doc = await context.models.StudyCards.findOne({
        _id,
        userId,
      }).lean<IStudyCardDocument>();
      if (!doc) throw badInput("Card not found");

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
