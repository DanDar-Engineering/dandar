import { useQuery } from "@apollo/client";
import { useState } from "react";
import { IconPhoto, IconSchool, IconSparkles } from "@tabler/icons-react";
import { Badge, Button, Card, Checkbox, Empty, Label, Switch } from "erxes-ui";
import { SCANS_QUERY } from "../scan/graphql";
import { ScanBadges } from "../scan/ScanBadges";
import { SCAN_CARD_COUNTS_QUERY } from "./graphql";

const PAGE_SIZE = 20;
// Mirrors MAX_DRAFT_SCANS in api/src/graphql/study.ts.
const MAX_SELECTED = 5;

// Lists every scan the student saved earlier (paged), shows which already
// became cards, and turns up to five of them into one draft.
export const ScanPicker = ({
  drafting,
  onGenerate,
}: {
  drafting: boolean;
  onGenerate: (scanIds: string[], useScanImages: boolean) => void;
}) => {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [onlyNew, setOnlyNew] = useState(false);
  const [useImages, setUseImages] = useState(false);
  const scans = useQuery(SCANS_QUERY, { variables: { limit: PAGE_SIZE, offset } });
  const counts = useQuery(SCAN_CARD_COUNTS_QUERY);

  const cardsFrom = new Map(
    (counts.data?.dandarScanCardCounts ?? []).map((row) => [row.scanId, row.cards]),
  );
  const page = scans.data?.dandarScans ?? [];
  const visible = onlyNew ? page.filter((scan) => !cardsFrom.has(scan._id)) : page;

  const toggle = (id: string, on: boolean) =>
    setSelected((current) =>
      on
        ? current.includes(id) || current.length >= MAX_SELECTED
          ? current
          : [...current, id]
        : current.filter((item) => item !== id),
    );

  return (
    <Card>
      <Card.Header>
        <Card.Title>Өмнө уншуулсан материал</Card.Title>
        <Card.Description>
          «Зураг уншуулах» хэсэгт хадгалсан материалын текстээс карт үүсгэнэ. Зургийг дахин
          илгээхгүй. Нэг дор {MAX_SELECTED} хүртэл материал сонгож болно.
        </Card.Description>
      </Card.Header>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-3">
        <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:justify-between dandar:gap-2">
          <Label className="dandar:flex dandar:items-center dandar:gap-2 dandar:font-normal">
            <Checkbox
              checked={onlyNew}
              onCheckedChange={(checked) => setOnlyNew(checked === true)}
            />
            Зөвхөн карт болоогүйг харуулах
          </Label>
          <Button
            disabled={drafting || selected.length === 0}
            onClick={() => onGenerate(selected, useImages)}
          >
            <IconSparkles />
            {drafting ? "Gemma бодож байна…" : `Сонгосноос карт үүсгэх (${selected.length})`}
          </Button>
        </div>
        <Label className="dandar:flex dandar:items-start dandar:gap-3 dandar:rounded-lg dandar:border dandar:border-border dandar:p-3 dandar:font-normal">
          <Switch checked={useImages} onCheckedChange={setUseImages} className="dandar:mt-0.5" />
          <span className="dandar:flex dandar:flex-col dandar:gap-0.5">
            <span className="dandar:flex dandar:items-center dandar:gap-1 dandar:font-medium">
              <IconPhoto className="dandar:size-4" />
              Эх зургийг ашиглах
            </span>
            <span className="dandar:text-xs dandar:text-muted-foreground">
              Диаграм, томьёо, хүснэгттэй материалд илүү оновчтой. Зураг бүрийг Gemma дахин үзэх тул
              удаан.
            </span>
          </span>
        </Label>

        {scans.loading ? (
          <p role="status">Ачаалж байна…</p>
        ) : scans.error ? (
          <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
            <p>{scans.error.message}</p>
            <Button variant="outline" className="dandar:w-fit" onClick={() => scans.refetch()}>
              Дахин оролдох
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <Empty>
            <Empty.Header>
              <Empty.Title>
                {page.length ? "Энэ хуудсан дээр бүгд карт болсон" : "Материал алга"}
              </Empty.Title>
              <Empty.Description>
                {page.length
                  ? "Дараагийн хуудсыг үзнэ үү."
                  : "Эхлээд «Зураг уншуулах» хэсгээс зураг уншуулна уу."}
              </Empty.Description>
            </Empty.Header>
          </Empty>
        ) : (
          <ul className="dandar:divide-y dandar:divide-border">
            {visible.map((scan) => {
              const made = cardsFrom.get(scan._id) ?? 0;
              const checked = selected.includes(scan._id);
              return (
                <li
                  key={scan._id}
                  className="dandar:flex dandar:items-start dandar:gap-3 dandar:py-3"
                >
                  <Checkbox
                    aria-label={`${scan.title} сонгох`}
                    checked={checked}
                    disabled={!checked && selected.length >= MAX_SELECTED}
                    onCheckedChange={(value) => toggle(scan._id, value === true)}
                    className="dandar:mt-1"
                  />
                  <div className="dandar:flex dandar:flex-1 dandar:flex-col dandar:gap-1">
                    <span className="dandar:font-medium">{scan.title}</span>
                    <span className="dandar:text-xs dandar:text-muted-foreground">
                      {[
                        scan.subject,
                        scan.createdAt && new Date(scan.createdAt).toLocaleDateString("mn-MN"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="dandar:flex dandar:flex-wrap dandar:gap-1">
                      <ScanBadges kind={scan.kind} status={scan.status} />
                      {made ? <Badge variant="success">{made} карт үүссэн</Badge> : null}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={scan.kind === "exam" ? "default" : "outline"}
                    disabled={drafting}
                    onClick={() => onGenerate([scan._id], useImages)}
                    title={
                      scan.kind === "exam"
                        ? "Ижил төрлийн шинэ дасгал үүсгэж, огноо байвал шалгалтын хуваарь санал болгоно"
                        : undefined
                    }
                  >
                    {scan.kind === "exam" ? <IconSchool /> : null}
                    {scan.kind === "exam" ? "Шалгалтад бэлдэх" : "Карт үүсгэх"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="dandar:flex dandar:gap-2">
          <Button
            variant="outline"
            disabled={scans.loading || offset === 0}
            onClick={() => setOffset(offset - PAGE_SIZE)}
          >
            Өмнөх
          </Button>
          <Button
            variant="outline"
            disabled={scans.loading || !!scans.error || page.length < PAGE_SIZE || offset >= 10_000}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Дараах
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};
