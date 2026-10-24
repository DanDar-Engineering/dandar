import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { IconCheck, IconPlayerPlay, IconRefresh, IconX } from "@tabler/icons-react";
import { Badge, Button, Card, Kbd, cn, toast } from "erxes-ui";
import { DECK_MASTERY_QUERY, QUIZ_ANSWER_MUTATION, QUIZ_QUERY, STUDY_REFETCH } from "./graphql";

const SIZES = [5, 10, 20];

type Answered = { front: string; choice: string; answer: string; correct: boolean };

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

// Multiple choice from the student's own cards. Each answer reschedules the
// card (right = know, wrong = forgot), so a quiz also counts as review.
export const Quiz = () => {
  const [deck, setDeck] = useState<string | null>(null);
  const [size, setSize] = useState(10);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [current, setCurrent] = useState<Answered | null>(null);
  const [running, setRunning] = useState(false);

  const decks = useQuery(DECK_MASTERY_QUERY).data?.dandarDeckMastery ?? [];
  const [load, quiz] = useLazyQuery(QUIZ_QUERY, { fetchPolicy: "network-only" });
  const [answer, { loading: checking }] = useMutation(QUIZ_ANSWER_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    onError: (error) =>
      toast({
        title: "Хариуг шалгаж чадсангүй",
        description: error.message,
        variant: "destructive",
      }),
  });

  const questions = quiz.data?.dandarQuiz ?? [];
  const question = questions[index];
  const finished = running && !quiz.loading && index >= questions.length && questions.length > 0;

  const start = () => {
    setIndex(0);
    setAnswered([]);
    setCurrent(null);
    setRunning(true);
    void load({ variables: { deck, size } });
  };

  const pick = async (choice: string) => {
    if (!question || current || checking) return;
    const result = await answer({ variables: { cardId: question.cardId, choice } });
    const data = result.data?.dandarQuizAnswer;
    if (!data) return;
    const entry = { front: question.front, choice, answer: data.answer, correct: data.correct };
    setCurrent(entry);
    setAnswered((list) => [...list, entry]);
  };

  const next = () => {
    setCurrent(null);
    setIndex((value) => value + 1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        !running ||
        !question ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      )
        return;
      if (current && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        next();
        return;
      }
      const choice = question.choices[Number(event.key) - 1];
      if (!current && choice !== undefined) {
        event.preventDefault();
        void pick(choice);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const empty = running && !quiz.loading && !quiz.error && questions.length === 0;
  if (!running || empty) {
    return (
      <Card>
        <Card.Header>
          <Card.Title>Тест горим</Card.Title>
          <Card.Description>
            Өөрийн картаас 4 сонголттой асуулт гарна. Хамгийн их мартаж буй картууд эхэлж орно,
            хариу бүр давтлагын хуваарьт тооцогдоно.
          </Card.Description>
        </Card.Header>
        <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
          <div className="dandar:flex dandar:flex-col dandar:gap-2">
            <span className="dandar:text-sm dandar:font-medium">Багц</span>
            <div className="dandar:flex dandar:flex-wrap dandar:gap-2">
              <Button
                size="sm"
                variant={deck === null ? "default" : "outline"}
                onClick={() => setDeck(null)}
              >
                Бүх багц
              </Button>
              {decks.map((item) => (
                <Button
                  key={item.deck}
                  size="sm"
                  variant={deck === item.deck ? "default" : "outline"}
                  onClick={() => setDeck(item.deck)}
                >
                  {item.deck}
                </Button>
              ))}
            </div>
          </div>
          <div className="dandar:flex dandar:flex-col dandar:gap-2">
            <span className="dandar:text-sm dandar:font-medium">Асуултын тоо</span>
            <div className="dandar:flex dandar:gap-2">
              {SIZES.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={size === value ? "default" : "outline"}
                  onClick={() => setSize(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
          {empty ? (
            <p className="dandar:text-sm dandar:text-muted-foreground">
              Тест үүсгэхэд дор хаяж өөр хариулттай 2 карт хэрэгтэй. Эхлээд карт нэмнэ үү.
            </p>
          ) : null}
          <Button className="dandar:w-fit" onClick={start}>
            <IconPlayerPlay />
            Эхлэх
          </Button>
        </Card.Content>
      </Card>
    );
  }

  if (quiz.loading) {
    return <p role="status">Асуулт бэлдэж байна…</p>;
  }
  if (quiz.error) {
    return (
      <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
        <p>{quiz.error.message}</p>
        <Button variant="outline" className="dandar:w-fit" onClick={start}>
          Дахин оролдох
        </Button>
      </div>
    );
  }

  if (finished) {
    const right = answered.filter((item) => item.correct).length;
    const wrong = answered.filter((item) => !item.correct);
    return (
      <Card>
        <Card.Header>
          <Card.Title>
            {right} / {answered.length} зөв
          </Card.Title>
          <Card.Description>
            {wrong.length
              ? "Алдсан картууд ойрхон дахин давтагдана."
              : "Бүгдийг зөв хариуллаа. Эдгээр картууд илүү хойш давтагдана."}
          </Card.Description>
        </Card.Header>
        <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
          {wrong.length ? (
            <ul className="dandar:divide-y dandar:divide-border">
              {wrong.map((item, i) => (
                <li
                  key={i}
                  className="dandar:flex dandar:flex-col dandar:gap-1 dandar:py-2 dandar:text-sm"
                >
                  <span className="dandar:font-medium">{item.front}</span>
                  <span className="dandar:text-muted-foreground">
                    Таны хариу: {item.choice} · Зөв:{" "}
                    <span className="dandar:text-foreground">{item.answer}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="dandar:flex dandar:gap-2">
            <Button onClick={start}>
              <IconRefresh />
              Дахин тест
            </Button>
            <Button variant="outline" onClick={() => setRunning(false)}>
              Тохиргоо руу буцах
            </Button>
          </div>
        </Card.Content>
      </Card>
    );
  }

  if (!question) return null;

  return (
    <Card>
      <Card.Header className="dandar:flex dandar:flex-col dandar:gap-2">
        <div className="dandar:flex dandar:items-center dandar:justify-between dandar:text-sm dandar:text-muted-foreground">
          <span>{question.deck}</span>
          <span>
            {index + 1} / {questions.length}
          </span>
        </div>
        <div className="dandar:h-1.5 dandar:w-full dandar:overflow-hidden dandar:rounded-full dandar:bg-muted">
          <div
            className="dandar:h-full dandar:rounded-full dandar:bg-primary dandar:transition-all"
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>
      </Card.Header>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
        <p className="dandar:whitespace-pre-wrap dandar:text-xl dandar:font-semibold">
          {question.front}
        </p>
        <div className="dandar:grid dandar:gap-2 dandar:sm:grid-cols-2">
          {question.choices.map((choice, i) => {
            const isAnswer =
              current && choice.trim().toLowerCase() === current.answer.trim().toLowerCase();
            const isWrongPick = current && !current.correct && choice === current.choice;
            return (
              <Button
                key={choice}
                variant="outline"
                disabled={!!current || checking}
                onClick={() => void pick(choice)}
                className={cn(
                  "dandar:h-auto dandar:justify-start dandar:whitespace-normal dandar:py-3 dandar:text-left dandar:disabled:opacity-100",
                  isAnswer && "dandar:border-success dandar:bg-success/15",
                  isWrongPick && "dandar:border-destructive dandar:bg-destructive/10",
                )}
              >
                <Kbd>{i + 1}</Kbd>
                <span className="dandar:flex-1">{choice}</span>
                {isAnswer ? <IconCheck aria-label="Зөв" /> : null}
                {isWrongPick ? <IconX aria-label="Буруу" /> : null}
              </Button>
            );
          })}
        </div>
        {current ? (
          <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:justify-between dandar:gap-2">
            <Badge variant={current.correct ? "success" : "warning"}>
              {current.correct ? "Зөв!" : "Буруу. Энэ карт ойрхон дахин гарна."}
            </Badge>
            <Button onClick={next}>
              {index + 1 < questions.length ? "Дараах" : "Дүн харах"} <Kbd>Enter</Kbd>
            </Button>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
};
