import { retrievabilityOf, type CardState } from "./scheduler.ts";

export interface TopicMastery {
  topicId: string;
  mastery: number; // 0..1, одоо санаж байгаа магадлалын дундаж
  lapseRate: number; // давталт бүрт мартсан хувь
  weak: boolean;
}

/** Сэдэв бүрийн mastery-г тооцоод сул сэдвийг илрүүлнэ (илүү ойр давтуулахад ашиглана). */
export function topicMastery(cards: CardState[], now: number, weakThreshold = 0.6): TopicMastery[] {
  const byTopic = new Map<string, CardState[]>();
  for (const c of cards) byTopic.set(c.topicId, [...(byTopic.get(c.topicId) ?? []), c]);

  return [...byTopic]
    .map(([topicId, list]) => {
      const mastery = list.reduce((s, c) => s + retrievabilityOf(c, now), 0) / list.length;
      const reviews = list.reduce((s, c) => s + c.reviews, 0);
      const lapses = list.reduce((s, c) => s + c.lapses, 0);
      const lapseRate = reviews === 0 ? 0 : lapses / reviews;
      return { topicId, mastery, lapseRate, weak: mastery < weakThreshold || lapseRate > 0.3 };
    })
    .sort((a, b) => a.mastery - b.mastery);
}

/** Ахицын "learning curve": өдөр тутмын дундаж mastery-н цуваа. */
export function learningCurve(
  history: { at: number; cards: CardState[] }[],
): { at: number; mastery: number }[] {
  return history.map(({ at, cards }) => ({
    at,
    mastery: cards.length
      ? cards.reduce((s, c) => s + retrievabilityOf(c, at), 0) / cards.length
      : 0,
  }));
}
