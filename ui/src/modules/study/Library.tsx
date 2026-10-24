import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { IconCheck, IconPencil, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import { Badge, Button, Card, Empty, Input, Skeleton, Textarea, toast } from "erxes-ui";
import {
  CARD_DELETE_MUTATION,
  CARD_UPDATE_MUTATION,
  DECK_DELETE_MUTATION,
  DECK_MASTERY_QUERY,
  DECK_RENAME_MUTATION,
  STUDY_CARDS_QUERY,
  STUDY_REFETCH,
} from "./graphql";

const PAGE_SIZE = 20;
// Mirror CARD_TEXT_MAX_LENGTH and DECK_MAX_LENGTH in api/src/modules/study/cardGen.ts.
const TEXT_MAX = 500;
const DECK_MAX = 60;

const fail = (title: string) => (error: Error) =>
  toast({ title, description: error.message, variant: "destructive" });

type EditableCard = {
  _id: string;
  deck: string;
  front: string;
  back: string;
  retention: number;
  dueAt: string;
};

const CardRow = ({ card, decks }: { card: EditableCard; decks: string[] }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ deck: card.deck, front: card.front, back: card.back });
  const [update, { loading: saving }] = useMutation(CARD_UPDATE_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    onCompleted: () => {
      setEditing(false);
      toast({ title: "Карт засагдлаа", variant: "success" });
    },
    onError: fail("Засаж чадсангүй"),
  });
  const [remove] = useMutation(CARD_DELETE_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    onError: fail("Устгаж чадсангүй"),
  });

  if (editing) {
    const valid = form.deck.trim() && form.front.trim() && form.back.trim();
    return (
      <li className="dandar:flex dandar:flex-col dandar:gap-2 dandar:py-3">
        <Input
          aria-label="Багц"
          list="dandar-library-decks"
          maxLength={DECK_MAX}
          value={form.deck}
          onChange={(event) => setForm({ ...form, deck: event.target.value })}
          className="dandar:w-60"
        />
        <datalist id="dandar-library-decks">
          {decks.map((deck) => (
            <option key={deck} value={deck} />
          ))}
        </datalist>
        <div className="dandar:grid dandar:gap-2 dandar:sm:grid-cols-2">
          <Textarea
            aria-label="Асуулт"
            rows={2}
            maxLength={TEXT_MAX}
            value={form.front}
            onChange={(event) => setForm({ ...form, front: event.target.value })}
          />
          <Textarea
            aria-label="Хариулт"
            rows={2}
            maxLength={TEXT_MAX}
            value={form.back}
            onChange={(event) => setForm({ ...form, back: event.target.value })}
          />
        </div>
        <div className="dandar:flex dandar:gap-2">
          <Button
            size="sm"
            disabled={!valid || saving}
            onClick={() =>
              update({
                variables: {
                  _id: card._id,
                  deck: form.deck.trim(),
                  front: form.front.trim(),
                  back: form.back.trim(),
                },
              })
            }
          >
            <IconCheck />
            Хадгалах
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setForm({ deck: card.deck, front: card.front, back: card.back });
              setEditing(false);
            }}
          >
            <IconX />
            Болих
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="dandar:flex dandar:items-start dandar:justify-between dandar:gap-3 dandar:py-3">
      <div className="dandar:flex dandar:flex-col dandar:gap-1">
        <span className="dandar:font-medium">{card.front}</span>
        <span className="dandar:text-sm dandar:text-muted-foreground">{card.back}</span>
        <span className="dandar:text-xs dandar:text-muted-foreground">
          {card.deck} · санах {card.retention}% · дараагийн{" "}
          {new Date(card.dueAt).toLocaleString("mn-MN")}
        </span>
      </div>
      <div className="dandar:flex">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Картыг засах"
          onClick={() => setEditing(true)}
        >
          <IconPencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Картыг устгах"
          onClick={() => {
            if (window.confirm("Энэ картыг устгах уу?")) remove({ variables: { _id: card._id } });
          }}
        >
          <IconTrash />
        </Button>
      </div>
    </li>
  );
};

const DeckActions = ({
  deck,
  onRenamed,
}: {
  deck: string;
  onRenamed: (name: string | null) => void;
}) => {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(deck);
  const [rename, { loading }] = useMutation(DECK_RENAME_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    onCompleted: ({ dandarDeckRename }) => {
      toast({ title: `${dandarDeckRename} карт шилжлээ`, variant: "success" });
      setRenaming(false);
      onRenamed(name.trim());
    },
    onError: fail("Нэр сольж чадсангүй"),
  });
  const [removeDeck] = useMutation(DECK_DELETE_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    onCompleted: ({ dandarDeckDelete }) => {
      toast({ title: `${dandarDeckDelete} карт устлаа`, variant: "success" });
      onRenamed(null);
    },
    onError: fail("Устгаж чадсангүй"),
  });

  return renaming ? (
    <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:gap-2">
      <Input
        aria-label="Багцын шинэ нэр"
        maxLength={DECK_MAX}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="dandar:w-60"
      />
      <Button
        size="sm"
        disabled={!name.trim() || name.trim() === deck || loading}
        onClick={() => rename({ variables: { from: deck, to: name.trim() } })}
      >
        Хадгалах
      </Button>
      <Button size="sm" variant="outline" onClick={() => setRenaming(false)}>
        Болих
      </Button>
    </div>
  ) : (
    <div className="dandar:flex dandar:gap-2">
      <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
        <IconPencil />
        Нэр солих
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (
            window.confirm(`«${deck}» багцын бүх карт болон шалгалтыг устгах уу? Буцаах боломжгүй.`)
          ) {
            removeDeck({ variables: { deck } });
          }
        }}
      >
        <IconTrash />
        Багц устгах
      </Button>
    </div>
  );
};

export const Library = () => {
  const [deck, setDeck] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const decks = useQuery(DECK_MASTERY_QUERY);
  const cards = useQuery(STUDY_CARDS_QUERY, {
    variables: { deck, search: search || null, limit: PAGE_SIZE, offset },
  });

  // Search after the student stops typing, from the first page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const deckList = decks.data?.dandarDeckMastery ?? [];
  const list = cards.data?.dandarStudyCards ?? [];
  const select = (name: string | null) => {
    setDeck(name);
    setOffset(0);
  };

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
          ) : deckList.length === 0 ? (
            <p className="dandar:text-sm dandar:text-muted-foreground">Карт алга.</p>
          ) : (
            deckList.map((item) => (
              <button
                key={item.deck}
                type="button"
                onClick={() => select(deck === item.deck ? null : item.deck)}
                aria-pressed={deck === item.deck}
                className="dandar:flex dandar:flex-col dandar:gap-1 dandar:rounded-lg dandar:p-2 dandar:text-left dandar:hover:bg-muted dandar:aria-pressed:bg-muted"
              >
                <span className="dandar:flex dandar:w-full dandar:items-center dandar:justify-between dandar:text-sm">
                  <span className="dandar:flex dandar:items-center dandar:gap-2">
                    {item.deck}
                    {item.weak ? <Badge variant="warning">Сул сэдэв</Badge> : null}
                  </span>
                  <span className="dandar:text-muted-foreground">
                    {item.mastery}% · {item.cards} карт
                  </span>
                </span>
                <span className="dandar:h-2 dandar:w-full dandar:overflow-hidden dandar:rounded-full dandar:bg-muted">
                  <span
                    className="dandar:block dandar:h-full dandar:rounded-full dandar:bg-primary"
                    style={{ width: `${item.mastery}%` }}
                  />
                </span>
              </button>
            ))
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="dandar:flex dandar:flex-col dandar:gap-3">
          <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:justify-between dandar:gap-2">
            <Card.Title>{deck ? `«${deck}» багц` : "Бүх карт"}</Card.Title>
            {deck ? (
              <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:gap-2">
                <DeckActions key={deck} deck={deck} onRenamed={select} />
                <Button size="sm" variant="ghost" onClick={() => select(null)}>
                  Бүгдийг харах
                </Button>
              </div>
            ) : null}
          </div>
          <div className="dandar:relative">
            <IconSearch className="dandar:pointer-events-none dandar:absolute dandar:left-3 dandar:top-1/2 dandar:size-4 dandar:-translate-y-1/2 dandar:text-muted-foreground" />
            <Input
              aria-label="Карт хайх"
              placeholder="Асуулт эсвэл хариултаар хайх…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="dandar:pl-9"
            />
          </div>
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
                <Empty.Title>{search ? "Олдсонгүй" : "Карт алга"}</Empty.Title>
                <Empty.Description>
                  {search ? "Өөр үгээр хайж үзнэ үү." : "«Карт нэмэх» хэсгээс эхэлнэ үү."}
                </Empty.Description>
              </Empty.Header>
            </Empty>
          ) : (
            <ul className="dandar:divide-y dandar:divide-border">
              {list.map((card) => (
                <CardRow key={card._id} card={card} decks={deckList.map((item) => item.deck)} />
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
