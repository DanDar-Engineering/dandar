// crypto.randomUUID exists only in secure contexts (localhost, HTTPS), so it
// throws on phones that open erxes over plain http on the LAN.
// getRandomValues works everywhere; 128 random bits keep ids unique.
export const createTaskId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
