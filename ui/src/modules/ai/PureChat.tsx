import { useMutation, useQuery } from "@apollo/client";
import { type FormEvent, useRef, useEffect, useState } from "react";
import { IconSend } from "@tabler/icons-react";
import { Button, Card } from "erxes-ui";
import { gql } from "~/gql";
import { PureLogoIcon } from "../../components/PureLogo";

export const AI_STATUS_QUERY = gql(`
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

interface ChatMessage {
  type: "user" | "ai";
  text: string;
  model?: string;
  provider?: string;
}

export const PureChat = () => {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: statusData } = useQuery(AI_STATUS_QUERY);
  const [ask, { loading, error }] = useMutation(ASK_MUTATION, {
    onError: () => undefined,
    onCompleted: (data) => {
      if (data?.dandarAsk) {
        setMessages((prev) => [
          ...prev,
          {
            type: "ai",
            text: data.dandarAsk.text,
            model: data.dandarAsk.model,
            provider: data.dandarAsk.provider,
          },
        ]);
      }
    },
  });

  const status = statusData?.dandarAiStatus;
  const question = prompt.trim();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (question) {
      setMessages((prev) => [...prev, { type: "user", text: question }]);
      ask({ variables: { prompt: question } });
      setPrompt("");
    }
  };

  const isConfigured = status && status.configured;

  return (
    <div className="pure-chat-container">
      <Card>
        <Card.Header>
          <div className="dandar:flex dandar:items-center dandar:justify-between dandar:gap-2">
            <Card.Title className="dandar:flex dandar:items-center dandar:gap-2">
              <PureLogoIcon size="md" />
              <span>Pure AI туслах</span>
            </Card.Title>
            {isConfigured && (
              <span className="pure-badge pure-badge-primary">
                {status.provider} · {status.model}
              </span>
            )}
          </div>
          <Card.Description>
            {!isConfigured
              ? status?.provider === "gemini"
                ? "Plugin-ий .env файлд GEMINI_API_KEY-г тохируулаад API-г дахин эхлүүлнэ үү."
                : "Plugin-ий .env файлд AI_BASE_URL-г тохируулаад API-г дахин эхлүүлнэ үү."
              : "Хичээлийн асуултаа бичээрэй. Pure алхам алхмаар тайлбарлаж өгнө."}
          </Card.Description>
        </Card.Header>

        <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
          {/* Chat Messages Display */}
          <div className="dandar:h-96 dandar:overflow-y-auto dandar:space-y-4 dandar:rounded-lg dandar:bg-muted dandar:p-4">
            {messages.length === 0 ? (
              <div className="dandar:flex dandar:h-full dandar:items-center dandar:justify-center dandar:text-center">
                <div className="dandar:text-muted-foreground">
                  <PureLogoIcon size="lg" />
                  <p className="dandar:mt-4 dandar:text-sm">Өнөөдрийн эхний асуултаа асуугаарай</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`pure-chat-message ${msg.type === "ai" ? "pure-ai-message" : "pure-user-message"}`}>
                    {msg.type === "ai" && (
                      <div className="dandar:flex-shrink-0">
                        <PureLogoIcon size="sm" />
                      </div>
                    )}
                    <div className="pure-chat-bubble">
                      {msg.text}
                      {msg.type === "ai" && msg.provider && (
                        <p className="dandar:mt-2 dandar:text-xs dandar:opacity-75">
                          {msg.provider} · {msg.model}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="pure-chat-message pure-ai-message">
                    <div className="dandar:flex-shrink-0">
                      <PureLogoIcon size="sm" />
                    </div>
                    <div className="pure-chat-bubble">
                      <div className="dandar:flex dandar:gap-2 dandar:items-center">
                        <span className="pure-loading-dot dandar:h-2.5 dandar:w-2.5 dandar:rounded-full dandar:bg-pure-primary" />
                        <span className="pure-loading-dot dandar:h-2.5 dandar:w-2.5 dandar:rounded-full dandar:bg-pure-primary" />
                        <span className="pure-loading-dot dandar:h-2.5 dandar:w-2.5 dandar:rounded-full dandar:bg-pure-primary" />
                      </div>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="dandar:rounded dandar:bg-destructive/10 dandar:p-3 dandar:text-sm dandar:text-destructive">
                    {error.message}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Form */}
          {isConfigured ? (
            <form onSubmit={onSubmit} className="dandar:flex dandar:flex-col dandar:gap-3">
              <div className="dandar:flex dandar:gap-2">
                <input
                  type="text"
                  aria-label="Pure-д асуух асуулт"
                  placeholder="Жишээ нь: Пифагорын теоремыг энгийнээр тайлбарлаад..."
                  value={prompt}
                  maxLength={MAX_PROMPT_LENGTH}
                  onChange={(event) => setPrompt(event.target.value)}
                  disabled={loading}
                  className="pure-input dandar:flex-1"
                />
                <Button
                  type="submit"
                  disabled={loading || !question}
                  className="pure-btn pure-btn-primary"
                  aria-label="Илгээх"
                >
                  <IconSend size={18} />
                </Button>
              </div>
              <span className="dandar:text-xs dandar:text-muted-foreground">
                {prompt.length}/{MAX_PROMPT_LENGTH}
              </span>
            </form>
          ) : (
            <div className="dandar:rounded dandar:bg-warning/10 dandar:p-4 dandar:text-sm dandar:text-warning">
              Pure AI тохируулагдаагүй байна. API-ийн тохиргоог шалгана уу.
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};
