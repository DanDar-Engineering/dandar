import { schemaWrapper } from "erxes-api-shared/utils";
import { Schema, type Document } from "mongoose";

export interface ISample {
  label: string;
  createdAt: Date;
}

export interface ISampleDocument extends ISample, Document {}

// schemaWrapper adds _id generation plus the processId/segmentIds fields every
// erxes collection carries — always use it for plugin-owned schemas.
export const sampleSchema = schemaWrapper(
  new Schema({
    label: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }),
);
