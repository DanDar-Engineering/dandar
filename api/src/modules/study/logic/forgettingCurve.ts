/**
 * Марталтын муруй (Ebbinghaus): R(t) = exp(-t / S)
 *  R — санах магадлал (0..1), t — сүүлд давтснаас хойших өдөр, S — stability (өдөр).
 */
export const DAY_MS = 86_400_000;

export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.exp(-Math.max(0, elapsedDays) / stability);
}

/** Санах магадлал targetRetention хүртэл буурахад шаардагдах өдөр. */
export function intervalForRetention(stability: number, targetRetention: number): number {
  return -stability * Math.log(targetRetention);
}
