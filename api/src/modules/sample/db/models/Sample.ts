import type { Model } from "mongoose";
import type { IModels } from "../../../../connectionResolvers.ts";
import { type ISampleDocument, sampleSchema } from "../definitions/sample.ts";

export interface ISampleModel extends Model<ISampleDocument> {
  list(page: { limit: number; offset: number }): Promise<ISampleDocument[]>;
}

// Model statics live on the schema class, matching the monorepo's
// loadXClass(models) convention.
export const loadSampleClass = (models: IModels) => {
  class Sample {
    public static list({ limit, offset }: { limit: number; offset: number }) {
      return models.Samples.find()
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean();
    }
  }

  sampleSchema.loadClass(Sample);

  return sampleSchema;
};
