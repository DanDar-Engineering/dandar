import { plannerSchema, type PlannerModel, type PlannerState } from "./modules/planner/model.ts";
import type { IMainContext } from "erxes-api-shared/core-types";
import { createGenerateModels } from "erxes-api-shared/utils";
import type { Connection, Model } from "mongoose";
import { type ISampleModel, loadSampleClass } from "./modules/sample/db/models/Sample.ts";
import type { ISampleDocument } from "./modules/sample/db/definitions/sample.ts";
import { type IScanModel, loadScanClass } from "./modules/scan/db/models/Scan.ts";
import type { IScanDocument } from "./modules/scan/db/definitions/scan.ts";
import {
  type IStudyCardDocument,
  type IStudyExamDocument,
  type IStudyReviewDocument,
  type IStudySettingsDocument,
  studyCardSchema,
  studyExamSchema,
  studyReviewSchema,
  studySettingsSchema,
} from "./modules/study/db/definitions/study.ts";

export interface IModels {
  Samples: ISampleModel;
  Planner: PlannerModel;
  Scans: IScanModel;
  StudyCards: Model<IStudyCardDocument>;
  StudyExams: Model<IStudyExamDocument>;
  StudySettings: Model<IStudySettingsDocument>;
  StudyReviews: Model<IStudyReviewDocument>;
}

/**
 * GraphQL resolver context: what `apolloServerContext` in main.ts returns.
 * `subdomain` is the tenant, `models` are bound to that tenant's database.
 */
// IMainContext declares `models?: any`, which would absorb the typed IModels
// in a plain intersection — Omit it first so resolvers get real types.
export type Context = Omit<IMainContext, "models"> & {
  subdomain: string;
  models: IModels;
};

// Every model must come from this factory: createGenerateModels binds the
// connection for the request's tenant (Mongo `useDb` per organization on
// SaaS), so resolvers never touch another tenant's collections.
const loadClasses = (db: Connection) => {
  const models = {} as IModels;

  models.Planner = db.model<PlannerState, PlannerModel>("dandar_planner", plannerSchema);

  models.Samples = db.model<ISampleDocument, ISampleModel>(
    "dandar_samples",
    loadSampleClass(models),
  );
  models.Scans = db.model<IScanDocument, IScanModel>("dandar_scans", loadScanClass(models));
  models.StudyCards = db.model<IStudyCardDocument>("dandar_study_cards", studyCardSchema);
  models.StudyExams = db.model<IStudyExamDocument>("dandar_study_exams", studyExamSchema);
  models.StudySettings = db.model<IStudySettingsDocument>(
    "dandar_study_settings",
    studySettingsSchema,
  );
  models.StudyReviews = db.model<IStudyReviewDocument>("dandar_study_reviews", studyReviewSchema);

  return models;
};

export const generateModels = createGenerateModels<IModels>(loadClasses);
