import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { IconBulb, IconPlayerPlay, IconSparkles } from "@tabler/icons-react";
import { Button, Card, Empty, Skeleton, cn, toast } from "erxes-ui";
import type { DandarCardGrade, DandarCardHelpMode } from "~/gql/graphql";
import { formatInterval } from "./format";
import {
  CARD_HELP_MUTATION,
  CARD_REVIEW_MUTATION,
  DUE_CARDS_QUERY,
  EXAMS_QUERY,
  STUDY_COUNTS_QUERY,
  STUDY_REFETCH,
} from "./graphql";

const GRADES: { grade: DandarCardGrade; label: string; className: string }[] = [
  { grade: "forgot", label: "Мартсан", className: "dandar:bg-warning/15" },
  { grade: "unsure", label: "Хэцүү", className: "" },
  { grade: "know", label: "Сайн", className: "dandar:bg-primary/10" },
  { grade: "easy", label: "Амархан", className: "dandar:bg-success/15" },
];

const PAGE = 20;

export const ReviewPanel = () => {
  const [shown, setShown] = useState(false);
  const [help, setHelp] = useState("");

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

  const cards = due.data?.dandarDueCards ?? [];
  const card = cards[0];
  const stats = counts.data?.dandarStudyCounts;
  const queue = (stats?.newCards ?? 0) + (stats?.dueCards ?? 0);
  const nextExam = [...(exams.data?.dandarExams ?? [])].sort((a, b) => a.daysLeft - b.daysLeft)[0];
  const ask = (mode: DandarCardHelpMode) => card && askHelp({ variables: { _id: card._id, mode } });

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

      {!card ? (
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
          <Card.Header>
            <div className="dandar:flex dandar:items-center dandar:justify-between dandar:text-sm dandar:text-muted-foreground">
              <span>{card.deck}</span>
              <span>{card.reviews === 0 ? "Шинэ карт" : `${card.reviews} удаа давтсан`}</span>
            </div>
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
                <p className="dandar:text-sm dandar:text-muted-foreground">Хэр санаж чадсан бэ?</p>
                <div className="dandar:grid dandar:grid-cols-2 dandar:gap-2 dandar:sm:grid-cols-4">
                  {GRADES.map(({ grade, label, className }) => (
                    <Button
                      key={grade}
                      variant="outline"
                      disabled={reviewing}
                      onClick={() => review({ variables: { _id: card._id, grade } })}
                      className={cn(
                        "dandar:h-auto dandar:flex-col dandar:gap-0 dandar:py-3",
                        className,
                      )}
                    >
                      <span className="dandar:font-medium">{label}</span>
                      <span className="dandar:text-xs dandar:font-normal dandar:opacity-70">
                        {card.preview ? formatInterval(card.preview[grade]) : ""}
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
          </Card.Content>
        </Card>
      )}
    </div>
  );
};
