import { z } from "zod";

export const energyInput = z.enum(["low", "normal", "high"]);
export type Energy = z.infer<typeof energyInput>;
export type Availability = { start: string; end: string };
export type Snooze = { id: string; until: string };

export const taskInput = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(80).default(""),
  deadline: z.iso.datetime(),
  minutes: z.number().int().min(5).max(2400),
  priority: z.number().int().min(1).max(3),
  status: z.enum(["todo", "started", "completed"]).default("todo"),
  reminders: z.array(z.number().int().min(0).max(10080)).max(5).default([1440, 60, 0]),
});
export const preferencesInput = z.object({
  enabled: z.boolean(),
  quietStart: z.number().int().min(0).max(23),
  quietEnd: z.number().int().min(0).max(23),
  timeZone: z.string().min(1).max(80),
  focus: z.union([z.literal(25), z.literal(45)]),
  sessionReminderMinutes: z.number().int().min(0).max(10080).optional(),
  energy: energyInput.optional(),
  dailyLimit: z.number().int().min(25).max(480),
});
export type Task = z.infer<typeof taskInput>;
export type Preferences = z.infer<typeof preferencesInput>;
export type Block = {
  id: string;
  taskId: string;
  start: string;
  end: string;
  status: "planned" | "started" | "completed" | "missed";
  actualMinutes: number;
  startedAt?: string;
  breakMinutes?: number;
};
export type PlannerState = {
  userId: string;
  version: number;
  tasks: Task[];
  blocks: Block[];
  preferences: Preferences;
  delivered: string[];
  dismissed?: string[];
  snoozed?: Snooze[];
  availability?: Availability[];
  dayLimits?: Record<string, number>;
};
