import { IconSchool, IconScan, IconUser } from "@tabler/icons-react";
import { Breadcrumb, Button, Separator, Tabs } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { MyScans } from "../modules/scan/MyScans";
import { ScanWizard } from "../modules/scan/ScanWizard";
import { TeacherInbox } from "../modules/scan/TeacherInbox";

const { path } = manifest.ui;

// Roles follow the relationship, not a separate setting: whoever uploads is
// the student of that material, whoever it is sent to is its teacher.
export const ScansPage = () => (
  <div className="dandar:flex dandar:h-full dandar:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="dandar:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}/scans`}>
                  <IconScan />
                  Зураг уншуулах
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton
          breadcrumb={[manifest.title, "Зураг уншуулах"]}
          icon="IconScan"
        />
      </PageHeader.Start>
    </PageHeader>
    <div className="dandar:flex-1 dandar:overflow-auto">
      <div className="dandar:mx-auto dandar:flex dandar:w-full dandar:max-w-6xl dandar:flex-col dandar:gap-6 dandar:p-6">
        <Tabs defaultValue="student" className="dandar:flex dandar:flex-col dandar:gap-4">
          <Tabs.List className="dandar:w-fit">
            <Tabs.Trigger value="student" className="dandar:gap-2">
              <IconUser className="dandar:size-4" />
              Сурагч
            </Tabs.Trigger>
            <Tabs.Trigger value="teacher" className="dandar:gap-2">
              <IconSchool className="dandar:size-4" />
              Багш
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="student" className="dandar:flex dandar:flex-col dandar:gap-6">
            <ScanWizard />
            <MyScans />
          </Tabs.Content>
          <Tabs.Content value="teacher">
            <TeacherInbox />
          </Tabs.Content>
        </Tabs>
      </div>
    </div>
  </div>
);
