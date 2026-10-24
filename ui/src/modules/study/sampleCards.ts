// Mock exam-style cards (ЭЕШ topics) so a new student can try review, quiz
// and progress right away. Added through dandarCardsSave like any other card.
export const SAMPLE_DECKS: { deck: string; cards: { front: string; back: string }[] }[] = [
  {
    deck: "Жишээ · Математик",
    cards: [
      { front: "(a + b)² = ?", back: "a² + 2ab + b²" },
      { front: "Квадрат тэгшитгэлийн дискриминант", back: "D = b² − 4ac" },
      { front: "x² − 5x + 6 = 0 тэгшитгэлийн шийд", back: "x = 2, x = 3" },
      { front: "sin²α + cos²α = ?", back: "1" },
      { front: "Тойргийн талбайн томьёо", back: "S = πr²" },
      { front: "Арифметик прогрессийн n-р гишүүн", back: "aₙ = a₁ + (n − 1)d" },
    ],
  },
  {
    deck: "Жишээ · Физик",
    cards: [
      { front: "Ньютоны хоёрдугаар хууль", back: "F = m·a" },
      { front: "Хурд, зам, хугацааны холбоо", back: "v = s / t" },
      { front: "Кинетик энергийн томьёо", back: "E = mv² / 2" },
      { front: "Хэлхээний хэсгийн Омын хууль", back: "I = U / R" },
      { front: "Дэлхий дээрх чөлөөт уналтын хурдатгал", back: "g ≈ 9.8 м/с²" },
    ],
  },
  {
    deck: "Жишээ · Хими",
    cards: [
      { front: "Усны химийн томьёо", back: "H₂O" },
      { front: "Хоолны давсны химийн томьёо", back: "NaCl" },
      { front: "pH < 7 үед уусмал ямар орчинтой вэ?", back: "Хүчиллэг" },
      { front: "Авогадрын тоо", back: "6.02 × 10²³ моль⁻¹" },
      { front: "Хүчилтөрөгчийн атомын дугаар", back: "8" },
    ],
  },
];

export const SAMPLE_CARD_COUNT = SAMPLE_DECKS.reduce((sum, deck) => sum + deck.cards.length, 0);
