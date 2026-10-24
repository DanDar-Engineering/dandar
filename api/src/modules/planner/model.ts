import { Schema, type Model } from "mongoose";
import { schemaWrapper } from "erxes-api-shared/utils";
import type { PlannerState } from "./contract.ts";
export type { PlannerState } from "./contract.ts";
export type PlannerModel = Model<PlannerState>;
export const plannerSchema = schemaWrapper(
  new Schema({
    userId: { type: String, required: true, unique: true },
    version: { type: Number, default: 0 },
    tasks: { type: [Schema.Types.Mixed], default: [] },
    blocks: { type: [Schema.Types.Mixed], default: [] },
    preferences: {
      type: Schema.Types.Mixed,
      default: () => ({
        enabled: true,
        quietStart: 22,
        quietEnd: 7,
        timeZone: "Asia/Ulaanbaatar",
        focus: 25,
        dailyLimit: 180,
        sessionReminderMinutes: 15,
      }),
    },
    delivered: { type: [String], default: [] },
  }),
);
