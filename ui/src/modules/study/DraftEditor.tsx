import { useMutation } from "@apollo/client";
import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import { Button, Card, Checkbox, Input, Label, Textarea, toast } from "erxes-ui";
import { CARDS_SAVE_MUTATION, STUDY_REFETCH } from "./graphql";

// Mirror CARD_TEXT_MAX_LENGTH and DECK_MAX_LENGTH in api/src/modules/study/cardGen.ts.
const TEXT_MAX = 500;
const DECK_MAX = 60;

export type DraftCard = { front: string; back: string; keep: boolean };

export type Draft = {
  deck: string;
  examDate: string;
  cards: DraftCard[];
  scanIds: string[];
};

// Gemma's cards can be wrong, so the student checks, edits and drops cards
// here; only dandarCardsSave stores them.
export const DraftEditor = ({
  initial,
  decks,
  onDone,
}: {
  initial: Draft;
  decks: string[];
  onDone: () => void;
}) => {
  const [draft, setDraft] = useState(initial);
  const kept = draft.cards.filter((card) => card.keep && card.front.trim() && card.back.trim());

  const [save, { loading }] = useMutation(CARDS_SAVE_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    awaitRefetchQueries: true,
    onCompleted: ({ dandarCardsSave }) => {
      toast({ title: `${dandarCardsSave.length} карт нэмлээ`, variant: "success" });
      onDone();
    },
    onError: (error) =>
      toast({ title: "Хадгалж чадсангүй", description: error.message, variant: "destructive" }),
  });

  const update = (index: number, patch: Partial<DraftCard>) =>
    setDraft((current) => ({
      ...current,
      cards: current.cards.map((card, i) => (i === index ? { ...card, ...patch } : card)),
    }));

  const canSave = !!draft.deck.trim() && kept.length > 0 && !loading;

  return (
    <Card>
      <Card.Header>
        <Card.Title>Үүссэн картуудыг шалгана уу</Card.Title>
        <Card.Description>
          Gemma алдаж магадгүй. Засаж, хэрэггүйг нь хасаад баталгаажуулна.
        </Card.Description>
      </Card.Header>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
        <div className="dandar:grid dandar:gap-3 dandar:sm:grid-cols-2">
          <div className="dandar:flex dandar:flex-col dandar:gap-2">
            <Label htmlFor="dandar-draft-deck">Багц</Label>
            <Input
              id="dandar-draft-deck"
              list="dandar-decks"
              value={draft.deck}
              maxLength={DECK_MAX}
              onChange={(event) => setDraft({ ...draft, deck: event.target.value })}
            />
            <datalist id="dandar-decks">
              {decks.map((deck) => (
                <option key={deck} value={deck} />
              ))}
            </datalist>
          </div>
          <div className="dandar:flex dandar:flex-col dandar:gap-2">
            <Label htmlFor="dandar-draft-exam">Шалгалтын огноо (заавал биш)</Label>
            <Input
              id="dandar-draft-exam"
              type="date"
              value={draft.examDate}
              onChange={(event) => setDraft({ ...draft, examDate: event.target.value })}
            />
          </div>
        </div>
        <ul className="dandar:flex dandar:flex-col dandar:gap-3">
          {draft.cards.map((card, index) => (
            <li key={index} className="dandar:flex dandar:items-start dandar:gap-2">
              <Checkbox
                aria-label="Хадгалах"
                checked={card.keep}
                onCheckedChange={(checked) => update(index, { keep: checked === true })}
                className="dandar:mt-3"
              />
              <div className="dandar:grid dandar:flex-1 dandar:gap-2 dandar:sm:grid-cols-2">
                <Textarea
                  aria-label="Асуулт"
                  rows={2}
                  maxLength={TEXT_MAX}
                  value={card.front}
                  onChange={(event) => update(index, { front: event.target.value })}
                />
                <Textarea
                  aria-label="Хариулт"
                  rows={2}
                  maxLength={TEXT_MAX}
                  value={card.back}
                  onChange={(event) => update(index, { back: event.target.value })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Картыг хасах"
                onClick={() =>
                  setDraft({ ...draft, cards: draft.cards.filter((_, i) => i !== index) })
                }
              >
                <IconTrash />
              </Button>
            </li>
          ))}
        </ul>
        <div className="dandar:flex dandar:flex-wrap dandar:gap-2">
          <Button
            disabled={!canSave}
            onClick={() =>
              save({
                variables: {
                  deck: draft.deck.trim(),
                  cards: kept.map(({ front, back }) => ({
                    front: front.trim(),
                    back: back.trim(),
                  })),
                  examDate: draft.examDate || null,
                  scanIds: draft.scanIds.length ? draft.scanIds : null,
                },
              })
            }
          >
            {loading ? "Хадгалж байна…" : `Хадгалах (${kept.length} карт)`}
          </Button>
          <Button variant="outline" onClick={onDone}>
            Болих
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};
