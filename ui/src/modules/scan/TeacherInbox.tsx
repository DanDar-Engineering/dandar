import { useMutation, useQuery } from "@apollo/client";
import { type FormEvent, useState } from "react";
import { IconMessageCheck } from "@tabler/icons-react";
import { Button, Card, Empty, Textarea, toast } from "erxes-ui";
import { MembersInline } from "ui-modules";
import { SCAN_REVIEW_MUTATION, SCANS_INBOX_QUERY } from "./graphql";
import { ScanBadges } from "./ScanBadges";
import { ScanDetailSheet } from "./ScanDetailSheet";

const PAGE_SIZE = 20;
// Mirrors COMMENT_MAX_LENGTH in api/src/graphql/scan.ts.
const COMMENT_MAX_LENGTH = 2000;

const ReviewForm = ({ scanId, initialComment }: { scanId: string; initialComment: string }) => {
  const [comment, setComment] = useState(initialComment);
  const [review, { loading }] = useMutation(SCAN_REVIEW_MUTATION, {
    refetchQueries: ["dandarScansInbox", "dandarScans"],
    awaitRefetchQueries: true,
    onCompleted: () => toast({ title: "Хариу хадгалагдлаа", variant: "success" }),
    onError: (error) =>
      toast({ title: "Хадгалж чадсангүй", description: error.message, variant: "destructive" }),
  });
  const text = comment.trim();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text) {
      review({ variables: { _id: scanId, comment: text } });
    }
  };

  return (
    <form className="dandar:flex dandar:flex-col dandar:gap-2" onSubmit={onSubmit}>
      <Textarea
        aria-label="Сурагчид өгөх хариу"
        placeholder="Жишээ нь: Материалыг хүлээж авлаа. 3-р бодлогыг дахин шалгаарай."
        value={comment}
        maxLength={COMMENT_MAX_LENGTH}
        rows={3}
        onChange={(event) => setComment(event.target.value)}
      />
      <Button type="submit" size="sm" className="dandar:w-fit" disabled={!text || loading}>
        <IconMessageCheck />
        {loading ? "Хадгалж байна…" : initialComment ? "Хариуг шинэчлэх" : "Хариу өгөх"}
      </Button>
    </form>
  );
};

export const TeacherInbox = () => {
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useQuery(SCANS_INBOX_QUERY, {
    variables: { limit: PAGE_SIZE, offset },
  });
  const scans = data?.dandarScansInbox ?? [];

  return (
    <Card>
      <Card.Header>
        <Card.Title>Надад ирсэн шалгалтын материал</Card.Title>
        <Card.Description>
          Сурагчид таныг сонгож илгээсэн материалууд. Зургийг болон уншсан текстийг нь харж,
          хариу өгнө.
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
              <Empty.Title>Ирсэн материал алга</Empty.Title>
              <Empty.Description>
                Сурагч шалгалтын материал илгээхдээ таныг сонговол энд харагдана.
              </Empty.Description>
            </Empty.Header>
          </Empty>
        ) : (
          <ul className="dandar:divide-y dandar:divide-border">
            {scans.map((scan) => (
              <li key={scan._id} className="dandar:flex dandar:flex-col dandar:gap-3 dandar:py-3">
                <div className="dandar:flex dandar:flex-wrap dandar:items-center dandar:justify-between dandar:gap-2">
                  <div className="dandar:flex dandar:flex-col dandar:gap-1">
                    <span className="dandar:font-medium">{scan.title}</span>
                    <div className="dandar:flex dandar:items-center dandar:gap-2 dandar:text-xs dandar:text-muted-foreground">
                      <MembersInline memberIds={[scan.studentId]} />
                      {[scan.subject, scan.sentAt && new Date(scan.sentAt).toLocaleString()]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="dandar:flex dandar:items-center dandar:gap-2">
                    <ScanBadges kind={scan.kind} status={scan.status} />
                    <ScanDetailSheet scanId={scan._id} title={scan.title} />
                  </div>
                </div>
                <ReviewForm
                  key={scan.teacherComment ?? ""}
                  scanId={scan._id}
                  initialComment={scan.teacherComment ?? ""}
                />
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
