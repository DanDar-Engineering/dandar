import "./styles.css";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppLayout } from "erxes-ui";
import manifest from "../../erxes.json" with { type: "json" };
import { Navigation } from "./modules/Navigation";

const IndexPage = lazy(() =>
  import("./pages/IndexPage").then((module) => ({
    default: module.IndexPage,
  })),
);
const ScansPage = lazy(() =>
  import("./pages/ScansPage").then((module) => ({ default: module.ScansPage })),
);
const StudyPage = lazy(() =>
  import("./pages/StudyPage").then((module) => ({ default: module.StudyPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

// core-ui mounts this component at `/<path>/*`; routes below are relative to
// it. It resolves the component by the PascalCase expose name.
export const Dandar = () => (
  <AppLayout id={manifest.name} title={manifest.title} sidebar={<Navigation />}>
    <Suspense fallback={<div role="status">Loading…</div>}>
      <Routes>
        <Route index element={<IndexPage />} />
        <Route path="scans" element={<ScansPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </Suspense>
  </AppLayout>
);
