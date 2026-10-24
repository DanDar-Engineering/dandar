import { IconCards } from "@tabler/icons-react";
import { Breadcrumb, Button, Separator, Tabs } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link, useSearchParams } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { AddCards } from "../modules/study/AddCards";
import { Exams } from "../modules/study/Exams";
import { Library } from "../modules/study/Library";
import { ReviewPanel } from "../modules/study/ReviewPanel";

const { path } = manifest.ui;
const TABS = ["review", "add", "exams", "library"] as const;
type StudyTab = (typeof TABS)[number];

// `?tab=add&scan=<id>` is how "Миний материал" hands a scan over to card
// generation; the tab lives in the URL so the link survives a reload.
export const StudyPage = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: StudyTab = TABS.find((item) => item === requested) ?? "review";
  const scanId = params.get("scan") ?? undefined;

  return (
    <div className="dandar:flex dandar:h-full dandar:flex-col">
      <PageHeader>
        <PageHeader.Start>
          <Breadcrumb>
            <Breadcrumb.List className="dandar:gap-1">
              <Breadcrumb.Item>
                <Button variant="ghost" asChild>
                  <Link to={`/${path}/study`}>
                    <IconCards />
                    Давтлага
                  </Link>
                </Button>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb>
          <Separator.Inline />
          <PageHeader.FavoriteToggleButton
            breadcrumb={[manifest.title, "Давтлага"]}
            icon="IconCards"
          />
        </PageHeader.Start>
      </PageHeader>
      <div className="dandar:flex-1 dandar:overflow-auto">
        <div className="dandar:mx-auto dandar:flex dandar:w-full dandar:max-w-4xl dandar:flex-col dandar:gap-6 dandar:p-6">
          <Tabs
            value={tab}
            onValueChange={(value) => setParams(value === "review" ? {} : { tab: value })}
            className="dandar:flex dandar:flex-col dandar:gap-4"
          >
            <Tabs.List className="dandar:w-fit">
              <Tabs.Trigger value="review">Өнөөдөр</Tabs.Trigger>
              <Tabs.Trigger value="add">Карт нэмэх</Tabs.Trigger>
              <Tabs.Trigger value="exams">Шалгалт</Tabs.Trigger>
              <Tabs.Trigger value="library">Багц</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="review">
              <ReviewPanel />
            </Tabs.Content>
            <Tabs.Content value="add">
              <AddCards initialScanId={scanId} />
            </Tabs.Content>
            <Tabs.Content value="exams">
              <Exams />
            </Tabs.Content>
            <Tabs.Content value="library">
              <Library />
            </Tabs.Content>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
