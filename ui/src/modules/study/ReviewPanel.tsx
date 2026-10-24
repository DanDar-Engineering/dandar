import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { IconBulb, IconPlayerPlay, IconPlayerSkipForward, IconSparkles } from "@tabler/icons-react";
import { Badge, Button, Card, Empty, Kbd, Skeleton, cn, toast } from "erxes-ui";
import type { DandarCardGrade, DandarCardHelpMode } from "~/gql/graphql";
import { formatInterval } from "./format";
import { type SessionEntry, SessionSummary } from "./SessionSummary";
import {
  CARD_HELP_MUTATION,
  CARD_REVIEW_MUTATION,
  DECK_MASTERY_QUERY,
  DUE_CARDS_QUERY,
  EXAMS_QUERY,
  STUDY_COUNTS_QUERY,
  STUDY_REFETCH,
} from "./graphql";

const GRADES: { grade: DandarCardGrade; label: string; key: string; className: string }[] = [
  { grade: "forgot", label: "Мартсан", key: "1", className: "dandar:bg-warning/15" },
  { grade: "unsure", label: "Хэцүү", key: "2", className: "" },
  { grade: "know", label: "Сайн", key: "3", className: "dandar:bg-primary/10" },
  { grade: "easy", label: "Амархан", key: "4", className: "dandar:bg-success/15" },
];

const PAGE = 20;

// Shortcuts must not fire while the student types somewhere else on the page.
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const Bar = ({ value }: { value: number }) => (
  <div className="dandar:h-1.5 dandar:w-full dandar:overflow-hidden dandar:rounded-full dandar:bg-muted">
    <div
      className="dandar:h-full dandar:rounded-full dandar:bg-primary dandar:transition-all"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

const WeakDecks = () => {
  const { data } = useQuery(DECK_MASTERY_QUERY);
  const weak = (data?.dandarDeckMastery ?? []).filter((deck) => deck.weak);
  if (!weak.length) return null;

  return (
    <Card>
      <Card.Header>
        <Card.Title className="dandar:text-base">Илүү ойр давтах сэдэв</Card.Title>
        <Card.Description>Эдгээр багцын картууд илүү ойр давтагдана.</Card.Description>
      </Card.Header>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-3">
        {weak.map((deck) => (
          <div key={deck.deck} className="dandar:flex dandar:flex-col dandar:gap-1">
            <div className="dandar:flex dandar:items-center dandar:justify-between dandar:text-sm">
              <span>{deck.deck}</span>
              <span className="dandar:text-muted-foreground">
                {deck.mastery}% · {deck.cards} карт
              </span>
            </div>
            <Bar value={deck.mastery} />
          </div>
        ))}
      </Card.Content>
    </Card>
  );
};

export const ReviewPanel = () => {
  const [shown, setShown] = useState(false);
  const [help, setHelp] = useState("");
  const [session, setSession] = useState<SessionEntry[]>([]);
  const done = session.length;
  // Skipped cards go to the back of this session only; the schedule is unchanged.
  const [skipped, setSkipped] = useState<string[]>([]);

  const counts = useQuery(STUDY_COUNTS_QUERY);
  const due = useQuery(DUE_CARDS_QUERY, { variables: { limit: PAGE } });
  const exams = useQuery(EXAMS_QUERY);

  const [review, { loading: reviewing }] = useMutation(CARD_REVIEW_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    awaitRefetchQueries: true,
    onCompleted: () => {
      setShown(false);
      setHelp("");
    },
    onError: (error) =>
      toast({ title: "Хадгалж чадсангүй", description: error.message, variant: "destructive" }),
  });
  const [askHelp, { loading: helping }] = useMutation(CARD_HELP_MUTATION, {
    onCompleted: ({ dandarCardHelp }) => setHelp(dandarCardHelp),
    onError: (error) =>
      toast({ title: "Gemma хариулсангүй", description: error.message, variant: "destructive" }),
  });

  const cards = due.data?.dandarDueCards ?? [];
  const ordered = [
    ...cards.filter((item) => !skipped.includes(item._id)),
    ...cards.filter((item) => skipped.includes(item._id)),
  ];
  const card = ordered[0];

  const grade = (value: DandarCardGrade) => {
    if (!card || reviewing) return;
    const entry = { deck: card.deck, front: card.front, back: card.back, grade: value };
    void review({ variables: { _id: card._id, grade: value } }).then((result) => {
      if (result.data) setSession((list) => [...list, entry]);
    });
  };
  const skip = () => {
    if (!card) return;
    setSkipped((current) => [...current.filter((id) => id !== card._id), card._id]);
    setShown(false);
    setHelp("");
  };
  const ask = (mode: DandarCardHelpMode) => card && askHelp({ variables: { _id: card._id, mode } });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!card || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (!shown && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setShown(true);
        return;
      }
      const match = GRADES.find((item) => item.key === event.key);
      if (shown && match) {
        event.preventDefault();
        grade(match.grade);
        return;
      }
      if (event.key === "s" || event.key === "S") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (due.loading || counts.loading) {
    return (
      <div role="status" className="dandar:flex dandar:flex-col dandar:gap-3">
        <Skeleton className="dandar:h-28 dandar:w-full" />
        <Skeleton className="dandar:h-64 dandar:w-full" />
      </div>
    );
  }
  if (due.error || counts.error) {
    const error = due.error ?? counts.error;
    return (
      <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
        <p>{error?.message}</p>
        <Button
          variant="outline"
          className="dandar:w-fit"
          onClick={() => {
            due.refetch();
            counts.refetch();
          }}
        >
          Дахин оролдох
        </Button>
      </div>
    );
  }

  const stats = counts.data?.dandarStudyCounts;
  const queue = (stats?.newCards ?? 0) + (stats?.dueCards ?? 0);
  const sessionTotal = done + queue;
  const nextExam = [...(exams.data?.dandarExams ?? [])].sort((a, b) => a.daysLeft - b.daysLeft)[0];

  return (
    <div className="dandar:flex dandar:flex-col dandar:gap-4">
      <section className="dandar:flex dandar:flex-wrap dandar:items-center dandar:justify-between dandar:gap-4 dandar:rounded-xl dandar:bg-primary dandar:p-5 dandar:text-primary-foreground">
        <div className="dandar:flex dandar:flex-col">
          <span className="dandar:text-sm dandar:opacity-80">Өнөөдрийн давтлага</span>
          <span className="dandar:text-3xl dandar:font-semibold">
            {queue}{" "}
            <span className="dandar:text-base dandar:font-medium">
              карт · ~{Math.max(1, Math.round(queue * 0.5))} мин
            </span>
          </span>
          <span className="dandar:text-sm dandar:opacity-80">
            Шинэ {stats?.newCards ?? 0} · Давтах {stats?.dueCards ?? 0} · Нийт {stats?.total ?? 0}
          </span>
        </div>
        {nextExam ? (
          <div className="dandar:flex dandar:flex-col dandar:gap-1 dandar:rounded-lg dandar:bg-background/15 dandar:p-3 dandar:text-sm">
            <span className="dandar:font-medium">
              🎯 {nextExam.deck} · {nextExam.daysLeft} хоног
            </span>
            <span className="dandar:opacity-90">
              {nextExam.readiness}% тогтсон · давталт {nextExam.rounds}%
            </span>
          </div>
        ) : null}
      </section>

      {!card && done ? (
        <SessionSummary entries={session} nextDueAt={stats?.nextDueAt} />
      ) : !card ? (
        <Card>
          <Card.Content className="dandar:pt-6">
            <Empty>
              <Empty.Header>
                <Empty.Title>Өнөөдөр давтах карт алга 🎯</Empty.Title>
                <Empty.Description>Шинэ карт нэмж, эсвэл дараа эргэж ирээрэй.</Empty.Description>
              </Empty.Header>
            </Empty>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Header className="dandar:flex dandar:flex-col dandar:gap-2">
            <div className="dandar:flex dandar:items-center dandar:justify-between dandar:text-sm dandar:text-muted-foreground">
              <span className="dandar:flex dandar:items-center dandar:gap-2">
                {card.deck}
                {card.reviews === 0 ? <Badge variant="info">Шинэ</Badge> : null}
              </span>
              <span>
                {done + 1} / {sessionTotal}
              </span>
            </div>
            <Bar value={(done / Math.max(1, sessionTotal)) * 100} />
          </Card.Header>
          <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
            <div>
              <span className="dandar:text-xs dandar:tracking-wide dandar:text-muted-foreground">
                АСУУЛТ
              </span>
              <p className="dandar:mt-1 dandar:whitespace-pre-wrap dandar:text-xl dandar:font-semibold">
                {card.front}
              </p>
            </div>
            {shown ? (
              <div className="dandar:border-t dandar:border-dashed dandar:border-border dandar:pt-4">
                <span className="dandar:text-xs dandar:tracking-wide dandar:text-muted-foreground">
                  ХАРИУЛТ
                </span>
                <p className="dandar:mt-1 dandar:whitespace-pre-wrap dandar:text-lg">{card.back}</p>
              </div>
            ) : null}

            {shown ? (
              <>
                <p className="dandar:text-sm dandar:text-muted-foreground">
                  Хэр санаж чадсан бэ? Зөвхөн дараагийн давталтын цагийг тохируулна. Оноо, дүн
                  байхгүй.
                </p>
                <div className="dandar:grid dandar:grid-cols-2 dandar:gap-2 dandar:sm:grid-cols-4">
                  {GRADES.map(({ grade: value, label, key, className }) => (
                    <Button
                      key={value}
                      variant="outline"
                      disabled={reviewing}
                      onClick={() => grade(value)}
                      className={cn(
                        "dandar:h-auto dandar:flex-col dandar:gap-0 dandar:py-3",
                        className,
                      )}
                    >
                      <span className="dandar:font-medium">{label}</span>
                      <span className="dandar:text-xs dandar:font-normal dandar:opacity-70">
                        {card.preview ? formatInterval(card.preview[value]) : ""} · {key}
                      </span>
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="dandar:w-fit"
                  disabled={helping}
                  onClick={() => ask("explain")}
                >
                  <IconSparkles />
                  Ойлгомжгүй юу? Тайлбарлуулах
                </Button>
              </>
            ) : (
              <div className="dandar:flex dandar:flex-wrap dandar:gap-2">
                <Button onClick={() => setShown(true)}>
                  <IconPlayerPlay />
                  Хариу харуулах
                </Button>
                <Button variant="outline" disabled={helping} onClick={() => ask("hint")}>
                  <IconBulb />
                  Hint
                </Button>
                <Button variant="outline" disabled={helping} onClick={() => ask("mnemonic")}>
                  Санах арга
                </Button>
                <Button variant="ghost" onClick={skip}>
                  <IconPlayerSkipForward />
                  Алгасах
                </Button>
              </div>
            )}
            {helping ? (
              <p role="status" className="dandar:text-sm dandar:text-muted-foreground">
                Gemma бодож байна…
              </p>
            ) : null}
            {help ? (
              <p className="dandar:whitespace-pre-wrap dandar:rounded-lg dandar:bg-muted dandar:p-3 dandar:text-sm">
                {help}
              </p>
            ) : null}
            <p className="dandar:flex dandar:flex-wrap dandar:items-center dandar:gap-1 dandar:text-xs dandar:text-muted-foreground">
              <Kbd>Space</Kbd> хариу · <Kbd>1</Kbd>–<Kbd>4</Kbd> үнэлгээ · <Kbd>S</Kbd> алгасах
            </p>
          </Card.Content>
        </Card>
      )}

      <WeakDecks />
    </div>
  );
};
