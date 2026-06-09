export type Card = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export type Shoe = Record<Card, number>;

export interface GameOptions {
  decks: number;
  standOnSoft17: boolean; // true for S17, false for H17
  doubleAfterSplit: boolean; // DAS
  surrenderAllowed: boolean;
  blackjackPayout: number; // e.g., 1.5 for 3:2, 1.2 for 6:5
}

export interface Hand {
  cards: Card[];
  bet: number;
  isSplitHand: boolean;
}

export interface GameState {
  dealerCards: Card[];
  playerHands: Hand[];
  activeHandIndex: number;
  shoe: Shoe;
  options: GameOptions;
}

export function initializeShoe(decks: number): Shoe {
  return {
    '2': 4 * decks,
    '3': 4 * decks,
    '4': 4 * decks,
    '5': 4 * decks,
    '6': 4 * decks,
    '7': 4 * decks,
    '8': 4 * decks,
    '9': 4 * decks,
    'T': 4 * decks,
    'J': 4 * decks,
    'Q': 4 * decks,
    'K': 4 * decks,
    'A': 4 * decks,
  };
}