// Kept free of mongoose and erxes-api-shared imports so print-schema and
// readScan can load them without opening platform connections.
export const SCAN_KINDS = ["note", "exam", "other"] as const;
export type ScanKind = (typeof SCAN_KINDS)[number];

// processed: a note was summarized (or nothing needed to happen);
// awaiting_teacher: exam material with no teacher picked yet;
// sent: waiting in the teacher's inbox; reviewed: the teacher answered.
export const SCAN_STATUSES = ["processed", "awaiting_teacher", "sent", "reviewed"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];
