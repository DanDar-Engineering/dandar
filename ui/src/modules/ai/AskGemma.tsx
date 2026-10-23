import { useMutation, useQuery } from "@apollo/client";
import { type FormEvent, useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
// Root import on purpose: core-ui shares `erxes-ui` as a Module Federation
// singleton keyed on the bare specifier.
import { Badge, Button, Card, Textarea } from "erxes-ui";
import { gql } from "~/gql";

const AI_STATUS_QUERY = gql(`
  query dandarAiStatus {
    dandarAiStatus {
      provider
      model
      configured
    }
  }
`);

const ASK_MUTATION = gql(`
  mutation dandarAsk($prompt: String!) {
    dandarAsk(prompt: $prompt) {
      text
      model
      provider
    }
  }
`);

// Mirrors MAX_PROMPT_LENGTH in api/src/modules/ai/gemma.ts.
const MAX_PROMPT_LENGTH = 4000;

export const AskGemma = () => {
  const [prompt, setPrompt] = useState("");
  const { data: statusData, loading: statusLoading } = useQuery(AI_STATUS_QUERY);
  // onError keeps the rejected promise from going unhandled; the error is
  // rendered from the hook state below.
  const [ask, { data, loading, error }] = useMutation(ASK_MUTATION, { onError: () => undefined });

  const status = statusData?.dandarAiStatus;
  const question = prompt.trim();
  const answer = data?.dandarAsk;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (question) {
      ask({ variables: { prompt: question } });
    }
  };

  return (
    <Card>
      <Card.Header>
        <div className="dandar:flex dandar:items-center dandar:justify-between dandar:gap-2">
          <Card.Title className="dandar:flex dandar:items-center dandar:gap-2">
            <IconSparkles className="dandar:size-5" />
            Ask Gemma 4
          </Card.Title>
          {statusLoading ? null : status?.configured ? (
            <Badge variant="success">
              {status.provider} · {status.model}
            </Badge>
          ) : (
            <Badge variant="warning">Not configured</Badge>
          )}
        </div>
        <Card.Description>
          {status && !status.configured
            ? status.provider === "gemini"
              ? "Set GEMINI_API_KEY in the plugin .env and restart the API."
              : "Set AI_BASE_URL in the plugin .env and restart the API."
            : "Ask a study question; DanDar answers as a tutor."}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <form className="dandar:flex dandar:flex-col dandar:gap-3" onSubmit={onSubmit}>
          <Textarea
            aria-label="Question for Gemma"
            placeholder="Жишээ нь: Пифагорын теоремыг энгийнээр тайлбарлаад, нэг жишээ бод."
            value={prompt}
            maxLength={MAX_PROMPT_LENGTH}
            rows={4}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="dandar:flex dandar:items-center dandar:justify-between dandar:gap-2">
            <span className="dandar:text-xs dandar:text-muted-foreground">
              {prompt.length}/{MAX_PROMPT_LENGTH}
            </span>
            <Button type="submit" disabled={loading || !question}>
              <IconSparkles />
              {loading ? "Thinking…" : "Ask"}
            </Button>
          </div>
        </form>
        {loading ? (
          <p role="status" className="dandar:mt-4 dandar:text-sm dandar:text-muted-foreground">
            Gemma is writing an answer…
          </p>
        ) : error ? (
          <p role="alert" className="dandar:mt-4 dandar:text-sm dandar:text-destructive">
            {error.message}
          </p>
        ) : answer ? (
          <div className="dandar:mt-4 dandar:rounded-lg dandar:border dandar:border-border dandar:bg-muted dandar:p-4">
            <p className="dandar:whitespace-pre-wrap dandar:text-sm dandar:leading-relaxed">
              {answer.text}
            </p>
            <p className="dandar:mt-2 dandar:text-xs dandar:text-muted-foreground">
              {answer.provider} · {answer.model}
            </p>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
};
