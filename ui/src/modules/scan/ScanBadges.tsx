import { Badge } from "erxes-ui";
import type { DandarScanKind, DandarScanStatus } from "~/gql/graphql";

type BadgeVariant = "default" | "secondary" | "warning" | "success" | "info";

const KIND_LABELS: Record<DandarScanKind, { label: string; variant: BadgeVariant }> = {
  note: { label: "Тэмдэглэл", variant: "info" },
  exam: { label: "Шалгалтын материал", variant: "warning" },
  other: { label: "Бусад", variant: "secondary" },
};

const STATUS_LABELS: Record<DandarScanStatus, { label: string; variant: BadgeVariant }> = {
  processed: { label: "Боловсруулсан", variant: "secondary" },
  awaiting_teacher: { label: "Багш сонгоогүй", variant: "warning" },
  sent: { label: "Багшид илгээсэн", variant: "info" },
  reviewed: { label: "Багш хариулсан", variant: "success" },
};

export const ScanBadges = ({
  kind,
  status,
}: {
  kind: DandarScanKind;
  status: DandarScanStatus;
}) => (
  <span className="dandar:flex dandar:flex-wrap dandar:gap-1">
    <Badge variant={KIND_LABELS[kind].variant}>{KIND_LABELS[kind].label}</Badge>
    <Badge variant={STATUS_LABELS[status].variant}>{STATUS_LABELS[status].label}</Badge>
  </span>
);
