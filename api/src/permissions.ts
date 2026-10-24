import type { IPermissionConfig } from "erxes-api-shared/core-types";
import { manifest } from "./config.ts";

// Action names are global across the platform, not local to this plugin.
export const SAMPLE_READ = "dandarSamplesRead";
export const SAMPLE_WRITE = "dandarSamplesWrite";

export const permissions: IPermissionConfig = {
  plugin: manifest.name,
  modules: [
    {
      name: "dandarPlanner",
      description: "Personal planner and reminders",
      scopeField: null,
      ownerFields: [],
      scopes: [{ name: "all", description: "Own planner only (enforced by API)" }],
      actions: [
        {
          name: "dandarPlannerRead",
          title: "Read own planner",
          description: "Read personal tasks and study sessions",
        },
        {
          name: "dandarPlannerWrite",
          title: "Update own planner",
          description: "Plan sessions and manage reminders",
        },
      ],
    },
    {
      name: "dandarSamples",
      description: `${manifest.title} sample records`,
      scopeField: null,
      ownerFields: [],
      // This example grants tenant-wide reads only; do not advertise own/group
      // scopes unless the model query actually filters for those scopes.
      scopes: [{ name: "all", description: "All sample records in this tenant" }],
      actions: [
        {
          name: SAMPLE_READ,
          title: "Read sample records",
          description: `View ${manifest.title} sample records`,
        },
        {
          name: SAMPLE_WRITE,
          title: "Create sample records",
          description: `Create ${manifest.title} sample records`,
        },
      ],
    },
  ],
};
