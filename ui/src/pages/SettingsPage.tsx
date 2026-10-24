import { useQuery } from "@apollo/client";
import type { ReactNode } from "react";
import { IconArrowLeft, IconPlugConnected, IconSettings } from "@tabler/icons-react";
import { Badge, Breadcrumb, Button, Card, Separator, Skeleton } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { AI_STATUS_QUERY, PureChat } from "../modules/ai/PureChat";
import { VOICE_STATUS_QUERY } from "../modules/voice/graphql";

const { path } = manifest.ui;

const IDENTITY: [string, string][] = [
  ["Нэр", manifest.name],
  ["Зам", `/${path}`],
  ["UI remote", manifest.ui.remote],
  ["API", `:${manifest.api.port}${manifest.api.graphql}`],
  ["Хувилбар", manifest.version],
];

const Row = ({ title, hint, children }: { title: string; hint: string; children: ReactNode }) => (
  <div className="dandar:flex dandar:items-center dandar:justify-between dandar:gap-4">
    <div className="dandar:flex dandar:flex-col">
      <span className="dandar:text-sm dandar:font-medium">{title}</span>
      <span className="dandar:text-xs dandar:text-muted-foreground">{hint}</span>
    </div>
    {children}
  </div>
);

// What the demo depends on: Gemma 4 for every AI feature, text-to-speech for
// spoken reminders and speech recognition for dictation. Keys live in .env.
const Connections = () => {
  const ai = useQuery(AI_STATUS_QUERY);
  const voice = useQuery(VOICE_STATUS_QUERY);

  if (ai.loading || voice.loading) {
    return <Skeleton className="dandar:h-32 dandar:w-full" />;
  }
  if (ai.error || voice.error) {
    return (
      <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
        <p>{(ai.error ?? voice.error)?.message}</p>
        <Button
          variant="outline"
          className="dandar:w-fit"
          onClick={() => {
            void ai.refetch();
            void voice.refetch();
          }}
        >
          Дахин оролдох
        </Button>
      </div>
    );
  }

  const gemma = ai.data?.dandarAiStatus;
  const speech = voice.data?.dandarVoiceStatus;

  return (
    <div className="dandar:flex dandar:flex-col dandar:gap-4">
      <Row title="Gemma 4" hint="Зураг унших, карт үүсгэх, төлөвлөх, AI туслах">
        {gemma?.configured ? (
          <Badge variant="success">
            {gemma.provider} · {gemma.model}
          </Badge>
        ) : (
          <Badge variant="warning">Тохируулаагүй</Badge>
        )}
      </Row>
      <Row title="Дуу унших" hint="Сануулгыг монголоор чангаар уншина">
        {speech?.configured ? (
          <Badge variant="success">{speech.provider === "chimege" ? "Chimege" : "OmniVoice"}</Badge>
        ) : (
          <Badge variant="warning">Тохируулаагүй</Badge>
        )}
      </Row>
      <Row title="Яриа таних" hint="Даалгаврыг дуугаар бичих, дуугаар төлөвлөх">
        <Badge variant={speech?.sttConfigured ? "success" : "info"}>
          {speech?.sttConfigured ? "Chimege" : "Хөтчийн (Chrome, Edge)"}
        </Badge>
      </Row>
      {gemma && !gemma.configured ? (
        <p className="dandar:text-xs dandar:text-muted-foreground">
          Plugin-ий .env файлд{" "}
          {gemma.provider === "gemini" ? "GEMINI_API_KEY" : "AI_BASE_URL"}-г тохируулаад API-г
          дахин эхлүүлнэ үү.
        </p>
      ) : null}
    </div>
  );
};

export const SettingsPage = () => (
  <div className="dandar:flex dandar:h-full dandar:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="dandar:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}/settings`}>
                  <IconSettings />
                  Тохиргоо
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton
          breadcrumb={[manifest.title, "Тохиргоо"]}
          icon="IconSettings"
        />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}`}>
            <IconArrowLeft />
            Төлөвлөгөө рүү буцах
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="dandar:flex-1 dandar:overflow-auto">
      <div className="dandar:mx-auto dandar:flex dandar:w-full dandar:max-w-3xl dandar:flex-col dandar:gap-6 dandar:p-6">
        <Card>
          <Card.Header>
            <Card.Title className="dandar:flex dandar:items-center dandar:gap-2">
              <IconPlugConnected className="dandar:size-5" />
              Холболтууд
            </Card.Title>
            <Card.Description>
              AI болон дуу хоолойн үйлчилгээ ажиллаж байгаа эсэх.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Connections />
          </Card.Content>
        </Card>
        {/* Works once GEMINI_API_KEY (or AI_BASE_URL) is set in .env. */}
        <PureChat />
        <Card>
          <Card.Header>
            <Card.Title>Ерөнхий мэдээлэл</Card.Title>
            <Card.Description>
              Plugin-ий нэр, зам, порт erxes.json файлаас уншигдана. Өөрчилбөл дахин эхлүүлнэ.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="dandar:grid dandar:grid-cols-[8rem_1fr] dandar:gap-y-2 dandar:text-sm">
              {IDENTITY.map(([label, value]) => (
                <div key={label} className="dandar:contents">
                  <dt className="dandar:text-muted-foreground">{label}</dt>
                  <dd>
                    <code className="dandar:rounded dandar:bg-muted dandar:px-1.5 dandar:py-0.5 dandar:font-mono dandar:text-xs">
                      {value}
                    </code>
                  </dd>
                </div>
              ))}
            </dl>
          </Card.Content>
        </Card>
      </div>
    </div>
  </div>
);
