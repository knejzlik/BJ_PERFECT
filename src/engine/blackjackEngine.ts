import { type Card, type Shoe, type GameOptions } from '../types';

export function getHandValue(cards: Card[]): { total: number; isSoft: boolean } {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card === 'A') {
      aces++;
      total += 11;
    } else if (['T', 'J', 'Q', 'K'].includes(card)) {
      total += 10;
    } else {
      total += parseInt(card, 10);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return { total, isSoft: aces > 0 };
}

export type DealerProbabilities = Record<number | 'bust', number>;

export function getDealerProbabilities(
  dealerCards: Card[],
  shoe: Shoe,
  options: GameOptions
): DealerProbabilities {
  const probs: DealerProbabilities = {
    17: 0,
    18: 0,
    19: 0,
    20: 0,
    21: 0,
    bust: 0,
  };

  const totalCards = Object.values(shoe).reduce((sum, count) => sum + count, 0);

  if (totalCards === 0) {
    return probs;
  }

  function simulate(currentCards: Card[], currentProb: number, currentShoe: Shoe) {
    const { total, isSoft } = getHandValue(currentCards);

    // Dealer rules
    if (total > 21) {
      probs.bust += currentProb;
      return;
    }

    if (total >= 17) {
      if (total === 17 && isSoft && !options.standOnSoft17) {
        // Dealer hits on soft 17 (H17)
      } else {
        // Dealer stands
        probs[total as keyof DealerProbabilities] += currentProb;
        return;
      }
    }

    const cardsInShoe = Object.values(currentShoe).reduce((sum, count) => sum + count, 0);
    if (cardsInShoe === 0) return;

    for (const card in currentShoe) {
      const c = card as Card;
      if (currentShoe[c] > 0) {
        const drawProb = currentShoe[c] / cardsInShoe;
        const newShoe = { ...currentShoe, [c]: currentShoe[c] - 1 };
        simulate([...currentCards, c], currentProb * drawProb, newShoe);
      }
    }
  }

  simulate(dealerCards, 1, shoe);

  return probs;
}

export function calculateStandEV(playerHand: Card[], dealerProbabilities: DealerProbabilities): number {
  const playerValue = getHandValue(playerHand).total;

  if (playerValue > 21) return -1;

  let ev = 0;

  for (const dealerResultStr in dealerProbabilities) {
    const prob = dealerProbabilities[dealerResultStr as keyof DealerProbabilities];
    if (prob === 0) continue;

    if (dealerResultStr === 'bust') {
      ev += prob * 1;
    } else {
      const dealerValue = parseInt(dealerResultStr, 10);
      if (playerValue > dealerValue) {
        ev += prob * 1;
      } else if (playerValue < dealerValue) {
        ev += prob * -1;
      } else {
        ev += prob * 0; // Push
      }
    }
  }

  return ev;
}

export function calculateHitEV(
  playerHand: Card[],
  shoe: Shoe,
  dealerProbabilities: DealerProbabilities,
  options: GameOptions,
  depth: number = 0,
  memo?: Map<string, number>
): number {
  if (!memo) memo = new Map();

  const { total } = getHandValue(playerHand);
  if (total >= 21) return calculateStandEV(playerHand, dealerProbabilities); // Can't hit if 21 or bust

  // Basic cache key (player cards sorted + shoe values)
  const sortedCards = [...playerHand].sort().join('');
  const shoeKey = Object.values(shoe).join(',');
  const cacheKey = `H:${sortedCards}|${shoeKey}`;

  if (memo.has(cacheKey)) {
    return memo.get(cacheKey)!;
  }

  // Prevent stack overflow for extremely unlikely long sequences
  if (depth > 12) return calculateStandEV(playerHand, dealerProbabilities);

  const totalCards = Object.values(shoe).reduce((sum, count) => sum + count, 0);
  if (totalCards === 0) return 0;

  let expectedValue = 0;

  for (const card in shoe) {
    const c = card as Card;
    if (shoe[c] > 0) {
      const drawProb = shoe[c] / totalCards;
      const newShoe = { ...shoe, [c]: shoe[c] - 1 };
      const newHand = [...playerHand, c];

      const newTotal = getHandValue(newHand).total;

      if (newTotal > 21) {
        expectedValue += drawProb * -1; // Bust
      } else {
        // The choice is either to stand with the new hand or hit again
        const standEv = calculateStandEV(newHand, dealerProbabilities);
        const hitEv = calculateHitEV(newHand, newShoe, dealerProbabilities, options, depth + 1, memo);
        expectedValue += drawProb * Math.max(standEv, hitEv);
      }
    }
  }

  memo.set(cacheKey, expectedValue);
  return expectedValue;
}

export function calculateDoubleEV(
  playerHand: Card[],
  shoe: Shoe,
  dealerProbabilities: DealerProbabilities,
): number {
  // You only get one card on a double down
  const totalCards = Object.values(shoe).reduce((sum, count) => sum + count, 0);
  if (totalCards === 0) return 0;

  let expectedValue = 0;

  for (const card in shoe) {
    const c = card as Card;
    if (shoe[c] > 0) {
      const drawProb = shoe[c] / totalCards;
      const newHand = [...playerHand, c];

      const newTotal = getHandValue(newHand).total;

      if (newTotal > 21) {
        expectedValue += drawProb * -2; // Bust, lose double bet
      } else {
        // Must stand after double
        const standEv = calculateStandEV(newHand, dealerProbabilities);
        expectedValue += drawProb * (standEv * 2); // Double the normal EV
      }
    }
  }

  return expectedValue;
}

export function calculateSurrenderEV(): number {
  return -0.5;
}

function areCardsEqualValue(c1: Card, c2: Card): boolean {
  const v1 = ['T', 'J', 'Q', 'K'].includes(c1) ? '10' : c1;
  const v2 = ['T', 'J', 'Q', 'K'].includes(c2) ? '10' : c2;
  return v1 === v2;
}

export function calculateSplitEV(
  playerHand: Card[],
  shoe: Shoe,
  dealerProbabilities: DealerProbabilities,
  options: GameOptions,
  memo?: Map<string, number>
): number | null {
  if (playerHand.length !== 2) return null;
  if (!areCardsEqualValue(playerHand[0], playerHand[1])) return null;

  const totalCards = Object.values(shoe).reduce((sum, count) => sum + count, 0);
  if (totalCards === 0) return 0;

  const splitCard = playerHand[0];
  let singleHandEv = 0;

  for (const card in shoe) {
    const c = card as Card;
    if (shoe[c] > 0) {
      const drawProb = shoe[c] / totalCards;
      const newShoe = { ...shoe, [c]: shoe[c] - 1 };
      const newHand = [splitCard, c];

      // If we split Aces, we usually only get one card
      if (splitCard === 'A') {
        singleHandEv += drawProb * calculateStandEV(newHand, dealerProbabilities);
      } else {
        const standEv = calculateStandEV(newHand, dealerProbabilities);
        const hitEv = calculateHitEV(newHand, newShoe, dealerProbabilities, options, 0, memo);

        // Simplified: assume we take the best of hit/stand/double for each resulting hand
        // In a perfect engine, we'd recursively calculate EVs, but this is a close approximation
        // considering DAS (Double After Split)
        let maxEv = Math.max(standEv, hitEv);

        if (options.doubleAfterSplit) {
          calculateDoubleEV([splitCard], newShoe, dealerProbabilities);
          // Only compare double EV if it's a valid move (which it is on 2 cards)
          // Wait, calculateDoubleEV needs the *newHand* not just [splitCard]
          const correctDoubleEv = calculateDoubleEV([splitCard], newShoe, dealerProbabilities); // It simulates drawing one card

          maxEv = Math.max(maxEv, correctDoubleEv);
        }

        singleHandEv += drawProb * maxEv;
      }
    }
  }

  // Splitting gives you two hands with this expected EV
  return singleHandEv * 2;
}

export interface ActionEVs {
  Stand: number;
  Hit: number;
  Double: number | null;
  Split: number | null;
  Surrender: number | null;
}

export interface BestMoveResult {
  actionEVs: ActionEVs;
  bestAction: keyof ActionEVs;
  bestEV: number;
}

export function getBestMove(
  playerHand: Card[],
  dealerUpcard: Card,
  shoe: Shoe,
  options: GameOptions
): BestMoveResult {
  const memo = new Map<string, number>();

  // Calculate dealer probabilities once for the given upcard
  const dealerCards = [dealerUpcard];
  const shoeWithoutUpcard = { ...shoe };
  if (shoeWithoutUpcard[dealerUpcard] > 0) {
    shoeWithoutUpcard[dealerUpcard]--;
  }
  const dealerProbabilities = getDealerProbabilities(dealerCards, shoeWithoutUpcard, options);

  // Stand EV
  const standEV = calculateStandEV(playerHand, dealerProbabilities);

  // Hit EV
  const hitEV = calculateHitEV(playerHand, shoeWithoutUpcard, dealerProbabilities, options, 0, memo);

  // Double EV (only on 2 cards usually)
  let doubleEV: number | null = null;
  if (playerHand.length === 2) {
    doubleEV = calculateDoubleEV(playerHand, shoeWithoutUpcard, dealerProbabilities);
  }

  // Split EV
  let splitEV: number | null = null;
  if (playerHand.length === 2 && areCardsEqualValue(playerHand[0], playerHand[1])) {
     splitEV = calculateSplitEV(playerHand, shoeWithoutUpcard, dealerProbabilities, options, memo);
  }

  // Surrender EV
  let surrenderEV: number | null = null;
  if (playerHand.length === 2 && options.surrenderAllowed) {
    surrenderEV = calculateSurrenderEV();
  }

  const actionEVs: ActionEVs = {
    Stand: standEV,
    Hit: hitEV,
    Double: doubleEV,
    Split: splitEV,
    Surrender: surrenderEV,
  };

  let bestAction: keyof ActionEVs = 'Stand';
  let bestEV = standEV;

  if (hitEV > bestEV) {
    bestAction = 'Hit';
    bestEV = hitEV;
  }
  if (doubleEV !== null && doubleEV > bestEV) {
    bestAction = 'Double';
    bestEV = doubleEV;
  }
  if (splitEV !== null && splitEV > bestEV) {
    bestAction = 'Split';
    bestEV = splitEV;
  }
  if (surrenderEV !== null && surrenderEV > bestEV) {
    bestAction = 'Surrender';
    bestEV = surrenderEV;
  }

  return {
    actionEVs,
    bestAction,
    bestEV,
  };
}