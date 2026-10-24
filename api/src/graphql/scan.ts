import { gql } from "graphql-tag";
import { GraphQLError } from "graphql";
import type { Context } from "../connectionResolvers.ts";
import type { ScanKind } from "../modules/scan/constants.ts";
import type { ScanSummaryRecord } from "../modules/scan/db/models/Scan.ts";
import { EmptyScanError, readScan } from "../modules/scan/readScan.ts";
import { SCAN_REVIEW, SCAN_SUBMIT } from "../permissions.ts";
import { RECORD_ID, assertPage, badInput, requireTenantUser, toAiError } from "./guards.ts";

export const scanTypeDefs = gql`
  enum DandarScanKind {
    note
    exam
    other
  }

  enum DandarScanStatus {
    processed
    awaiting_teacher
    sent
    reviewed
  }

  type DandarScan {
    _id: String!
    "erxes team member _id of the uploader"
    studentId: String!
    "erxes team member _id of the teacher exam materials go to"
    teacherId: String
    fileName: String!
    text: String!
    kind: DandarScanKind!
    title: String!
    subject: String
    "Gemma's summary; only notes have one"
    summary: String
    status: DandarScanStatus!
    teacherComment: String
    "data: URL of the photo; only dandarScanDetail returns it"
    imageUrl: String
    sentAt: String
    reviewedAt: String
    createdAt: String
  }

  "What Gemma read from a photo; nothing is stored until dandarScanSave"
  type DandarScanReading {
    text: String!
    kind: DandarScanKind!
    title: String!
    subject: String
    summary: String
    "false when the kind is a guess or the text has unreadable [?] words"
    confident: Boolean!
  }

  extend type Query {
    "The signed-in student's own uploads"
    dandarScans(limit: Int = 20, offset: Int = 0): [DandarScan!]!
    "Exam materials students sent to the signed-in teacher"
    dandarScansInbox(limit: Int = 20, offset: Int = 0): [DandarScan!]!
    dandarScanDetail(_id: String!): DandarScan
  }

  extend type Mutation {
    "Reads the photo with Gemma 4: transcription, kind, title, subject and a note summary"
    dandarScanRead(mimeType: String!, imageData: String!): DandarScanReading!
    "Stores the reading the student checked; exam materials go to teacherId"
    dandarScanSave(
      fileName: String!
      mimeType: String!
      imageData: String!
      text: String!
      kind: DandarScanKind!
      title: String!
      subject: String
      summary: String
      teacherId: String
    ): DandarScan!
    dandarScanSendToTeacher(_id: String!, teacherId: String!): DandarScan!
    dandarScanReview(_id: String!, comment: String!): DandarScan!
  }
`;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// Mirrors MAX_IMAGE_CHARS in ui/src/modules/scan/image.ts. The Apollo Router
// rejects request bodies over 2 MB, so the UI downsizes photos first.
const MAX_IMAGE_CHARS = 1_500_000;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const FILE_NAME_MAX_LENGTH = 200;
// Mirrors COMMENT_MAX_LENGTH in ui/src/modules/scan/TeacherInbox.tsx.
const COMMENT_MAX_LENGTH = 2000;
// Mirror FIELD_LIMITS in ui/src/modules/scan/ScanWizard.tsx.
const TITLE_MAX_LENGTH = 200;
const SUBJECT_MAX_LENGTH = 100;
const SUMMARY_MAX_LENGTH = 4000;
const TEXT_MAX_LENGTH = 20_000;

export const assertImage = (mimeType: string, imageData: string) => {
  if (!IMAGE_TYPES.has(mimeType)) {
    throw badInput("Upload a JPEG, PNG or WebP image");
  }
  if (!imageData || imageData.length > MAX_IMAGE_CHARS || !BASE64.test(imageData)) {
    throw badInput("The image is empty, too large or not base64");
  }
};

const optionalText = (value: string | null | undefined, max: number, label: string) => {
  const text = value?.trim() ?? "";
  if (text.length > max) {
    throw badInput(`${label} must be at most ${max} characters`);
  }

  return text || undefined;
};

type SaveArgs = {
  fileName: string;
  mimeType: string;
  imageData: string;
  text: string;
  kind: ScanKind;
  title: string;
  subject?: string | null;
  summary?: string | null;
  teacherId?: string | null;
};

type ScanOutputSource = ScanSummaryRecord & { imageData?: string };

const toIso = (date?: Date) => date?.toISOString?.() ?? null;

const toScanOutput = ({ imageData, ...scan }: ScanOutputSource) => ({
  ...scan,
  imageUrl: imageData ? `data:${scan.mimeType};base64,${imageData}` : null,
  sentAt: toIso(scan.sentAt),
  reviewedAt: toIso(scan.reviewedAt),
  createdAt: toIso(scan.createdAt),
});

const assertRecordId = (value: string, label: string) => {
  if (!RECORD_ID.test(value)) {
    throw badInput(`Invalid ${label}`);
  }
};

const notFound = () =>
  new GraphQLError("Material not found", { extensions: { code: "NOT_FOUND" } });

type PageArgs = { limit?: number; offset?: number };

export const scanResolvers = {
  Query: {
    dandarScans: async (_parent: unknown, { limit = 20, offset = 0 }: PageArgs, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(SCAN_SUBMIT);
      assertPage(limit, offset);

      return (await context.models.Scans.listByStudent(userId, { limit, offset })).map(toScanOutput);
    },
    dandarScansInbox: async (
      _parent: unknown,
      { limit = 20, offset = 0 }: PageArgs,
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(SCAN_REVIEW);
      assertPage(limit, offset);

      return (await context.models.Scans.listByTeacher(userId, { limit, offset })).map(toScanOutput);
    },
    dandarScanDetail: async (_parent: unknown, { _id }: { _id: string }, context: Context) => {
      const userId = requireTenantUser(context);
      assertRecordId(_id, "_id");
      const scan = await context.models.Scans.findVisible(_id, userId);
      if (!scan) {
        return null;
      }
      // The uploader needs the student action, the assigned teacher the teacher one.
      await context.checkPermission(scan.studentId === userId ? SCAN_SUBMIT : SCAN_REVIEW);

      return toScanOutput(scan);
    },
  },
  Mutation: {
    // Nothing is stored here: the student checks the reading first.
    dandarScanRead: async (
      _parent: unknown,
      { mimeType, imageData }: { mimeType: string; imageData: string },
      context: Context,
    ) => {
      requireTenantUser(context);
      await context.checkPermission(SCAN_SUBMIT);
      assertImage(mimeType, imageData);

      try {
        return await readScan({ mimeType, data: imageData });
      } catch (error) {
        if (error instanceof EmptyScanError) {
          throw badInput(error.message);
        }
        throw toAiError(error);
      }
    },
    dandarScanSave: async (_parent: unknown, args: SaveArgs, context: Context) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(SCAN_SUBMIT);
      assertImage(args.mimeType, args.imageData);

      const title = args.title.trim();
      if (!title || title.length > TITLE_MAX_LENGTH) {
        throw badInput(`Title must be 1–${TITLE_MAX_LENGTH} characters`);
      }
      const text = args.text.trim();
      if (!text || text.length > TEXT_MAX_LENGTH) {
        throw badInput(`Text must be 1–${TEXT_MAX_LENGTH} characters`);
      }
      if (args.teacherId) {
        assertRecordId(args.teacherId, "teacherId");
      }

      // Exam material goes straight to the chosen teacher; without one it
      // waits until the student picks a teacher.
      const isExam = args.kind === "exam";
      const teacherId = isExam ? args.teacherId || undefined : undefined;
      const status = isExam ? (teacherId ? "sent" : "awaiting_teacher") : "processed";

      return toScanOutput(
        await context.models.Scans.createScan({
          studentId: userId,
          teacherId,
          fileName: args.fileName.trim().slice(0, FILE_NAME_MAX_LENGTH) || "scan",
          mimeType: args.mimeType,
          imageData: args.imageData,
          text,
          kind: args.kind,
          title,
          subject: optionalText(args.subject, SUBJECT_MAX_LENGTH, "Subject"),
          summary:
            args.kind === "note"
              ? optionalText(args.summary, SUMMARY_MAX_LENGTH, "Summary")
              : undefined,
          status,
          sentAt: status === "sent" ? new Date() : undefined,
        }),
      );
    },
    dandarScanSendToTeacher: async (
      _parent: unknown,
      { _id, teacherId }: { _id: string; teacherId: string },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(SCAN_SUBMIT);
      assertRecordId(_id, "_id");
      assertRecordId(teacherId, "teacherId");

      const scan = await context.models.Scans.sendToTeacher(_id, userId, teacherId);
      if (!scan) {
        throw notFound();
      }

      return toScanOutput(scan);
    },
    dandarScanReview: async (
      _parent: unknown,
      { _id, comment }: { _id: string; comment: string },
      context: Context,
    ) => {
      const userId = requireTenantUser(context);
      await context.checkPermission(SCAN_REVIEW);
      assertRecordId(_id, "_id");

      const text = comment.trim();
      if (!text || text.length > COMMENT_MAX_LENGTH) {
        throw badInput(`Write a comment of 1–${COMMENT_MAX_LENGTH} characters`);
      }

      const scan = await context.models.Scans.review(_id, userId, text);
      if (!scan) {
        throw notFound();
      }

      return toScanOutput(scan);
    },
  },
};
