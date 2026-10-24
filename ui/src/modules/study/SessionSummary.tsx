import { useMutation } from "@apollo/client";
import { useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { Button, Card } from "erxes-ui";
import type { DandarCardGrade } from "~/gql/graphql";
import { type Draft, DraftEditor } from "./DraftEditor";
import { CARDS_DRAFT_MUTATION } from "./graphql";

export type SessionEntry = { deck: string; front: string; back: string; grade: DandarCardGrade };

const LABELS: Record<DandarCardGrade, string> = {
  forgot: "Мартсан",
  unsure: "Хэцүү",
  know: "Сайн",
  easy: "Амархан",
};
const ORDER: DandarCardGrade[] = ["forgot", "unsure", "know", "easy"];

const mostCommon = (items: string[]) => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
};

const whenNext = (iso: string | null | undefined) => {
  if (!iso) return null;
  const date = new Date(iso);
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  const time = date.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
  return days <= 0 ? `өнөөдөр ${time}` : days === 1 ? `маргааш ${time}` : `${days} өдрийн дараа`;
};

// Shown when the queue is empty after a session: what went well, what was
// hard, when to come back, and Gemma cards that ask the hard ones differently.
export const SessionSummary = ({
  entries,
  nextDueAt,
}: {
  entries: SessionEntry[];
  nextDueAt?: string | null;
}) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const hard = entries.filter((entry) => entry.grade === "forgot" || entry.grade === "unsure");
  const [makeDraft, { loading, error }] = useMutation(CARDS_DRAFT_MUTATION, {
    onError: () => undefined,
  });

  const generate = async () => {
    const notes = hard
      .map((entry) => `Асуулт: ${entry.front}\nХариулт: ${entry.back}`)
      .join("\n\n");
    const result = await makeDraft({
      variables: {
        notes,
        options: {
          count: Math.min(8, Math.max(3, hard.length * 2)),
          level: "medium",
          kind: "qa",
          lang: "auto",
          instructions:
            "Эдгээр картын ойлголтыг өөр өнцгөөс асуусан шинэ карт гарга, яг ижил асуултыг бүү давт",
        },
      },
    });
    const data = result.data?.dandarCardsDraft;
    if (data) {
      setDraft({
        deck: mostCommon(hard.map((entry) => entry.deck)) || data.deck,
        examDate: "",
        cards: data.cards.map((card) => ({ ...card, keep: true })),
        scanIds: [],
      });
    }
  };

  if (draft) {
    return (
      <DraftEditor
        initial={draft}
        decks={[...new Set(entries.map((entry) => entry.deck))]}
        onDone={() => setDraft(null)}
      />
    );
  }

  const next = whenNext(nextDueAt);

  return (
    <Card>
      <Card.Header>
        <Card.Title>Өнөөдөр {entries.length} карт давтлаа 🎯</Card.Title>
        <Card.Description>
          {next ? `Дараагийн давтлага ${next}.` : "Давтах карт дууссан."}
        </Card.Description>
      </Card.Header>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
        <dl className="dandar:grid dandar:grid-cols-2 dandar:gap-2 dandar:sm:grid-cols-4">
          {ORDER.map((grade) => (
            <div
              key={grade}
              className="dandar:rounded-lg dandar:border dandar:border-border dandar:p-3"
            >
              <dt className="dandar:text-xs dandar:text-muted-foreground">{LABELS[grade]}</dt>
              <dd className="dandar:text-xl dandar:font-semibold dandar:tabular-nums">
                {entries.filter((entry) => entry.grade === grade).length}
              </dd>
            </div>
          ))}
        </dl>
        {hard.length ? (
          <>
            <div className="dandar:flex dandar:flex-col dandar:gap-1">
              <span className="dandar:text-sm dandar:font-medium">Хэцүү байсан картууд</span>
              <ul className="dandar:divide-y dandar:divide-border dandar:text-sm">
                {hard.map((entry, i) => (
                  <li
                    key={i}
                    className="dandar:flex dandar:justify-between dandar:gap-3 dandar:py-2"
                  >
                    <span>{entry.front}</span>
                    <span className="dandar:text-muted-foreground">{entry.back}</span>
                  </li>
                ))}
              </ul>
            </div>
            {error ? (
              <p role="alert" className="dandar:text-sm dandar:text-destructive">
                {error.message}
              </p>
            ) : null}
            <Button className="dandar:w-fit" disabled={loading} onClick={() => void generate()}>
              <IconSparkles />
              {loading ? "Gemma бодож байна…" : "Хэцүү картуудаас өөр өнцгийн карт үүсгэх"}
            </Button>
          </>
        ) : (
          <p className="dandar:text-sm dandar:text-muted-foreground">Бүгдийг сайн санаж байлаа.</p>
        )}
      </Card.Content>
    </Card>
  );
};
