import { schemaWrapper } from "erxes-api-shared/utils";
import { Schema, type Document } from "mongoose";
import { SCAN_KINDS, SCAN_STATUSES, type ScanKind, type ScanStatus } from "../../constants.ts";

export interface IScan {
  // erxes user (team member) _ids: the uploader and the teacher it goes to
  studentId: string;
  teacherId?: string;
  fileName: string;
  mimeType: string;
  // base64 without the data: prefix; the UI downsizes photos before upload
  imageData: string;
  text: string;
  kind: ScanKind;
  title: string;
  subject?: string;
  summary?: string;
  status: ScanStatus;
  teacherComment?: string;
  sentAt?: Date;
  reviewedAt?: Date;
  createdAt: Date;
}

export interface IScanDocument extends IScan, Document {}

export const scanSchema = schemaWrapper(
  new Schema({
    studentId: { type: String, required: true, index: true },
    teacherId: { type: String, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    imageData: { type: String, required: true },
    text: { type: String, default: "" },
    kind: { type: String, enum: SCAN_KINDS, required: true },
    title: { type: String, required: true },
    subject: { type: String },
    summary: { type: String },
    status: { type: String, enum: SCAN_STATUSES, required: true, index: true },
    teacherComment: { type: String },
    sentAt: { type: Date },
    reviewedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  }),
);
