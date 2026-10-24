// Sends to the erxes notification bell through core. erxes-api-shared is
// imported lazily: graphql/*.ts loads this file, and print-schema would never
// exit if loading it opened the platform's Redis connection.
export type NotifyInput = {
  title: string;
  message: string;
  // Becomes `dandar:<contentType>`, e.g. dandar:study.review.
  contentType: string;
  type?: "info" | "success" | "warning" | "error";
  // Where the plugin UI shows the subject, e.g. /dandar/study.
  path?: string;
  metadata?: Record<string, string>;
};

// A failed notification never fails the action that triggered it.
export const notifyUsers = async (subdomain: string, userIds: string[], input: NotifyInput) => {
  const recipients = [...new Set(userIds.filter(Boolean))];
  if (!recipients.length) return;
  try {
    const { sendNotification } = await import("erxes-api-shared/core-modules");
    await sendNotification(subdomain, {
      kind: "system",
      userIds: recipients,
      title: input.title,
      message: input.message,
      type: input.type ?? "info",
      contentType: `dandar:${input.contentType}`,
      metadata: { ...input.metadata, ...(input.path ? { path: input.path } : {}) },
    });
  } catch (error) {
    console.error(
      `[dandar] notification ${input.contentType} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
