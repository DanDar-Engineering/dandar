// How soon a card returns: "10 мин", "3 цаг", "Маргааш", "7 өдөр".
export const formatInterval = (minutes: number) => {
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))} мин`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${Math.round(hours)} цаг`;
  }
  const days = Math.round(hours / 24);

  return days <= 1 ? "Маргааш" : `${days} өдөр`;
};

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("mn-MN");

const WEEKDAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

// "2026-03-02" → "Да" (the date string is already the student's local day).
export const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? "";
