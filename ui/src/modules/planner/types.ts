export type Task = {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  minutes: number;
  priority: number;
  status: "todo" | "started" | "completed";
  reminders: number[];
};
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
export type Preferences = {
  enabled: boolean;
  quietStart: number;
  quietEnd: number;
  timeZone: string;
  focus: 25 | 45;
  dailyLimit: number;
  sessionReminderMinutes?: number;
  energy?: Energy;
};
export type State = { tasks: Task[]; blocks: Block[]; preferences: Preferences; delivered: string[]; reminderItems?: ReminderItem[]; availability?: Availability[]; dayLimits?: Record<string,number> };
export type Energy = "low" | "normal" | "high";
export type Availability = {start:string;end:string};
export type ReminderItem = {id:string;notificationId:string;taskId:string;blockId?:string;kind:"deadline"|"session";dueAt:string;expiresAt:string;snoozedUntil?:string};
export type PlanMetrics = {days:{day:string;minutes:number;capacity:number;percent:number|null;overloaded:boolean}[];scheduledMinutes:number;unscheduledMinutes:number;atRiskTasks:number;replacedSessions:number;sessionCount:number;focusMinutes:number;breakMinutes:number};
