import { useQuery } from "@apollo/client";
import type { ComponentType, ReactNode } from "react";
import {
  IconBook,
  IconDatabase,
  IconExternalLink,
  IconLayoutDashboard,
  IconSandbox,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import { Badge, Breadcrumb, Button, Card, Separator, Skeleton, cn } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { STATUS_QUERY } from "../graphql";
import { Samples } from "../Samples";

const { path } = manifest.ui;

const Dot = ({ className }: { className?: string }) => (
  <span className={cn("dandar:inline-block dandar:size-2 dandar:rounded-full", className)} />
);

const StatusRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="dandar:flex dandar:items-center dandar:justify-between dandar:gap-4 dandar:text-sm">
    <span className="dandar:text-muted-foreground">{label}</span>
    <span className="dandar:flex dandar:items-center dandar:gap-2 dandar:font-medium">
      {children}
    </span>
  </div>
);

const ConnectionCard = () => {
  const { data, loading, error, refetch } = useQuery(STATUS_QUERY);
  const status = data?.dandarStatus;

  const pending = (
    <>
      <Dot className="dandar:animate-pulse dandar:bg-muted-foreground" />
      <Skeleton className="dandar:h-4 dandar:w-24" />
    </>
  );

  return (
    <Card className="dandar:w-full dandar:md:w-80 dandar:shrink-0">
      <Card.Header>
        <Card.Title className="dandar:text-sm">Connection</Card.Title>
        <Card.Description>Live status of this plugin inside erxes</Card.Description>
      </Card.Header>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-3">
        <StatusRow label="API">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="dandar:bg-destructive" />
              <span>Unreachable</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </>
          ) : (
            <>
              <Dot className="dandar:bg-success" />
              <span>Connected · v{status?.version}</span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Gateway">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="dandar:bg-destructive" />
              <span className="dandar:truncate dandar:max-w-40" title={error.message}>
                {error.message}
              </span>
            </>
          ) : (
            <>
              <Dot className="dandar:bg-success" />
              <span>Federated as {status?.plugin}</span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Tenant">{loading ? pending : (status?.subdomain ?? "—")}</StatusRow>
        <StatusRow label="Signed in">
          {loading
            ? pending
            : (status && (status.userEmail ?? status.userId ?? "Anonymous")) || "—"}
        </StatusRow>
      </Card.Content>
    </Card>
  );
};

const StepCard = ({
  icon: Icon,
  title,
  description,
  code,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  code: string;
}) => (
  <Card>
    <Card.Header>
      <div className="dandar:flex dandar:size-9 dandar:items-center dandar:justify-center dandar:rounded-lg dandar:bg-accent">
        <Icon className="dandar:size-5" />
      </div>
      <Card.Title>{title}</Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card.Header>
    <Card.Content>
      <code className="dandar:rounded dandar:bg-muted dandar:px-1.5 dandar:py-0.5 dandar:font-mono dandar:text-xs">
        {code}
      </code>
    </Card.Content>
  </Card>
);

const STEPS = [
  {
    icon: IconDatabase,
    title: "Model your data",
    description: "Define the records this plugin owns and expose them on the federated graph.",
    code: "api/src/modules/sample",
  },
  {
    icon: IconLayoutDashboard,
    title: "Build the page",
    description:
      "Replace this overview with your module: lists with RecordTable, forms with Form, details in a Sheet.",
    code: "ui/src/pages/IndexPage.tsx",
  },
  {
    icon: IconUsers,
    title: "Use erxes data",
    description:
      "Link records to erxes contacts with SelectCustomer and CustomersInline from ui-modules.",
    code: "ui/src/Samples.tsx",
  },
];

export const IndexPage = () => (
  <div className="dandar:flex dandar:h-full dandar:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="dandar:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}`}>
                  <IconSandbox />
                  {manifest.title}
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton breadcrumb={[manifest.title]} icon="IconSandbox" />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}/settings`}>
            <IconSettings />
            Settings
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="dandar:flex-1 dandar:overflow-auto">
      <div className="dandar:mx-auto dandar:flex dandar:w-full dandar:max-w-5xl dandar:flex-col dandar:gap-6 dandar:p-6">
        <section className="dandar:relative dandar:overflow-hidden dandar:rounded-xl dandar:border dandar:border-border dandar:bg-background dandar:p-8 dandar:shadow-xs">
          <div
            aria-hidden
            className="dandar:pointer-events-none dandar:absolute dandar:inset-0 dandar:bg-gradient-to-br dandar:from-primary/10 dandar:via-transparent dandar:to-transparent"
          />
          <div className="dandar:relative dandar:flex dandar:flex-col dandar:gap-6 dandar:md:flex-row dandar:md:items-start dandar:md:justify-between">
            <div className="dandar:flex dandar:max-w-xl dandar:flex-col dandar:gap-4">
              <div>
                <Badge variant="info">Plugin · v{manifest.version}</Badge>
              </div>
              <h1 className="dandar:text-2xl dandar:font-semibold dandar:tracking-tight">
                Welcome to {manifest.title}
              </h1>
              <p className="dandar:text-sm dandar:leading-relaxed dandar:text-muted-foreground">
                {manifest.description}
              </p>
              <div className="dandar:flex dandar:flex-wrap dandar:gap-2">
                <Button asChild>
                  <Link to={`/${path}/settings`}>
                    <IconSettings />
                    Open settings
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href="https://erxes.io/docs/create-plugin-standalone"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconBook />
                    Developer guide
                    <IconExternalLink />
                  </a>
                </Button>
              </div>
            </div>
            <ConnectionCard />
          </div>
        </section>
        <Samples />
        <div className="dandar:grid dandar:gap-4 dandar:md:grid-cols-3">
          {STEPS.map((step) => (
            <StepCard key={step.title} {...step} />
          ))}
        </div>
      </div>
    </div>
  </div>
);
