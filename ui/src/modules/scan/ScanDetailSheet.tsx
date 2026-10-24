import { useQuery } from "@apollo/client";
import { useState } from "react";
import { IconEye } from "@tabler/icons-react";
import { Button, Sheet, Skeleton } from "erxes-ui";
import { SCAN_DETAIL_QUERY } from "./graphql";
import { ScanBadges } from "./ScanBadges";

const Section = ({ title, children }: { title: string; children: string }) => (
  <section className="dandar:flex dandar:flex-col dandar:gap-1">
    <h3 className="dandar:text-sm dandar:font-medium">{title}</h3>
    <p className="dandar:whitespace-pre-wrap dandar:rounded-lg dandar:bg-muted dandar:p-3 dandar:text-sm dandar:leading-relaxed">
      {children}
    </p>
  </section>
);

const ScanDetail = ({ scanId }: { scanId: string }) => {
  const { data, loading, error, refetch } = useQuery(SCAN_DETAIL_QUERY, {
    variables: { _id: scanId },
  });
  const scan = data?.dandarScanDetail;

  if (loading) {
    return (
      <div role="status" className="dandar:flex dandar:flex-col dandar:gap-3">
        <Skeleton className="dandar:h-64 dandar:w-full" />
        <Skeleton className="dandar:h-24 dandar:w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2 dandar:text-sm">
        <p>{error.message}</p>
        <Button variant="outline" className="dandar:w-fit" onClick={() => refetch()}>
          Дахин оролдох
        </Button>
      </div>
    );
  }
  if (!scan) {
    return <p className="dandar:text-sm dandar:text-muted-foreground">Материал олдсонгүй.</p>;
  }

  return (
    <div className="dandar:flex dandar:flex-col dandar:gap-4">
      <ScanBadges kind={scan.kind} status={scan.status} />
      {scan.imageUrl ? (
        <img
          src={scan.imageUrl}
          alt={scan.title}
          className="dandar:w-full dandar:rounded-lg dandar:border dandar:border-border"
        />
      ) : null}
      {scan.summary ? <Section title="Хураангуй">{scan.summary}</Section> : null}
      <Section title="Уншсан текст">{scan.text}</Section>
      {scan.teacherComment ? <Section title="Багшийн хариу">{scan.teacherComment}</Section> : null}
    </div>
  );
};

export const ScanDetailSheet = ({ scanId, title }: { scanId: string; title: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Sheet.Trigger asChild>
        <Button variant="outline" size="sm">
          <IconEye />
          Харах
        </Button>
      </Sheet.Trigger>
      <Sheet.View className="dandar:w-full dandar:sm:max-w-2xl dandar:p-0">
        <Sheet.Header className="dandar:p-5">
          <Sheet.Title>{title}</Sheet.Title>
          <Sheet.Description className="dandar:sr-only">
            Зураг, Gemma 4-ийн уншсан текст болон хураангуй
          </Sheet.Description>
        </Sheet.Header>
        <Sheet.Content className="dandar:overflow-auto dandar:p-5">
          {/* Mounted only while open, so the photo loads on demand. */}
          {open ? <ScanDetail scanId={scanId} /> : null}
        </Sheet.Content>
      </Sheet.View>
    </Sheet>
  );
};
