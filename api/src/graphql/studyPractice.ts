import { gql } from "graphql-tag";
import { env } from "../config.ts";
import type { Context } from "../connectionResolvers.ts";
import type { IStudyCardDocument } from "../modules/study/db/definitions/study.ts";
import {
  applyExam,
  buildQuiz,
  dailyActivity,
  dueForecast,
  isCorrectChoice,
  retrievabilityOf,
  review,
} from "../modules/study/logic/learning.ts";
import { STUDY_READ, STUDY_WRITE } from "../permissions.ts";
import { badInput, requireTenantUser } from "./guards.ts";
import { assertRecordId, examTimes, toCardOutput, toState } from "./study.ts";

export const studyPracticeTypeDefs = gql`
  "A multiple-choice question; the right answer is checked by dandarQuizAnswer"
  type DandarQuizQuestion {
    cardId: String!
    deck: String!
    front: String!
    choices: [String!]!
  }

  type DandarQuizResult {
    correct: Boolean!
    "The card's answer, shown after the student picks"
    answer: String!
    card: DandarStudyCard!
  }

  type DandarStudyDay {
    "Local date YYYY-MM-DD"
    date: String!
    reviewed: Int!
    remembered: Int!
  }

  type DandarStudyForecastDay {
    date: String!
    due: Int!
  }

  type DandarStudyProgress {
    "Days with at least one review in the last 7 days"
    activeDays: Int!
    days: [DandarStudyDay!]!
    forecast: [DandarStudyForecastDay!]!
    reviewedThisWeek: Int!
    "Share of this week's reviews the student remembered, 0–100"
    rememberedRate: Int!
  }

  extend type Query {
    "Up to size questions, the most forgotten cards first; deck narrows them"
    dandarQuiz(deck: String, size: Int = 10): [DandarQuizQuestion!]!
    dandarStudyProgress: DandarStudyProgress!
  }

  extend type Mutation {
    "Checks a quiz answer and reschedules the card: right counts as know, wrong as forgot"
    dandarQuizAnswer(cardId: String!, choice: String!): DandarQuizResult!
  }
`;

const QUIZ_POOL = 300;
const CHOICE_MAX_LENGTH = 600;

export const studyPracticeResolvers = {
  Query: {
    dandarQuiz: async (
      _parent: unknown,
      { deck, size = 10 }: { deck?: string | null; size?: number },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      if (!Number.isInteger(size) || size < 1 || size > 30)
        throw badInput("Асуултын тоо 1–30 байна");
      // Wrong choices come from every deck, so the pool is not narrowed by deck.
      const docs = await context.models.StudyCards.find({ userId })
        .limit(QUIZ_POOL)
        .lean<IStudyCardDocument[]>();
      const now = Date.now();
      const ranked = docs
        .map((doc) => ({ doc, recall: retrievabilityOf(toState(doc), now) }))
        // Seen cards the student is forgetting first, then new ones.
        .sort(
          (a, b) =>
            (a.doc.reviews === 0 ? 1 : 0) - (b.doc.reviews === 0 ? 1 : 0) || a.recall - b.recall,
        )
        .map(({ doc }) => ({
          id: String(doc._id),
          deck: doc.topicId,
          front: doc.front,
          back: doc.back,
        }));
      // Questions are built from the whole pool (wrong choices need it), then
      // narrowed to the deck.
      const questions = buildQuiz(ranked, deck ? ranked.length : size);

      return (deck ? questions.filter((question) => question.deck === deck) : questions).slice(
        0,
        size,
      );
    },
    dandarStudyProgress: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_READ);
      const now = Date.now();
      const weekAgo = new Date(now - 8 * 86_400_000);
      const [reviews, cards] = await Promise.all([
        context.models.StudyReviews.find({ userId, at: { $gte: weekAgo } }, { at: 1, grade: 1 })
          .limit(10_000)
          .lean<{ at: Date; grade: string }[]>(),
        context.models.StudyCards.find({ userId }, { dueAt: 1 })
          .limit(5000)
          .lean<{ dueAt: Date }[]>(),
      ]);
      const tz = env.STUDY_TZ_OFFSET_MINUTES;
      const days = dailyActivity(
        reviews.map((item) => ({ at: item.at.getTime(), grade: item.grade })),
        now,
        tz,
      );
      const reviewed = days.reduce((sum, day) => sum + day.reviewed, 0);
      const remembered = days.reduce((sum, day) => sum + day.remembered, 0);

      return {
        activeDays: days.filter((day) => day.reviewed > 0).length,
        days,
        forecast: dueForecast(
          cards.map((card) => card.dueAt.getTime()),
          now,
          tz,
        ),
        reviewedThisWeek: reviewed,
        rememberedRate: reviewed ? Math.round((remembered / reviewed) * 100) : 0,
      };
    },
  },
  Mutation: {
    dandarQuizAnswer: async (
      _parent: unknown,
      { cardId, choice }: { cardId: string; choice: string },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(STUDY_WRITE);
      assertRecordId(cardId, "cardId");
      if (choice.length > CHOICE_MAX_LENGTH) throw badInput("Сонголт хэт урт байна");
      const doc = await context.models.StudyCards.findOne({ _id: cardId, userId });
      if (!doc) throw badInput("Карт олдсонгүй");

      const correct = isCorrectChoice(choice, doc.back);
      const grade = correct ? "know" : "forgot";
      const now = Date.now();
      const exams = await examTimes(context, userId);
      const next = applyExam(review(toState(doc), grade, now), exams.get(doc.topicId) ?? null, now);
      doc.set({
        stability: next.stability,
        lapses: next.lapses,
        reviews: next.reviews,
        lastReviewedAt: new Date(now),
        dueAt: new Date(next.dueAt),
      });
      await Promise.all([
        doc.save(),
        context.models.StudyReviews.create({
          userId,
          cardId,
          deck: doc.topicId,
          grade,
          source: "quiz",
          at: new Date(now),
        }),
      ]);

      return { correct, answer: doc.back, card: toCardOutput(doc.toObject(), now) };
    },
  },
};
