import { useQuery } from "@apollo/client";
import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { Button, Card, Skeleton, cn } from "erxes-ui";
import { weekday } from "./format";
import { STUDY_PROGRESS_QUERY } from "./graphql";

type Column = { date: string; value: number; detail: string };

// One series, so no legend: the card title names it. Columns are ≤24px with a
// rounded top and a square base; the whole slot is the hover target.
const Columns = ({
  label,
  columns,
  today,
}: {
  label: string;
  columns: Column[];
  today?: string;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...columns.map((column) => column.value));
  const peak = columns.reduce(
    (best, column, i) => (column.value > (columns[best]?.value ?? 0) ? i : best),
    0,
  );

  return (
    <figure className="dandar:m-0 dandar:flex dandar:flex-col dandar:gap-2">
      <div className="dandar:relative dandar:flex dandar:h-36 dandar:items-end dandar:gap-0.5 dandar:border-b dandar:border-border">
        {columns.map((column, i) => (
          <div
            key={column.date}
            role="presentation"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="dandar:relative dandar:flex dandar:h-full dandar:flex-1 dandar:flex-col dandar:items-center dandar:justify-end"
          >
            {/* The tallest column carries its value; the rest show on hover. */}
            {(i === peak && column.value > 0) || hover === i ? (
              <span className="dandar:mb-1 dandar:text-xs dandar:font-medium dandar:tabular-nums">
                {column.value}
              </span>
            ) : null}
            <div
              className={cn(
                "dandar:w-full dandar:max-w-6 dandar:rounded-t dandar:bg-primary dandar:transition-opacity",
                hover !== null && hover !== i && "dandar:opacity-50",
              )}
              style={{ height: `${(column.value / max) * 100}%`, minHeight: column.value ? 4 : 0 }}
            />
            {hover === i ? (
              <div className="dandar:absolute dandar:bottom-full dandar:z-10 dandar:mb-1 dandar:whitespace-nowrap dandar:rounded-md dandar:border dandar:border-border dandar:bg-background dandar:px-2 dandar:py-1 dandar:text-xs dandar:shadow-sm">
                {column.date} · {column.detail}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="dandar:flex dandar:gap-0.5">
        {columns.map((column) => (
          <span
            key={column.date}
            className={cn(
              "dandar:flex-1 dandar:text-center dandar:text-xs dandar:text-muted-foreground",
              column.date === today && "dandar:font-semibold dandar:text-foreground",
            )}
          >
            {weekday(column.date)}
          </span>
        ))}
      </div>
      <table className="dandar:sr-only">
        <caption>{label}</caption>
        <tbody>
          {columns.map((column) => (
            <tr key={column.date}>
              <th scope="row">{column.date}</th>
              <td>{column.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

const Stat = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <Card>
    <Card.Content className="dandar:flex dandar:flex-col dandar:gap-1 dandar:pt-6">
      <span className="dandar:text-sm dandar:text-muted-foreground">{label}</span>
      <span className="dandar:text-2xl dandar:font-semibold dandar:tabular-nums">{value}</span>
      <span className="dandar:text-xs dandar:text-muted-foreground">{hint}</span>
    </Card.Content>
  </Card>
);

export const Progress = () => {
  const { data, loading, error, refetch } = useQuery(STUDY_PROGRESS_QUERY, {
    fetchPolicy: "cache-and-network",
  });

  if (loading && !data) {
    return (
      <div role="status" className="dandar:grid dandar:gap-4 dandar:sm:grid-cols-3">
        <Skeleton className="dandar:h-28" />
        <Skeleton className="dandar:h-28" />
        <Skeleton className="dandar:h-28" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
        <p>{error?.message ?? "Ахиц ачаалж чадсангүй"}</p>
        <Button variant="outline" className="dandar:w-fit" onClick={() => refetch()}>
          Дахин оролдох
        </Button>
      </div>
    );
  }

  const progress = data.dandarStudyProgress;
  const today = progress.days[progress.days.length - 1]?.date;
  const upcoming = progress.forecast.reduce((sum, day) => sum + day.due, 0);

  return (
    <div className="dandar:flex dandar:flex-col dandar:gap-4">
      <Card>
        <Card.Header>
          <div className="dandar:flex dandar:items-center dandar:justify-between">
            <Card.Title className="dandar:text-base">Тууштай байдал</Card.Title>
            <span className="dandar:text-sm dandar:font-semibold">
              {progress.activeDays} / 7 өдөр
            </span>
          </div>
          <Card.Description>
            Хамгийн багадаа нэг карт давтсан өдөр. Алгассан өдөр оноо хасагдахгүй.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ol className="dandar:flex dandar:justify-between dandar:gap-2">
            {progress.days.map((day) => (
              <li
                key={day.date}
                className="dandar:flex dandar:flex-col dandar:items-center dandar:gap-1"
              >
                <span
                  aria-label={`${day.date}: ${day.reviewed ? "давтсан" : "давтаагүй"}`}
                  className={cn(
                    "dandar:flex dandar:size-8 dandar:items-center dandar:justify-center dandar:rounded-full dandar:border-2",
                    day.reviewed
                      ? "dandar:border-primary dandar:bg-primary/15"
                      : "dandar:border-border",
                  )}
                >
                  {day.reviewed ? <IconCheck className="dandar:size-4" /> : null}
                </span>
                <span
                  className={cn(
                    "dandar:text-xs dandar:text-muted-foreground",
                    day.date === today && "dandar:font-semibold dandar:text-foreground",
                  )}
                >
                  {weekday(day.date)}
                </span>
              </li>
            ))}
          </ol>
        </Card.Content>
      </Card>

      <div className="dandar:grid dandar:gap-4 dandar:sm:grid-cols-3">
        <Stat label="Энэ 7 хоногт давтсан" value={String(progress.reviewedThisWeek)} hint="карт" />
        <Stat
          label="Санаж байсан"
          value={progress.reviewedThisWeek ? `${progress.rememberedRate}%` : "—"}
          hint="«Сайн», «Амархан» эсвэл тестэд зөв"
        />
        <Stat label="Ирэх 7 хоногт" value={String(upcoming)} hint="карт давтах ээлжтэй" />
      </div>

      <Card>
        <Card.Header>
          <Card.Title className="dandar:text-base">Өдөр бүр давтсан карт</Card.Title>
          <Card.Description>Сүүлийн 7 хоног</Card.Description>
        </Card.Header>
        <Card.Content>
          <Columns
            label="Өдөр бүр давтсан карт"
            today={today}
            columns={progress.days.map((day) => ({
              date: day.date,
              value: day.reviewed,
              detail: `${day.reviewed} карт, ${day.remembered} санасан`,
            }))}
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title className="dandar:text-base">Давтлагын таамаглал</Card.Title>
          <Card.Description>
            Ирэх 7 хоногт өдөр бүр давтах ээлжтэй карт. Хоцорсон картууд өнөөдөрт орно.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Columns
            label="Давтлагын таамаглал"
            today={progress.forecast[0]?.date}
            columns={progress.forecast.map((day) => ({
              date: day.date,
              value: day.due,
              detail: `${day.due} карт`,
            }))}
          />
        </Card.Content>
      </Card>
    </div>
  );
};
