import type { Model } from "mongoose";
import type { IModels } from "../../../../connectionResolvers.ts";
import { type IScan, type IScanDocument, scanSchema } from "../definitions/scan.ts";

type Page = { limit: number; offset: number };
export type ScanRecord = IScan & { _id: string };
// Lists never carry the photo; only the detail query loads it.
export type ScanSummaryRecord = Omit<ScanRecord, "imageData">;

const WITHOUT_IMAGE = { imageData: 0 } as const;

export interface IScanModel extends Model<IScanDocument> {
  listByStudent(studentId: string, page: Page): Promise<ScanSummaryRecord[]>;
  listByTeacher(teacherId: string, page: Page): Promise<ScanSummaryRecord[]>;
  findVisible(_id: string, userId: string): Promise<ScanRecord | null>;
  createScan(doc: Omit<IScan, "createdAt">): Promise<ScanSummaryRecord>;
  sendToTeacher(
    _id: string,
    studentId: string,
    teacherId: string,
  ): Promise<ScanSummaryRecord | null>;
  review(_id: string, teacherId: string, comment: string): Promise<ScanSummaryRecord | null>;
}

// Every query filters by the acting user, so a student sees only their own
// uploads and a teacher only what was sent to them.
export const loadScanClass = (models: IModels) => {
  class Scan {
    public static listByStudent(studentId: string, { limit, offset }: Page) {
      return models.Scans.find({ studentId }, WITHOUT_IMAGE)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean<ScanSummaryRecord[]>();
    }

    public static listByTeacher(teacherId: string, { limit, offset }: Page) {
      return models.Scans.find({ teacherId, status: { $in: ["sent", "reviewed"] } }, WITHOUT_IMAGE)
        .sort({ sentAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean<ScanSummaryRecord[]>();
    }

    public static findVisible(_id: string, userId: string) {
      return models.Scans.findOne({
        _id,
        $or: [{ studentId: userId }, { teacherId: userId, status: { $in: ["sent", "reviewed"] } }],
      }).lean<ScanRecord>();
    }

    public static async createScan(doc: Omit<IScan, "createdAt">) {
      const { imageData: _image, ...scan } = (
        await models.Scans.create(doc)
      ).toObject<ScanRecord>();

      return scan;
    }

    public static sendToTeacher(_id: string, studentId: string, teacherId: string) {
      return models.Scans.findOneAndUpdate(
        { _id, studentId, status: { $ne: "reviewed" } },
        { $set: { teacherId, status: "sent", sentAt: new Date() } },
        { new: true, projection: WITHOUT_IMAGE },
      ).lean<ScanSummaryRecord>();
    }

    public static review(_id: string, teacherId: string, comment: string) {
      return models.Scans.findOneAndUpdate(
        { _id, teacherId, status: { $in: ["sent", "reviewed"] } },
        { $set: { teacherComment: comment, status: "reviewed", reviewedAt: new Date() } },
        { new: true, projection: WITHOUT_IMAGE },
      ).lean<ScanSummaryRecord>();
    }
  }

  scanSchema.loadClass(Scan);

  return scanSchema;
};
