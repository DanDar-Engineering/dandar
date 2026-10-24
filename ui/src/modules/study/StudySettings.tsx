import { useMutation, useQuery } from "@apollo/client";
import { type ReactNode, useEffect, useState } from "react";
import { IconBell, IconMoon } from "@tabler/icons-react";
import { Button, Card, Label, Select, Skeleton, Switch, toast } from "erxes-ui";
import { STUDY_SETTINGS_QUERY, STUDY_SETTINGS_SAVE_MUTATION } from "./graphql";

type Settings = {
  reviewReminder: boolean;
  reminderHour: number;
  examAlerts: boolean;
  quietStart: number;
  quietEnd: number;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

// Mirrors isQuietHour in api/src/modules/study/logic/reminders.ts.
const isQuietHour = (hour: number, start: number, end: number) =>
  start !== end && (start > end ? hour >= start || hour < end : hour >= start && hour < end);

const HourSelect = ({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (hour: number) => void;
}) => (
  <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
    <Select.Trigger id={id} className="dandar:w-28">
      <Select.Value />
    </Select.Trigger>
    <Select.Content>
      {HOURS.map((hour) => (
        <Select.Item key={hour} value={String(hour)}>
          {pad(hour)}
        </Select.Item>
      ))}
    </Select.Content>
  </Select>
);

const Row = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <div className="dandar:flex dandar:items-center dandar:justify-between dandar:gap-4">
    <div className="dandar:flex dandar:flex-col">
      <span className="dandar:text-sm dandar:font-medium">{title}</span>
      <span className="dandar:text-xs dandar:text-muted-foreground">{description}</span>
    </div>
    {children}
  </div>
);

export const StudySettings = () => {
  const { data, loading, error, refetch } = useQuery(STUDY_SETTINGS_QUERY);
  const [form, setForm] = useState<Settings | null>(null);

  useEffect(() => {
    const stored = data?.dandarStudySettings;
    if (stored) {
      setForm({
        reviewReminder: stored.reviewReminder,
        reminderHour: stored.reminderHour,
        examAlerts: stored.examAlerts,
        quietStart: stored.quietStart,
        quietEnd: stored.quietEnd,
      });
    }
  }, [data]);

  const [save, { loading: saving }] = useMutation(STUDY_SETTINGS_SAVE_MUTATION, {
    refetchQueries: ["dandarStudySettings"],
    onCompleted: () => toast({ title: "Тохиргоо хадгаллаа", variant: "success" }),
    onError: (saveError) =>
      toast({ title: "Хадгалж чадсангүй", description: saveError.message, variant: "destructive" }),
  });

  if (loading || !form) {
    return error ? (
      <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
        <p>{error.message}</p>
        <Button variant="outline" className="dandar:w-fit" onClick={() => refetch()}>
          Дахин оролдох
        </Button>
      </div>
    ) : (
      <Skeleton className="dandar:h-64 dandar:w-full" />
    );
  }

  const update = (patch: Partial<Settings>) => setForm({ ...form, ...patch });
  const clash = isQuietHour(form.reminderHour, form.quietStart, form.quietEnd);

  return (
    <div className="dandar:flex dandar:flex-col dandar:gap-4">
      <Card>
        <Card.Header>
          <Card.Title className="dandar:flex dandar:items-center dandar:gap-2">
            <IconBell className="dandar:size-5" />
            Мэдэгдэл
          </Card.Title>
          <Card.Description>
            erxes-ийн хонх дээр ирнэ. Өдөрт нэг удаа, таны сонгосон цагт.
          </Card.Description>
        </Card.Header>
        <Card.Content className="dandar:flex dandar:flex-col dandar:gap-5">
          <Row title="Давтлагын сануулга" description="Давтах карт байвал сануулна">
            <Switch
              aria-label="Давтлагын сануулга"
              checked={form.reviewReminder}
              onCheckedChange={(checked) => update({ reviewReminder: checked })}
            />
          </Row>
          <Row title="Шалгалтын сануулга" description="Шалгалтаас 7, 3, 1 хоногийн өмнө">
            <Switch
              aria-label="Шалгалтын сануулга"
              checked={form.examAlerts}
              onCheckedChange={(checked) => update({ examAlerts: checked })}
            />
          </Row>
          <Row title="Сануулах цаг" description="Хоёр сануулга хоёулаа энэ цагт ирнэ">
            <HourSelect
              id="dandar-reminder-hour"
              value={form.reminderHour}
              onChange={(reminderHour) => update({ reminderHour })}
            />
          </Row>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title className="dandar:flex dandar:items-center dandar:gap-2">
            <IconMoon className="dandar:size-5" />
            Тайван цаг
          </Card.Title>
          <Card.Description>Энэ хооронд ямар ч мэдэгдэл ирэхгүй.</Card.Description>
        </Card.Header>
        <Card.Content className="dandar:flex dandar:flex-wrap dandar:items-end dandar:gap-4">
          <div className="dandar:flex dandar:flex-col dandar:gap-2">
            <Label htmlFor="dandar-quiet-start">Эхлэх</Label>
            <HourSelect
              id="dandar-quiet-start"
              value={form.quietStart}
              onChange={(quietStart) => update({ quietStart })}
            />
          </div>
          <div className="dandar:flex dandar:flex-col dandar:gap-2">
            <Label htmlFor="dandar-quiet-end">Дуусах</Label>
            <HourSelect
              id="dandar-quiet-end"
              value={form.quietEnd}
              onChange={(quietEnd) => update({ quietEnd })}
            />
          </div>
        </Card.Content>
      </Card>

      {clash ? (
        <p role="alert" className="dandar:text-sm dandar:text-destructive">
          Сануулах цаг тайван цаг дотор байна. Өөр цаг сонгоно уу.
        </p>
      ) : null}
      <Button
        className="dandar:w-fit"
        disabled={saving || clash}
        onClick={() => save({ variables: { input: form } })}
      >
        {saving ? "Хадгалж байна…" : "Хадгалах"}
      </Button>
    </div>
  );
};
