import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import { Badge, Button, Card, Empty, Skeleton, toast } from "erxes-ui";
import {
  DECK_MASTERY_QUERY,
  CARD_DELETE_MUTATION,
  STUDY_CARDS_QUERY,
  STUDY_REFETCH,
} from "./graphql";

const PAGE_SIZE = 20;

export const Library = () => {
  const [deck, setDeck] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const decks = useQuery(DECK_MASTERY_QUERY);
  const cards = useQuery(STUDY_CARDS_QUERY, { variables: { deck, limit: PAGE_SIZE, offset } });
  const [remove] = useMutation(CARD_DELETE_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    onError: (error) =>
      toast({ title: "Устгаж чадсангүй", description: error.message, variant: "destructive" }),
  });

  const list = cards.data?.dandarStudyCards ?? [];

  return (
    <div className="dandar:flex dandar:flex-col dandar:gap-4">
      <Card>
        <Card.Header>
          <Card.Title>Сэдвийн тогтолт</Card.Title>
          <Card.Description>
            Санаж байгаа магадлалаар. Сул сэдвийг илүү ойр давтуулна.
          </Card.Description>
        </Card.Header>
        <Card.Content className="dandar:flex dandar:flex-col dandar:gap-3">
          {decks.loading ? (
            <Skeleton className="dandar:h-16 dandar:w-full" />
          ) : decks.error ? (
            <p role="alert" className="dandar:text-sm">
              {decks.error.message}
            </p>
          ) : (decks.data?.dandarDeckMastery ?? []).length === 0 ? (
            <p className="dandar:text-sm dandar:text-muted-foreground">Карт алга.</p>
          ) : (
            <>
              <div className="dandar:flex dandar:flex-wrap dandar:gap-2">
                <Button
                  size="sm"
                  variant={deck === null ? "default" : "outline"}
                  onClick={() => {
                    setDeck(null);
                    setOffset(0);
                  }}
                >
                  Бүгд
                </Button>
                {decks.data?.dandarDeckMastery.map((item) => (
                  <Button
                    key={item.deck}
                    size="sm"
                    variant={deck === item.deck ? "default" : "outline"}
                    onClick={() => {
                      setDeck(item.deck);
                      setOffset(0);
                    }}
                  >
                    {item.deck} · {item.cards}
                  </Button>
                ))}
              </div>
              {decks.data?.dandarDeckMastery.map((item) => (
                <div key={item.deck} className="dandar:flex dandar:flex-col dandar:gap-1">
                  <div className="dandar:flex dandar:items-center dandar:justify-between dandar:text-sm">
                    <span className="dandar:flex dandar:items-center dandar:gap-2">
                      {item.deck}
                      {item.weak ? <Badge variant="warning">Сул сэдэв</Badge> : null}
                    </span>
                    <span className="dandar:text-muted-foreground">{item.mastery}%</span>
                  </div>
                  <div className="dandar:h-2 dandar:overflow-hidden dandar:rounded-full dandar:bg-muted">
                    <div
                      className="dandar:h-full dandar:rounded-full dandar:bg-primary"
                      style={{ width: `${item.mastery}%` }}
                    />
                  </div>
                </div>
              ))}
            </>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Картууд</Card.Title>
        </Card.Header>
        <Card.Content className="dandar:flex dandar:flex-col dandar:gap-3">
          {cards.loading ? (
            <p role="status">Ачаалж байна…</p>
          ) : cards.error ? (
            <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
              <p>{cards.error.message}</p>
              <Button variant="outline" className="dandar:w-fit" onClick={() => cards.refetch()}>
                Дахин оролдох
              </Button>
            </div>
          ) : list.length === 0 ? (
            <Empty>
              <Empty.Header>
                <Empty.Title>Карт алга</Empty.Title>
                <Empty.Description>«Карт нэмэх» хэсгээс эхэлнэ үү.</Empty.Description>
              </Empty.Header>
            </Empty>
          ) : (
            <ul className="dandar:divide-y dandar:divide-border">
              {list.map((card) => (
                <li
                  key={card._id}
                  className="dandar:flex dandar:items-start dandar:justify-between dandar:gap-3 dandar:py-3"
                >
                  <div className="dandar:flex dandar:flex-col dandar:gap-1">
                    <span className="dandar:font-medium">{card.front}</span>
                    <span className="dandar:text-sm dandar:text-muted-foreground">{card.back}</span>
                    <span className="dandar:text-xs dandar:text-muted-foreground">
                      {card.deck} · санах {card.retention}% · дараагийн{" "}
                      {new Date(card.dueAt).toLocaleString("mn-MN")}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Картыг устгах"
                    onClick={() => {
                      if (window.confirm("Энэ картыг устгах уу?"))
                        remove({ variables: { _id: card._id } });
                    }}
                  >
                    <IconTrash />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="dandar:flex dandar:gap-2">
            <Button
              variant="outline"
              disabled={cards.loading || offset === 0}
              onClick={() => setOffset(offset - PAGE_SIZE)}
            >
              Өмнөх
            </Button>
            <Button
              variant="outline"
              disabled={
                cards.loading || !!cards.error || list.length < PAGE_SIZE || offset >= 10_000
              }
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Дараах
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};
