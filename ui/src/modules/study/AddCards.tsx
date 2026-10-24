import { useMutation, useQuery } from "@apollo/client";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { IconPhoto, IconSparkles } from "@tabler/icons-react";
import { Button, Card, Input, Label, Tabs, Textarea, toast } from "erxes-ui";
import type { DandarCardKind, DandarCardLang, DandarCardLevel } from "~/gql/graphql";
import { ACCEPTED_IMAGE_TYPES, type PreparedImage, prepareImage } from "../scan/image";
import { type Draft, DraftEditor } from "./DraftEditor";
import { ScanPicker } from "./ScanPicker";
import {
  CARDS_DRAFT_MUTATION,
  CARD_ADD_MUTATION,
  DECK_MASTERY_QUERY,
  STUDY_REFETCH,
} from "./graphql";

// Mirror the limits in api/src/modules/study/cardGen.ts.
const LIMITS = { notes: 6000, text: 500, deck: 60, focus: 200, instructions: 400 };

type Options = {
  count: number;
  level: DandarCardLevel;
  kind: DandarCardKind;
  lang: DandarCardLang;
  focus: string;
  instructions: string;
};

const DEFAULT_OPTIONS: Options = {
  count: 8,
  level: "medium",
  kind: "qa",
  lang: "auto",
  focus: "",
  instructions: "",
};

const Choice = <T extends string | number>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: [T, string][];
  onChange: (value: T) => void;
}) => (
  <div className="dandar:flex dandar:flex-col dandar:gap-2">
    <Label>{label}</Label>
    <div role="group" aria-label={label} className="dandar:flex dandar:flex-wrap dandar:gap-2">
      {items.map(([item, text]) => (
        <Button
          key={String(item)}
          type="button"
          size="sm"
          variant={value === item ? "default" : "outline"}
          aria-pressed={value === item}
          onClick={() => onChange(item)}
        >
          {text}
        </Button>
      ))}
    </div>
  </div>
);

const OptionsForm = ({
  options,
  onChange,
}: {
  options: Options;
  onChange: (next: Options) => void;
}) => (
  <div className="dandar:flex dandar:flex-col dandar:gap-4 dandar:rounded-lg dandar:border dandar:border-border dandar:p-4">
    <span className="dandar:text-sm dandar:font-medium">Үүсгэлтийн тохиргоо</span>
    <Choice
      label="Картын тоо"
      value={options.count}
      items={[
        [5, "5"],
        [8, "8"],
        [12, "12"],
        [15, "15"],
      ]}
      onChange={(count) => onChange({ ...options, count })}
    />
    <Choice<DandarCardLevel>
      label="Түвшин"
      value={options.level}
      items={[
        ["easy", "Хялбар"],
        ["medium", "Дунд"],
        ["hard", "Хүнд · шалгалтын"],
      ]}
      onChange={(level) => onChange({ ...options, level })}
    />
    <Choice<DandarCardKind>
      label="Төрөл"
      value={options.kind}
      items={[
        ["qa", "Асуулт-хариулт"],
        ["cloze", "Нөхөх"],
        ["term", "Нэр томьёо"],
      ]}
      onChange={(kind) => onChange({ ...options, kind })}
    />
    <Choice<DandarCardLang>
      label="Хэл"
      value={options.lang}
      items={[
        ["auto", "Материалын"],
        ["mn", "Монгол"],
        ["en", "English"],
      ]}
      onChange={(lang) => onChange({ ...options, lang })}
    />
    <div className="dandar:grid dandar:gap-3 dandar:sm:grid-cols-2">
      <div className="dandar:flex dandar:flex-col dandar:gap-2">
        <Label htmlFor="dandar-opt-focus">Онцгой анхаарах сэдэв</Label>
        <Input
          id="dandar-opt-focus"
          maxLength={LIMITS.focus}
          placeholder="Жишээ: томьёо, он цаг"
          value={options.focus}
          onChange={(event) => onChange({ ...options, focus: event.target.value })}
        />
      </div>
      <div className="dandar:flex dandar:flex-col dandar:gap-2">
        <Label htmlFor="dandar-opt-instr">Нэмэлт хүсэлт</Label>
        <Input
          id="dandar-opt-instr"
          maxLength={LIMITS.instructions}
          placeholder="Жишээ: богино хариулттай"
          value={options.instructions}
          onChange={(event) => onChange({ ...options, instructions: event.target.value })}
        />
      </div>
    </div>
  </div>
);

const ManualForm = ({ decks }: { decks: string[] }) => {
  const [deck, setDeck] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [add, { loading }] = useMutation(CARD_ADD_MUTATION, {
    refetchQueries: STUDY_REFETCH,
    awaitRefetchQueries: true,
    onCompleted: () => {
      setFront("");
      setBack("");
      toast({ title: "Карт нэмлээ", variant: "success" });
    },
    onError: (error) =>
      toast({ title: "Нэмж чадсангүй", description: error.message, variant: "destructive" }),
  });
  const canAdd = !!deck.trim() && !!front.trim() && !!back.trim() && !loading;

  return (
    <Card>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-3 dandar:pt-6">
        <Label htmlFor="dandar-manual-deck">Багц</Label>
        <Input
          id="dandar-manual-deck"
          list="dandar-decks"
          maxLength={LIMITS.deck}
          placeholder="Жишээ: Математик"
          value={deck}
          onChange={(event) => setDeck(event.target.value)}
        />
        <datalist id="dandar-decks">
          {decks.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <Label htmlFor="dandar-manual-front">Асуулт</Label>
        <Textarea
          id="dandar-manual-front"
          rows={2}
          maxLength={LIMITS.text}
          value={front}
          onChange={(event) => setFront(event.target.value)}
        />
        <Label htmlFor="dandar-manual-back">Хариулт</Label>
        <Textarea
          id="dandar-manual-back"
          rows={2}
          maxLength={LIMITS.text}
          value={back}
          onChange={(event) => setBack(event.target.value)}
        />
        <Button
          className="dandar:w-fit"
          disabled={!canAdd}
          onClick={() =>
            add({ variables: { deck: deck.trim(), front: front.trim(), back: back.trim() } })
          }
        >
          Нэмэх
        </Button>
      </Card.Content>
    </Card>
  );
};

type DraftRequest = {
  notes?: string;
  scanIds?: string[];
  useScanImages?: boolean;
  image?: PreparedImage;
};

export const AddCards = ({ initialScanId }: { initialScanId?: string }) => {
  const [source, setSource] = useState(initialScanId ? "scans" : "manual");
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);

  const decks = useQuery(DECK_MASTERY_QUERY).data?.dandarDeckMastery.map((item) => item.deck) ?? [];

  const [makeDraft, { loading: drafting, error: draftError }] = useMutation(CARDS_DRAFT_MUTATION, {
    onError: () => undefined, // rendered from the hook state below
  });

  const run = async (request: DraftRequest) => {
    const result = await makeDraft({
      variables: {
        notes: request.notes || null,
        scanIds: request.scanIds?.length ? request.scanIds : null,
        useScanImages: request.useScanImages ?? false,
        mimeType: request.image?.mimeType ?? null,
        imageData: request.image?.data ?? null,
        options: {
          count: options.count,
          level: options.level,
          kind: options.kind,
          lang: options.lang,
          focus: options.focus || null,
          instructions: options.instructions || null,
        },
      },
    });
    const data = result.data?.dandarCardsDraft;
    if (data) {
      setDraft({
        deck: data.deck,
        examDate: data.examDate ?? "",
        cards: data.cards.map((card) => ({ ...card, keep: true })),
        scanIds: request.scanIds ?? [],
        examMode: data.examMode,
      });
    }
  };

  // Arriving from a scan ("Карт үүсгэх" in Миний материал) starts the draft once.
  const started = useRef(false);
  useEffect(() => {
    if (initialScanId && !started.current) {
      started.current = true;
      void run({ scanIds: [initialScanId] });
    }
    // run closes over the options on first render only on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScanId]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageError("");
    if (!file) return;
    try {
      setImage(await prepareImage(file));
    } catch (error) {
      setImage(null);
      setImageError(error instanceof Error ? error.message : String(error));
    }
  };

  const finish = () => {
    setDraft(null);
    setNotes("");
    setImage(null);
    setInputKey((key) => key + 1);
  };

  if (draft) {
    return <DraftEditor initial={draft} decks={decks} onDone={finish} />;
  }

  const error = draftError ? (
    <p role="alert" className="dandar:text-sm dandar:text-destructive">
      {draftError.message}
    </p>
  ) : null;

  return (
    <Tabs
      value={source}
      onValueChange={setSource}
      className="dandar:flex dandar:flex-col dandar:gap-4"
    >
      <Tabs.List className="dandar:w-fit">
        <Tabs.Trigger value="manual">Гараар</Tabs.Trigger>
        <Tabs.Trigger value="gemma" className="dandar:gap-2">
          <IconSparkles className="dandar:size-4" />
          Gemma 4
        </Tabs.Trigger>
        <Tabs.Trigger value="scans" className="dandar:gap-2">
          <IconPhoto className="dandar:size-4" />
          Уншуулсан материал
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="manual">
        <ManualForm decks={decks} />
      </Tabs.Content>

      <Tabs.Content value="gemma" className="dandar:flex dandar:flex-col dandar:gap-4">
        <Card>
          <Card.Content className="dandar:flex dandar:flex-col dandar:gap-3 dandar:pt-6">
            <Label htmlFor="dandar-gen-notes">Хичээлийн тэмдэглэл</Label>
            <Textarea
              id="dandar-gen-notes"
              rows={6}
              maxLength={LIMITS.notes}
              placeholder="Тэмдэглэлээ энд буулгана…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <Label htmlFor="dandar-gen-photo">Эсвэл зураг (JPEG, PNG, WebP)</Label>
            <Input
              key={inputKey}
              id="dandar-gen-photo"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              onChange={onFile}
            />
            {image ? (
              <img
                src={image.previewUrl}
                alt="Сонгосон зураг"
                className="dandar:max-h-48 dandar:w-fit dandar:rounded-lg dandar:border dandar:border-border"
              />
            ) : null}
            {imageError ? (
              <p role="alert" className="dandar:text-sm dandar:text-destructive">
                {imageError}
              </p>
            ) : null}
          </Card.Content>
        </Card>
        <OptionsForm options={options} onChange={setOptions} />
        {error}
        <Button
          className="dandar:w-fit"
          disabled={drafting || (!notes.trim() && !image)}
          onClick={() => run({ notes: notes.trim(), image: image ?? undefined })}
        >
          <IconSparkles />
          {drafting ? "Gemma бодож байна…" : "Карт үүсгэх"}
        </Button>
      </Tabs.Content>

      <Tabs.Content value="scans" className="dandar:flex dandar:flex-col dandar:gap-4">
        <OptionsForm options={options} onChange={setOptions} />
        {error}
        <ScanPicker
          drafting={drafting}
          onGenerate={(scanIds, useScanImages) => run({ scanIds, useScanImages })}
        />
      </Tabs.Content>
    </Tabs>
  );
};
