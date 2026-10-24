import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { IconSend } from "@tabler/icons-react";
import { Button, Card, Empty, toast } from "erxes-ui";
import { MembersInline, SelectMember } from "ui-modules";
import { SCAN_SEND_MUTATION, SCANS_QUERY } from "./graphql";
import { ScanBadges } from "./ScanBadges";
import { ScanDetailSheet } from "./ScanDetailSheet";

const PAGE_SIZE = 20;

const SendToTeacher = ({ scanId }: { scanId: string }) => {
  const [teacherId, setTeacherId] = useState("");
  const [send, { loading }] = useMutation(SCAN_SEND_MUTATION, {
    refetchQueries: ["dandarScans", "dandarScansInbox"],
    awaitRefetchQueries: true,
    onCompleted: () => toast({ title: "Багшид илгээлээ", variant: "success" }),
    onError: (error) =>
      toast({ title: "Илгээж чадсангүй", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:gap-2">
      <SelectMember
        mode="single"
        value={teacherId || undefined}
        onValueChange={(value) =>
          setTeacherId(Array.isArray(value) ? (value[0] ?? "") : (value ?? ""))
        }
        placeholder="Багш сонгох"
        className="dandar:w-56"
      />
      <Button
        size="sm"
        disabled={!teacherId || loading}
        onClick={() => send({ variables: { _id: scanId, teacherId } })}
      >
        <IconSend />
        {loading ? "Илгээж байна…" : "Багшид илгээх"}
      </Button>
    </div>
  );
};

export const MyScans = () => {
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useQuery(SCANS_QUERY, {
    variables: { limit: PAGE_SIZE, offset },
  });
  const scans = data?.dandarScans ?? [];

  return (
    <Card>
      <Card.Header>
        <Card.Title>Миний материал</Card.Title>
        <Card.Description>
          Уншуулсан зургууд. Буруу ангилагдсан бол өөрөө багшид илгээж болно.
        </Card.Description>
      </Card.Header>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
        {loading ? (
          <p role="status">Ачаалж байна…</p>
        ) : error ? (
          <div role="alert" className="dandar:flex dandar:flex-col dandar:gap-2">
            <p>{error.message}</p>
            <Button variant="outline" className="dandar:w-fit" onClick={() => refetch()}>
              Дахин оролдох
            </Button>
          </div>
        ) : scans.length === 0 ? (
          <Empty>
            <Empty.Header>
              <Empty.Title>Материал алга</Empty.Title>
              <Empty.Description>Дээрээс эхний зургаа уншуулна уу.</Empty.Description>
            </Empty.Header>
          </Empty>
        ) : (
          <ul className="dandar:divide-y dandar:divide-border">
            {scans.map((scan) => (
              <li key={scan._id} className="dandar:flex dandar:flex-col dandar:gap-2 dandar:py-3">
                <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:justify-between dandar:gap-2">
                  <div className="dandar:flex dandar:flex-col">
                    <span className="dandar:font-medium">{scan.title}</span>
                    <span className="dandar:text-xs dandar:text-muted-foreground">
                      {[scan.subject, scan.createdAt && new Date(scan.createdAt).toLocaleString()]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <div className="dandar:flex dandar:items-center dandar:gap-2">
                    <ScanBadges kind={scan.kind} status={scan.status} />
                    <ScanDetailSheet scanId={scan._id} title={scan.title} />
                  </div>
                </div>
                {scan.summary ? (
                  <p className="dandar:whitespace-pre-wrap dandar:text-sm dandar:leading-relaxed">
                    {scan.summary}
                  </p>
                ) : null}
                {scan.teacherId ? (
                  <div className="dandar:flex dandar:items-center dandar:gap-2 dandar:text-sm">
                    <span className="dandar:text-muted-foreground">Багш:</span>
                    <MembersInline memberIds={[scan.teacherId]} />
                  </div>
                ) : null}
                {scan.teacherComment ? (
                  <p className="dandar:rounded-lg dandar:bg-muted dandar:p-3 dandar:text-sm">
                    {scan.teacherComment}
                  </p>
                ) : null}
                {scan.status === "processed" || scan.status === "awaiting_teacher" ? (
                  <SendToTeacher scanId={scan._id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="dandar:flex dandar:gap-2">
          <Button
            variant="outline"
            disabled={loading || offset === 0}
            onClick={() => setOffset(offset - PAGE_SIZE)}
          >
            Өмнөх
          </Button>
          <Button
            variant="outline"
            disabled={loading || !!error || scans.length < PAGE_SIZE || offset >= 10_000}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Дараах
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};
