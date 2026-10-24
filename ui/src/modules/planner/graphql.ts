import { gql } from "~/gql";
export const PLANNER = gql(`query dandarPlanner { dandarPlanner { version data } }`);
export const UPDATE = gql(
  `mutation dandarPlannerUpdate($version: Int!, $action: String!, $data: String!) { dandarPlannerUpdate(version: $version, action: $action, data: $data) { version data } }`,
);
export const PROPOSE = gql(
  `mutation dandarPlanPropose($windows: String!) { dandarPlanPropose(windows: $windows) { data warnings model } }`,
);
