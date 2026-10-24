import { gql } from "~/gql";
export const PLANNER = gql(`query dandarPlanner { dandarPlanner { version data } }`);
export const UPDATE = gql(
  `mutation dandarPlannerUpdate($version: Int!, $action: String!, $data: String!) { dandarPlannerUpdate(version: $version, action: $action, data: $data) { version data } }`,
);
export const PROPOSE = gql(`mutation dandarPlanPropose($windows: String!, $options: String) { dandarPlanPropose(windows: $windows, options: $options) { version data warnings model replaceIds policy metrics } }`);
export const SIMULATE = gql(`mutation dandarPlannerSimulate($input: String!) { dandarPlannerSimulate(input: $input) { baseline { version data warnings model replaceIds policy metrics } scenario { version data warnings model replaceIds policy metrics } } }`);
