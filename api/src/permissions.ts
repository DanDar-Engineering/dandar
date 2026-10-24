import type { IPermissionConfig } from "erxes-api-shared/core-types";
import { manifest } from "./config.ts";

// Action names are global across the platform, not local to this plugin.
export const SAMPLE_READ = "dandarSamplesRead";
export const SAMPLE_WRITE = "dandarSamplesWrite";
export const SCAN_SUBMIT = "dandarScansSubmit";
export const SCAN_REVIEW = "dandarScansReview";
export const STUDY_READ = "dandarStudyRead";
export const STUDY_WRITE = "dandarStudyWrite";

export const permissions: IPermissionConfig = {
  plugin: manifest.name,
  modules: [
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
    {
      name: "dandarScans",
      description: `${manifest.title} scanned notes and exam materials`,
      scopeField: null,
      ownerFields: [],
      // Queries already limit records to the uploader or the assigned teacher.
      scopes: [{ name: "own", description: "Own uploads and materials sent to me" }],
      actions: [
        {
          name: SCAN_SUBMIT,
          title: "Scan materials (student)",
          description: "Upload photos, read them with Gemma 4 and send exam materials to a teacher",
        },
        {
          name: SCAN_REVIEW,
          title: "Review exam materials (teacher)",
          description: "See exam materials students sent and answer them",
        },
      ],
    },
    {
      name: "dandarStudy",
      description: `${manifest.title} flashcards, spaced repetition and exam preparation`,
      scopeField: null,
      ownerFields: [],
      // Every query filters by the signed-in student.
      scopes: [{ name: "own", description: "Own cards and exams" }],
      actions: [
        {
          name: STUDY_READ,
          title: "Study cards (student)",
          description: "See own cards, due reviews, deck progress and exams, and ask for card help",
        },
        {
          name: STUDY_WRITE,
          title: "Edit cards (student)",
          description: "Add, generate with Gemma 4, review and delete own cards and set exam dates",
        },
      ],
    },
  ],
};
