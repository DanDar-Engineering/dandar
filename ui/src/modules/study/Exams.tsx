import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { Button, Card, Empty, Input, Label, Skeleton, toast } from "erxes-ui";
import { formatDate } from "./format";
import {
  DECK_MASTERY_QUERY,
  EXAMS_QUERY,
  EXAM_DELETE_MUTATION,
  EXAM_SET_MUTATION,
  STUDY_REFETCH,
} from "./graphql";

const Bar = ({ value }: { value: number }) => (
  <div className="dandar:h-2 dandar:w-full dandar:overflow-hidden dandar:rounded-full dandar:bg-muted">
    <div
      className="dandar:h-full dandar:rounded-full dandar:bg-primary"
      style={{ width: `${value}%` }}
    />
  </div>
);

export const Exams = () => {
  const [deck, setDeck] = useState("");
  const [date, setDate] = useState("");
  const exams = useQuery(EXAMS_QUERY);
  const decks = useQuery(DECK_MASTERY_QUERY).data?.dandarDeckMastery ?? [];

  const [setExam, { loading: saving }] = useMutation(EXAM_SET_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    awaitRefetchQueries: true,
    onCompleted: () => toast({ title: "Шалгалтын хуваарь хадгаллаа", variant: "success" }),
    onError: (error) =>
      toast({ title: "Хадгалж чадсангүй", description: error.message, variant: "destructive" }),
  });
  const [removeExam] = useMutation(EXAM_DELETE_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    onError: (error) =>
      toast({ title: "Устгаж чадсангүй", description: error.message, variant: "destructive" }),
  });

  const list = [...(exams.data?.dandarExams ?? [])].sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="dandar:flex dandar:flex-col dandar:gap-4">
      <Card>
        <Card.Header>
          <Card.Title>Шалгалтын бэлдэлт</Card.Title>
          <Card.Description>
            Шалгалт ойртох тусам картуудыг олон удаа давтуулна. Давталт шалгалтын өмнөх өдрөөс
            хэтрэхгүй.
          </Card.Description>
        </Card.Header>
        <Card.Content className="dandar:flex dandar:flex-wrap dandar:items-end dandar:gap-3">
          <div className="dandar:flex dandar:flex-col dandar:gap-2">
            <Label htmlFor="dandar-exam-deck">Багц</Label>
            <Input
              id="dandar-exam-deck"
              list="dandar-exam-decks"
              value={deck}
              onChange={(event) => setDeck(event.target.value)}
            />
            <datalist id="dandar-exam-decks">
              {decks.map((item) => (
                <option key={item.deck} value={item.deck} />
              ))}
            </datalist>
          </div>
          <div className="dandar:flex dandar:flex-col dandar:gap-2">
            <Label htmlFor="dandar-exam-date">Шалгалтын огноо</Label>
            <Input
              id="dandar-exam-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <Button
            disabled={!deck.trim() || !date || saving}
            onClick={() => setExam({ variables: { deck: deck.trim(), date } })}
          >
            Хадгалах
          </Button>
        </Card.Content>
      </Card>

      {exams.loading ? (
        <Skeleton className="dandar:h-24 dandar:w-full" />
      ) : exams.error ? (
        <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
          <p>{exams.error.message}</p>
          <Button variant="outline" className="dandar:w-fit" onClick={() => exams.refetch()}>
            Дахин оролдох
          </Button>
        </div>
      ) : list.length === 0 ? (
        <Empty>
          <Empty.Header>
            <Empty.Title>Шалгалт товлоогүй байна</Empty.Title>
            <Empty.Description>
              Багц болон огноогоо оруулбал давтлагын хуваарь гарна.
            </Empty.Description>
          </Empty.Header>
        </Empty>
      ) : (
        list.map((exam) => (
          <Card key={exam.deck}>
            <Card.Content className="dandar:flex dandar:flex-col dandar:gap-3 dandar:pt-6">
              <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:justify-between dandar:gap-2">
                <span className="dandar:font-medium">🎯 {exam.deck}</span>
                <span className="dandar:text-sm dandar:text-muted-foreground">
                  {formatDate(exam.examAt)} · {exam.daysLeft} хоног үлдсэн
                </span>
              </div>
              <div className="dandar:flex dandar:flex-col dandar:gap-1">
                <span className="dandar:text-sm">
                  Тогтсон: {exam.readiness}% · {exam.cards} карт
                </span>
                <Bar value={exam.readiness} />
              </div>
              <div className="dandar:flex dandar:flex-col dandar:gap-1">
                <span className="dandar:text-sm">
                  Давталт: {exam.rounds}% (картад {exam.targetRounds} удаа)
                </span>
                <Bar value={exam.rounds} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="dandar:w-fit"
                onClick={() => removeExam({ variables: { deck: exam.deck } })}
              >
                Шалгалтыг устгах
              </Button>
            </Card.Content>
          </Card>
        ))
      )}
    </div>
  );
};
