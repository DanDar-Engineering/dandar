import { useMutation } from "@apollo/client";
import { type ChangeEvent, type ReactNode, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconLock,
  IconPhoto,
  IconRefresh,
  IconScan,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Badge, Button, Card, Input, Label, Select, Skeleton, Textarea, cn, toast } from "erxes-ui";
import { SelectMember } from "ui-modules";
import type { DandarScanKind } from "~/gql/graphql";
import { SCAN_READ_MUTATION, SCAN_SAVE_MUTATION } from "./graphql";
import { ACCEPTED_IMAGE_TYPES, type PreparedImage, prepareImage } from "./image";

// Mirror the limits in api/src/graphql/scan.ts.
const FIELD_LIMITS = { title: 200, subject: 100, summary: 4000, text: 20_000 };

const KIND_OPTIONS: { value: DandarScanKind; label: string }[] = [
  { value: "note", label: "Тэмдэглэл" },
  { value: "exam", label: "Шалгалтын материал" },
  { value: "other", label: "Бусад" },
];

type Fields = {
  kind: DandarScanKind;
  title: string;
  subject: string;
  summary: string;
  text: string;
  teacherId: string;
};

const STEPS = ["Зураг оруулах", "Шалгах", "Хадгалах"];

const StepIndicator = ({ current }: { current: number }) => (
  <ol aria-label="Алхам" className="dandar:flex dandar:flex-wrap dandar:items-center dandar:gap-2">
    {STEPS.map((label, index) => {
      const done = index < current;
      const active = index === current;
      return (
        <li
          key={label}
          aria-current={active ? "step" : undefined}
          className={cn(
            "dandar:flex dandar:items-center dandar:gap-2 dandar:text-sm dandar:font-medium",
            active ? "dandar:text-primary" : "dandar:text-muted-foreground",
          )}
        >
          {index > 0 ? <span aria-hidden className="dandar:h-px dandar:w-6 dandar:bg-border" /> : null}
          <span
            className={cn(
              "dandar:flex dandar:size-6 dandar:items-center dandar:justify-center dandar:rounded-full dandar:text-xs",
              done && "dandar:bg-success dandar:text-background",
              active && "dandar:bg-primary dandar:text-primary-foreground",
              !done && !active && "dandar:border dandar:border-border",
            )}
          >
            {done ? <IconCheck className="dandar:size-3.5" /> : index + 1}
          </span>
          {label}
        </li>
      );
    })}
  </ol>
);

const ConfidenceBadge = ({ confident }: { confident: boolean }) =>
  confident ? (
    <Badge variant="success">
      <IconCheck className="dandar:size-3" />
      Итгэлтэй
    </Badge>
  ) : (
    <Badge variant="warning">
      <IconAlertTriangle className="dandar:size-3" />
      Шалгана уу
    </Badge>
  );

const Field = ({
  number,
  label,
  htmlFor,
  badge,
  children,
}: {
  number: number;
  label: string;
  htmlFor?: string;
  badge?: ReactNode;
  children: ReactNode;
}) => (
  <div className="dandar:flex dandar:flex-col dandar:gap-2">
    <div className="dandar:flex dandar:items-center dandar:justify-between dandar:gap-2">
      <Label htmlFor={htmlFor} className="dandar:flex dandar:items-center dandar:gap-2">
        <span className="dandar:flex dandar:size-5 dandar:items-center dandar:justify-center dandar:rounded-full dandar:bg-primary dandar:text-xs dandar:text-primary-foreground">
          {number}
        </span>
        {label}
      </Label>
      {badge}
    </div>
    {children}
  </div>
);

// Upload → Gemma reads (dandarScanRead, nothing stored) → the student checks
// and edits the fields → dandarScanSave stores it and routes exams.
export const ScanWizard = () => {
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [fields, setFields] = useState<Fields | null>(null);
  const [confident, setConfident] = useState(true);
  // Clearing the file input needs a new element.
  const [inputKey, setInputKey] = useState(0);

  const [read, { loading: reading, error: readError }] = useMutation(SCAN_READ_MUTATION, {
    onCompleted: ({ dandarScanRead: result }) => {
      setConfident(result.confident);
      setFields({
        kind: result.kind,
        title: result.title,
        subject: result.subject ?? "",
        summary: result.summary ?? "",
        text: result.text,
        teacherId: "",
      });
    },
    // Rendered from the hook state below.
    onError: () => undefined,
  });

  const reset = () => {
    setImage(null);
    setFields(null);
    setImageError("");
    setInputKey((key) => key + 1);
  };

  const [save, { loading: saving }] = useMutation(SCAN_SAVE_MUTATION, {
    refetchQueries: ["dandarScans", "dandarScansInbox"],
    awaitRefetchQueries: true,
    onCompleted: ({ dandarScanSave: scan }) => {
      reset();
      toast({
        title:
          scan.status === "sent"
            ? "Хадгалаад багшид илгээлээ"
            : scan.status === "awaiting_teacher"
              ? "Хадгаллаа. Багшаа сонгоод илгээнэ үү"
              : "Хадгаллаа",
        variant: "success",
      });
    },
    onError: (error) =>
      toast({ title: "Хадгалж чадсангүй", description: error.message, variant: "destructive" }),
  });

  const runRead = (prepared: PreparedImage) => {
    setFields(null);
    read({ variables: { mimeType: prepared.mimeType, imageData: prepared.data } });
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageError("");
    if (!file) {
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      setImage(prepared);
      runRead(prepared);
    } catch (prepareError) {
      setImageError(prepareError instanceof Error ? prepareError.message : String(prepareError));
    } finally {
      setPreparing(false);
    }
  };

  const update = (patch: Partial<Fields>) => setFields((current) => current && { ...current, ...patch });

  const canSave = !!image && !!fields && !!fields.title.trim() && !!fields.text.trim() && !saving;

  const onSave = () => {
    if (!image || !fields || !canSave) {
      return;
    }
    save({
      variables: {
        fileName: image.fileName,
        mimeType: image.mimeType,
        imageData: image.data,
        text: fields.text.trim(),
        kind: fields.kind,
        title: fields.title.trim(),
        subject: fields.subject.trim() || null,
        summary: fields.kind === "note" ? fields.summary.trim() || null : null,
        teacherId: fields.kind === "exam" ? fields.teacherId || null : null,
      },
    });
  };

  const step = saving ? 2 : image ? 1 : 0;

  return (
    <section className="dandar:flex dandar:flex-col dandar:gap-4">
      <header className="dandar:flex dandar:flex-wrap dandar:items-end dandar:justify-between dandar:gap-4">
        <div className="dandar:flex dandar:flex-col dandar:gap-1">
          <h2 className="dandar:text-2xl dandar:font-semibold dandar:tracking-tight">Скан</h2>
          <p className="dandar:max-w-xl dandar:text-sm dandar:text-muted-foreground">
            Тэмдэглэл эсвэл шалгалтын материалын зургийг Gemma 4 уншина. Зөвхөн таныг
            баталгаажуулсны дараа хадгална.
          </p>
        </div>
        <StepIndicator current={step} />
      </header>

      {!image ? (
        <Card>
          <Card.Content className="dandar:pt-6">
            <label
              htmlFor="dandar-scan-file"
              className="dandar:flex dandar:cursor-pointer dandar:flex-col dandar:items-center dandar:gap-3 dandar:rounded-xl dandar:border-2 dandar:border-dashed dandar:border-border dandar:p-10 dandar:text-center"
            >
              <span className="dandar:flex dandar:size-12 dandar:items-center dandar:justify-center dandar:rounded-xl dandar:bg-accent">
                <IconPhoto className="dandar:size-6" />
              </span>
              <span className="dandar:font-medium">
                {preparing ? "Зургийг бэлдэж байна…" : "Зураг сонгох"}
              </span>
              <span className="dandar:text-sm dandar:text-muted-foreground">
                JPEG, PNG эсвэл WebP. Хуудсыг бүтнээр нь, гэрэлтэй газар авна уу.
              </span>
            </label>
            <Input
              key={inputKey}
              id="dandar-scan-file"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              disabled={preparing}
              onChange={onFileChange}
              className="dandar:sr-only"
            />
            {imageError ? (
              <p role="alert" className="dandar:mt-3 dandar:text-sm dandar:text-destructive">
                {imageError}
              </p>
            ) : null}
          </Card.Content>
        </Card>
      ) : (
        <div className="dandar:grid dandar:items-start dandar:gap-4 dandar:lg:grid-cols-5">
          <Card className="dandar:overflow-hidden dandar:lg:col-span-3">
            <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:justify-between dandar:gap-3 dandar:border-b dandar:border-border dandar:p-4">
              <div className="dandar:flex dandar:min-w-0 dandar:items-center dandar:gap-3">
                <span className="dandar:flex dandar:size-10 dandar:shrink-0 dandar:items-center dandar:justify-center dandar:rounded-lg dandar:bg-accent">
                  <IconPhoto className="dandar:size-5" />
                </span>
                <div className="dandar:flex dandar:min-w-0 dandar:flex-col">
                  <span className="dandar:truncate dandar:font-medium">{image.fileName}</span>
                  <span className="dandar:text-xs dandar:text-muted-foreground">Зураг · 1 хуудас</span>
                </div>
              </div>
              <Button variant="outline" disabled={reading || saving} onClick={reset}>
                Өөр зураг сонгох
              </Button>
            </div>
            <div className="dandar:flex dandar:items-center dandar:gap-2 dandar:bg-muted dandar:px-4 dandar:py-2 dandar:text-sm dandar:text-muted-foreground">
              <IconLock className="dandar:size-4 dandar:shrink-0" />
              Баталгаажуулах хүртэл зураг хадгалагдахгүй.
            </div>
            <div className="dandar:bg-muted/50 dandar:p-4">
              <img
                src={image.previewUrl}
                alt="Уншуулж буй зураг"
                className="dandar:mx-auto dandar:max-h-[560px] dandar:rounded-md dandar:shadow-md"
              />
            </div>
          </Card>

          <Card className="dandar:lg:col-span-2">
            <Card.Header>
              <Card.Title>Таньсан мэдээлэл</Card.Title>
              <Card.Description>Шалгаад, шаардлагатай бол засна уу.</Card.Description>
            </Card.Header>
            <Card.Content className="dandar:flex dandar:flex-col dandar:gap-5">
              {reading ? (
                <div role="status" className="dandar:flex dandar:flex-col dandar:gap-3">
                  <p className="dandar:flex dandar:items-center dandar:gap-2 dandar:text-sm dandar:text-muted-foreground">
                    <IconScan className="dandar:size-4 dandar:animate-pulse" />
                    Gemma 4 уншиж, ангилж байна… (10–60 секунд)
                  </p>
                  <Skeleton className="dandar:h-10 dandar:w-full" />
                  <Skeleton className="dandar:h-10 dandar:w-full" />
                  <Skeleton className="dandar:h-32 dandar:w-full" />
                </div>
              ) : readError ? (
                <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-3 dandar:text-sm">
                  <p className="dandar:text-destructive">{readError.message}</p>
                  <Button variant="outline" className="dandar:w-fit" onClick={() => runRead(image)}>
                    <IconRefresh />
                    Дахин оролдох
                  </Button>
                </div>
              ) : fields ? (
                <>
                  <Field number={1} label="Төрөл" badge={<ConfidenceBadge confident={confident} />}>
                    <Select
                      value={fields.kind}
                      onValueChange={(value) => update({ kind: value as DandarScanKind })}
                    >
                      <Select.Trigger aria-label="Төрөл">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {KIND_OPTIONS.map((option) => (
                          <Select.Item key={option.value} value={option.value}>
                            {option.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </Field>
                  <Field number={2} label="Хичээл" htmlFor="dandar-scan-subject">
                    <Input
                      id="dandar-scan-subject"
                      value={fields.subject}
                      maxLength={FIELD_LIMITS.subject}
                      placeholder="Жишээ нь: Математик"
                      onChange={(event) => update({ subject: event.target.value })}
                    />
                  </Field>
                  <Field number={3} label="Гарчиг" htmlFor="dandar-scan-title">
                    <Input
                      id="dandar-scan-title"
                      value={fields.title}
                      maxLength={FIELD_LIMITS.title}
                      onChange={(event) => update({ title: event.target.value })}
                    />
                  </Field>
                  {fields.kind === "note" ? (
                    <Field number={4} label="Хураангуй" htmlFor="dandar-scan-summary">
                      <Textarea
                        id="dandar-scan-summary"
                        rows={4}
                        value={fields.summary}
                        maxLength={FIELD_LIMITS.summary}
                        onChange={(event) => update({ summary: event.target.value })}
                      />
                    </Field>
                  ) : fields.kind === "exam" ? (
                    <Field number={4} label="Илгээх багш">
                      <SelectMember
                        mode="single"
                        value={fields.teacherId || undefined}
                        onValueChange={(value) =>
                          update({
                            teacherId: Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
                          })
                        }
                        placeholder="Багш сонгох"
                      />
                      {!fields.teacherId ? (
                        <p className="dandar:text-xs dandar:text-muted-foreground">
                          Багш сонгохгүй бол дараа нь "Миний материал"-аас илгээж болно.
                        </p>
                      ) : null}
                    </Field>
                  ) : null}
                  <Field
                    number={fields.kind === "other" ? 4 : 5}
                    label="Уншсан текст"
                    htmlFor="dandar-scan-text"
                    badge={<ConfidenceBadge confident={!fields.text.includes("[?]")} />}
                  >
                    <Textarea
                      id="dandar-scan-text"
                      rows={8}
                      value={fields.text}
                      maxLength={FIELD_LIMITS.text}
                      className="dandar:font-mono dandar:text-sm"
                      onChange={(event) => update({ text: event.target.value })}
                    />
                    {fields.text.includes("[?]") ? (
                      <p className="dandar:text-xs dandar:text-muted-foreground">
                        [?] — Gemma уншиж чадаагүй үг. Зурагтай харьцуулж засна уу.
                      </p>
                    ) : null}
                  </Field>
                  <div className="dandar:flex dandar:flex-col dandar:gap-3 dandar:border-t dandar:border-border dandar:pt-4">
                    <div className="dandar:flex dandar:flex-wrap dandar:gap-2">
                      <Button className="dandar:flex-1" disabled={!canSave} onClick={onSave}>
                        <IconCheck />
                        {saving ? "Хадгалж байна…" : "Баталгаажуулж хадгалах"}
                      </Button>
                      <Button variant="outline" disabled={saving} onClick={() => runRead(image)}>
                        <IconRefresh />
                        Дахин скан хийх
                      </Button>
                    </div>
                    <p className="dandar:flex dandar:items-center dandar:gap-2 dandar:text-xs dandar:text-muted-foreground">
                      <IconShieldCheck className="dandar:size-4 dandar:shrink-0" />
                      Таны баталгаагүйгээр юу ч хадгалагдахгүй.
                    </p>
                  </div>
                </>
              ) : null}
            </Card.Content>
          </Card>
        </div>
      )}
    </section>
  );
};
