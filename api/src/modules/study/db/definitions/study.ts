import { schemaWrapper } from "erxes-api-shared/utils";
import { Schema, type Document } from "mongoose";

export interface IStudyCard {
  // erxes user (team member) _id of the student who owns the card
  userId: string;
  // The deck; also the topic the mastery of weak subjects is grouped by.
  topicId: string;
  front: string;
  back: string;
  // dandar_scans _ids the card was generated from, when it came from scans
  scanIds: string[];
  stability: number;
  lapses: number;
  reviews: number;
  lastReviewedAt: Date | null;
  dueAt: Date;
  createdAt: Date;
}

export interface IStudyCardDocument extends IStudyCard, Document {}

export const studyCardSchema = schemaWrapper(
  new Schema({
    userId: { type: String, required: true },
    topicId: { type: String, required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    scanIds: { type: [String], default: [] },
    stability: { type: Number, required: true },
    lapses: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    lastReviewedAt: { type: Date, default: null },
    dueAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  })
    .index({ userId: 1, dueAt: 1 })
    .index({ userId: 1, scanIds: 1 }),
);

export interface IStudyExam {
  userId: string;
  deck: string;
  examAt: Date;
}

export interface IStudyExamDocument extends IStudyExam, Document {}

export const studyExamSchema = schemaWrapper(
  new Schema({
    userId: { type: String, required: true },
    deck: { type: String, required: true },
    examAt: { type: Date, required: true },
  }).index({ userId: 1, deck: 1 }, { unique: true }),
);

export interface IStudySettings {
  userId: string;
  reviewReminder: boolean;
  reminderHour: number;
  examAlerts: boolean;
  quietStart: number;
  quietEnd: number;
}

export interface IStudySettingsDocument extends IStudySettings, Document {}

// Defaults live in modules/study/logic/reminders.ts (DEFAULT_REMINDER_SETTINGS);
// a student without a document gets those.
export const studySettingsSchema = schemaWrapper(
  new Schema({
    userId: { type: String, required: true, unique: true },
    reviewReminder: { type: Boolean, required: true },
    reminderHour: { type: Number, required: true },
    examAlerts: { type: Boolean, required: true },
    quietStart: { type: Number, required: true },
    quietEnd: { type: Number, required: true },
  }),
);
