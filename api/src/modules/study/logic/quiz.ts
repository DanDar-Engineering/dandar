export interface QuizCard {
  id: string;
  deck: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  cardId: string;
  deck: string;
  front: string;
  choices: string[];
}

export const QUIZ_CHOICES = 4;

const norm = (text: string) => text.trim().toLowerCase();

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
};

/**
 * Multiple-choice questions from the student's own cards: wrong choices are
 * other cards' answers, preferring the same deck so they are plausible. No
 * model call. `cards` come in priority order (most forgotten first); cards
 * that cannot get at least one wrong choice are left out.
 */
export function buildQuiz(
  cards: QuizCard[],
  size: number,
  random: () => number = Math.random,
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const card of cards) {
    if (questions.length >= size) break;
    const seen = new Set([norm(card.back)]);
    const pick = (pool: QuizCard[]) => {
      const out: string[] = [];
      for (const other of shuffle(pool, random)) {
        const key = norm(other.back);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(other.back);
      }
      return out;
    };
    const sameDeck = pick(
      cards.filter((other) => other.id !== card.id && other.deck === card.deck),
    );
    const otherDecks = pick(cards.filter((other) => other.deck !== card.deck));
    const wrong = [...sameDeck, ...otherDecks].slice(0, QUIZ_CHOICES - 1);
    if (!wrong.length) continue;
    questions.push({
      cardId: card.id,
      deck: card.deck,
      front: card.front,
      choices: shuffle([card.back, ...wrong], random),
    });
  }
  return questions;
}

/** Compares a picked choice with the card's answer, ignoring case and spaces. */
export const isCorrectChoice = (choice: string, back: string) => norm(choice) === norm(back);
