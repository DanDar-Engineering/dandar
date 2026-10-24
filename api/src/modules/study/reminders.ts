import { redis } from "erxes-api-shared/utils";
import { env } from "../../config.ts";
import { generateModels } from "../../connectionResolvers.ts";
import { notifyUsers } from "../notify/notify.ts";
import type { IStudyCardDocument } from "./db/definitions/study.ts";
import {
  DEFAULT_REMINDER_SETTINGS,
  EXAM_ALERT_DAYS,
  type ExamInput,
  type ReminderSettings,
  daysUntil,
  examProgress,
  isReminderHour,
  planReminders,
} from "./logic/learning.ts";

// The scheduler only knows tenants that have used the plugin: every request
// records its subdomain here (once per process).
const TENANTS_KEY = "dandar:study:tenants";
const SENT_PREFIX = "dandar:study:sent";
const SENT_TTL_SECONDS = 3 * 24 * 3600;
const INTERVAL_MS = 10 * 60_000;
const MAX_USERS_PER_TENANT = 5000;

const knownTenants = new Set<string>();

export const rememberTenant = (subdomain: string) => {
  if (!subdomain || knownTenants.has(subdomain)) return;
  knownTenants.add(subdomain);
  redis.sadd(TENANTS_KEY, subdomain).catch(() => knownTenants.delete(subdomain));
};

const toCardState = (card: IStudyCardDocument) => ({
  id: String(card._id),
  topicId: card.topicId,
  stability: card.stability,
  lapses: card.lapses,
  reviews: card.reviews,
  lastReviewedAt: card.lastReviewedAt ? card.lastReviewedAt.getTime() : null,
  dueAt: card.dueAt.getTime(),
});

const runTenant = async (subdomain: string, now: number) => {
  const models = await generateModels(subdomain);
  const userIds = (await models.StudyCards.distinct("userId")).slice(0, MAX_USERS_PER_TENANT);
  const stored = await models.StudySettings.find({ userId: { $in: userIds } }).lean<
    (ReminderSettings & { userId: string })[]
  >();
  const settingsByUser = new Map(stored.map((settings) => [settings.userId, settings]));

  for (const userId of userIds) {
    const settings = settingsByUser.get(userId) ?? DEFAULT_REMINDER_SETTINGS;
    // Most hours nobody is due a reminder; skip the queries then.
    if (!isReminderHour(now, env.STUDY_TZ_OFFSET_MINUTES, settings)) continue;

    const dueCount = await models.StudyCards.countDocuments({
      userId,
      dueAt: { $lte: new Date(now) },
    });
    const exams: ExamInput[] = [];
    if (settings.examAlerts) {
      const stored = await models.StudyExams.find({ userId })
        .limit(50)
        .lean<{ deck: string; examAt: Date }[]>();
      for (const exam of stored) {
        const examAt = exam.examAt.getTime();
        if (!EXAM_ALERT_DAYS.includes(daysUntil(examAt, now))) continue;
        const cards = await models.StudyCards.find({ userId, topicId: exam.deck })
          .limit(5000)
          .lean<IStudyCardDocument[]>();
        exams.push({
          deck: exam.deck,
          examAt,
          readiness: examProgress(cards.map(toCardState), examAt, now).readiness,
        });
      }
    }

    const planned = planReminders({
      now,
      tzOffsetMinutes: env.STUDY_TZ_OFFSET_MINUTES,
      settings,
      dueCount,
      exams,
    });
    for (const reminder of planned) {
      // NX makes the reminder go out once even with several API replicas or
      // ticks inside the same hour.
      const fresh = await redis.set(
        `${SENT_PREFIX}:${subdomain}:${userId}:${reminder.key}`,
        "1",
        "EX",
        SENT_TTL_SECONDS,
        "NX",
      );
      if (fresh !== "OK") continue;
      await notifyUsers(subdomain, [userId], {
        title: reminder.title,
        message: reminder.message,
        contentType: reminder.kind === "review" ? "study.review" : "study.exam",
        type: reminder.kind === "exam" ? "warning" : "info",
        path: reminder.kind === "review" ? "/dandar/study" : "/dandar/study?tab=exams",
      });
    }
  }
};

const runOnce = async () => {
  const now = Date.now();
  for (const subdomain of await redis.smembers(TENANTS_KEY)) {
    try {
      await runTenant(subdomain, now);
    } catch (error) {
      console.error(
        `[dandar] study reminders for ${subdomain} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
};

export const startStudyReminders = () => {
  if (env.STUDY_REMINDERS === "off") return;
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    runOnce().finally(() => {
      running = false;
    });
  };
  setTimeout(tick, 60_000).unref();
  setInterval(tick, INTERVAL_MS).unref();
};
