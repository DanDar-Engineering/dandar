import { useApolloClient, useMutation } from "@apollo/client";
import { useState } from "react";
import { IconCards } from "@tabler/icons-react";
import { Button, toast } from "erxes-ui";
import { CARDS_SAVE_MUTATION, STUDY_REFETCH } from "./graphql";
import { SAMPLE_CARD_COUNT, SAMPLE_DECKS } from "./sampleCards";

export const SampleCardsButton = ({ variant = "default" }: { variant?: "default" | "outline" }) => {
  const [saving, setSaving] = useState(false);
  const client = useApolloClient();
  const [save] = useMutation(CARDS_SAVE_MUTATION);

  const addAll = async () => {
    setSaving(true);
    try {
      for (const { deck, cards } of SAMPLE_DECKS) {
        await save({ variables: { deck, cards } });
      }
      // Refetch once after every deck is in, not after each save.
      await client.refetchQueries({ include: STUDY_REFETCH });
      toast({ title: `${SAMPLE_CARD_COUNT} жишээ карт нэмлээ`, variant: "success" });
    } catch (error) {
      toast({
        title: "Жишээ картыг нэмж чадсангүй",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button variant={variant} disabled={saving} onClick={() => void addAll()}>
      <IconCards />
      {saving ? "Нэмж байна…" : `Жишээ ${SAMPLE_CARD_COUNT} карт нэмэх`}
    </Button>
  );
};
