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

export type DealerProbabilities = Record<number | 'bust' | 'bust_3' | 'bust_4' | 'bust_5' | 'bust_6' | 'bust_7' | 'bust_8_plus', number>;

export function getDealerProbabilities(
  dealerCards: Card[],
  shoe: Shoe,
  options: GameOptions,
  dealerCache?: Map<string, DealerProbabilities>,
  excludeBlackjack: boolean = true
): DealerProbabilities {
  const probs: DealerProbabilities = {
    17: 0,
    18: 0,
    19: 0,
    20: 0,
    21: 0,
    bust: 0,
    bust_3: 0,
    bust_4: 0,
    bust_5: 0,
    bust_6: 0,
    bust_7: 0,
    bust_8_plus: 0,
  };

  const totalCards = Object.values(shoe).reduce((sum, count) => sum + count, 0);

  if (totalCards === 0) {
    return probs;
  }

  const dealerKey = dealerCards.join(',');
  const shoeKey = Object.values(shoe).join(',');
  const ruleKey = options.standOnSoft17 ? 'S17' : 'H17';
  const cacheKey = `${dealerKey}|${shoeKey}|${ruleKey}|${excludeBlackjack}`;

  if (dealerCache && dealerCache.has(cacheKey)) {
    return dealerCache.get(cacheKey)!;
  }

  function simulate(currentCards: Card[], currentProb: number, currentShoe: Shoe) {
    const { total, isSoft } = getHandValue(currentCards);

    // Dealer rules
    if (total > 21) {
      probs.bust += currentProb;
      const len = currentCards.length;
      if (len === 3) probs.bust_3 += currentProb;
      else if (len === 4) probs.bust_4 += currentProb;
      else if (len === 5) probs.bust_5 += currentProb;
      else if (len === 6) probs.bust_6 += currentProb;
      else if (len === 7) probs.bust_7 += currentProb;
      else if (len >= 8) probs.bust_8_plus += currentProb;
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

    // Condition on no Blackjack if excludeBlackjack is true and this is the hole card draw
    const isHoleCardDraw = excludeBlackjack && currentCards.length === 1;
    let allowedCardsInShoe = cardsInShoe;

    if (isHoleCardDraw) {
      const upcard = currentCards[0];
      if (upcard === 'A') {
        const tensCount = (currentShoe['T'] || 0) + (currentShoe['J'] || 0) + (currentShoe['Q'] || 0) + (currentShoe['K'] || 0);
        allowedCardsInShoe = cardsInShoe - tensCount;
      } else if (['T', 'J', 'Q', 'K'].includes(upcard)) {
        const acesCount = currentShoe['A'] || 0;
        allowedCardsInShoe = cardsInShoe - acesCount;
      }
    }

    if (allowedCardsInShoe === 0) return;

    for (const card in currentShoe) {
      const c = card as Card;
      if (currentShoe[c] > 0) {
        if (isHoleCardDraw) {
          const upcard = currentCards[0];
          if (upcard === 'A' && ['T', 'J', 'Q', 'K'].includes(c)) continue;
          if (['T', 'J', 'Q', 'K'].includes(upcard) && c === 'A') continue;
        }

        const drawProb = currentShoe[c] / allowedCardsInShoe;
        const newShoe = { ...currentShoe, [c]: currentShoe[c] - 1 };
        simulate([...currentCards, c], currentProb * drawProb, newShoe);
      }
    }
  }

  simulate(dealerCards, 1, shoe);

  if (dealerCache) {
    dealerCache.set(cacheKey, { ...probs });
  }

  return probs;
}

export function calculateStandEV(
  playerHand: Card[],
  dealerCards: Card[],
  shoe: Shoe,
  options: GameOptions,
  dealerCache?: Map<string, DealerProbabilities>
): number {
  const playerValue = getHandValue(playerHand).total;

  if (playerValue > 21) return -1;

  const dealerProbabilities = getDealerProbabilities(dealerCards, shoe, options, dealerCache, true);
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
  dealerCards: Card[],
  options: GameOptions,
  depth: number = 0,
  memo?: Map<string, number>,
  dealerCache?: Map<string, DealerProbabilities>
): number {
  if (!memo) memo = new Map();

  const { total } = getHandValue(playerHand);
  if (total >= 21) return calculateStandEV(playerHand, dealerCards, shoe, options, dealerCache);

  const sortedCards = [...playerHand].sort().join('');
  const shoeKey = Object.values(shoe).join(',');
  const cacheKey = `H:${sortedCards}|${shoeKey}`;

  if (memo.has(cacheKey)) {
    return memo.get(cacheKey)!;
  }

  if (depth > 12) return calculateStandEV(playerHand, dealerCards, shoe, options, dealerCache);

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
        expectedValue += drawProb * -1;
      } else {
        const standEv = calculateStandEV(newHand, dealerCards, newShoe, options, dealerCache);
        const hitEv = calculateHitEV(newHand, newShoe, dealerCards, options, depth + 1, memo, dealerCache);
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
  dealerCards: Card[],
  options: GameOptions,
  dealerCache?: Map<string, DealerProbabilities>
): number {
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
        expectedValue += drawProb * -2;
      } else {
        const standEv = calculateStandEV(newHand, dealerCards, newShoe, options, dealerCache);
        expectedValue += drawProb * (standEv * 2);
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
  dealerCards: Card[],
  options: GameOptions,
  splitDepth: number = 0,
  memo?: Map<string, number>,
  dealerCache?: Map<string, DealerProbabilities>
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

      if (splitCard === 'A') {
        let maxEv = calculateStandEV(newHand, dealerCards, newShoe, options, dealerCache);
        if (splitDepth < 3 && c === 'A') {
          const resplitEv = calculateSplitEV(newHand, newShoe, dealerCards, options, splitDepth + 1, memo, dealerCache);
          if (resplitEv !== null) {
            maxEv = Math.max(maxEv, resplitEv);
          }
        }
        singleHandEv += drawProb * maxEv;
      } else {
        const standEv = calculateStandEV(newHand, dealerCards, newShoe, options, dealerCache);
        const hitEv = calculateHitEV(newHand, newShoe, dealerCards, options, 0, memo, dealerCache);

        let maxEv = Math.max(standEv, hitEv);

        if (options.doubleAfterSplit) {
          const correctDoubleEv = calculateDoubleEV(newHand, newShoe, dealerCards, options, dealerCache);
          maxEv = Math.max(maxEv, correctDoubleEv);
        }

        if (splitDepth < 3 && areCardsEqualValue(splitCard, c)) {
          const resplitEv = calculateSplitEV(newHand, newShoe, dealerCards, options, splitDepth + 1, memo, dealerCache);
          if (resplitEv !== null) {
            maxEv = Math.max(maxEv, resplitEv);
          }
        }

        singleHandEv += drawProb * maxEv;
      }
    }
  }

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

export interface BetSuggestion {
  runningCount: number;
  trueCount: number;
  suggestedBet: number;
}

import { initializeShoe } from '../types';

export function getBetSuggestion(shoe: Shoe, options: GameOptions): BetSuggestion {
  const initialShoe = initializeShoe(options.decks);
  let runningCount = 0;

  for (const card in shoe) {
    const c = card as Card;
    const cardsPlayed = initialShoe[c] - shoe[c];

    if (options.countingSystem === 'Wong Halves') {
      // Wong Halves
      // 2, 7: +0.5
      // 3, 4, 6: +1
      // 5: +1.5
      // 8: 0
      // 9: -0.5
      // T, A: -1
      if (['2', '7'].includes(c)) runningCount += cardsPlayed * 0.5;
      else if (['3', '4', '6'].includes(c)) runningCount += cardsPlayed * 1;
      else if (c === '5') runningCount += cardsPlayed * 1.5;
      else if (c === '9') runningCount += cardsPlayed * -0.5;
      else if (['T', 'J', 'Q', 'K', 'A'].includes(c)) runningCount += cardsPlayed * -1;
    } else {
      // Hi-Lo
      if (['2', '3', '4', '5', '6'].includes(c)) runningCount += cardsPlayed;
      else if (['T', 'J', 'Q', 'K', 'A'].includes(c)) runningCount -= cardsPlayed;
    }
  }

  const totalCardsRemaining = Object.values(shoe).reduce((sum, count) => sum + count, 0);
  const decksRemaining = Math.max(0.5, totalCardsRemaining / 52); // Ensure we don't divide by near zero

  // For Wong Halves, true count is typically rounded to the nearest half or whole, let's keep one decimal precision for display, but use exact for math
  const exactTrueCount = runningCount / decksRemaining;
  const displayTrueCount = Math.round(exactTrueCount * 2) / 2; // Round to nearest 0.5

  // Exact Edge Calculation Approximation
  // A typical blackjack game has a base house edge of roughly -0.5% (depends on rules, but this is a standard baseline)
  // For Hi-Lo, each true count unit shifts the edge by roughly +0.5%
  // For Wong Halves, the shift is similar but slightly more precise in correlation to the true count value.
  const baseEdge = -0.005; // -0.5%
  const edgePerTC = 0.005; // +0.5%
  const estimatedEdge = baseEdge + (exactTrueCount * edgePerTC);

  let suggestedBet = options.minBet;

  // Strict Kelly Criterion Formula: f* = edge / variance
  // For blackjack, the variance of a hand is approximately 1.15 to 1.3 (due to doubles, splits, blackjacks). We'll use 1.25.
  const variance = 1.15; // Lower variance for more aggressive sizing

  if (estimatedEdge > 0) {
    const kellyFraction = (estimatedEdge / variance) * 2.0; // Double Kelly fraction for more aggressive bet
    suggestedBet = options.balance * kellyFraction;
  }

  // Ensure bet doesn't fall below minBet (unless balance is lower)
  suggestedBet = Math.max(options.minBet, suggestedBet);

  // Ensure bet doesn't exceed 50% of balance as a safety cap (Kelly can be aggressive)
  const maxSafeBet = Math.max(options.minBet, Math.floor(options.balance * 0.5));
  suggestedBet = Math.min(suggestedBet, maxSafeBet);

  // Cap at remaining balance if less than minBet
  suggestedBet = Math.min(suggestedBet, options.balance);

  // Round to nearest 10 for practical betting
  suggestedBet = Math.round(suggestedBet / 10) * 10;

  // Ensure we don't go below minBet due to rounding (rounded up to nearest 10)
  suggestedBet = Math.max(Math.ceil(options.minBet / 10) * 10, suggestedBet);

  if (suggestedBet > options.balance) {
    suggestedBet = Math.floor(options.balance / 10) * 10;
  }

  return {
    runningCount,
    trueCount: displayTrueCount,
    suggestedBet
  };
}

export interface SideBetsEV {
  perfectPairs: number | null;
  twentyOnePlusThree: number | null;
  hot3: number | null;
  bustIt: number | null;
}

export function getSideBetsEV(shoe: Shoe, options: GameOptions): SideBetsEV {
  const totalCards = Object.values(shoe).reduce((a, b) => a + b, 0);
  const D = options.decks;
  const cards = Object.keys(shoe) as Card[];

  let perfectPairs: number | null = null;
  let twentyOnePlusThree: number | null = null;
  let hot3: number | null = null;
  let bustIt: number | null = null;

  // Perfect Pairs
  if (totalCards >= 2) {
    let ev = 0;
    for (const c1 of cards) {
      if (shoe[c1] === 0) continue;
      const p1 = shoe[c1] / totalCards;
      for (const c2 of cards) {
        const count2 = c1 === c2 ? shoe[c2] - 1 : shoe[c2];
        if (count2 <= 0) continue;
        const p2 = count2 / (totalCards - 1);
        const probPair = p1 * p2;

        if (c1 === c2) {
          const pPerfect = (D - 1) / (4 * D - 1);
          const pColored = D / (4 * D - 1);
          const pMixed = (2 * D) / (4 * D - 1);
          ev += probPair * (25 * pPerfect + 12 * pColored + 6 * pMixed);
        } else {
          ev += probPair * -1;
        }
      }
    }
    perfectPairs = ev;
  }

  const isStraight = (r1: Card, r2: Card, r3: Card) => {
    const values = [r1, r2, r3].map(c => {
      if (c === 'A') return 1;
      if (c === 'T') return 10;
      if (c === 'J') return 11;
      if (c === 'Q') return 12;
      if (c === 'K') return 13;
      return parseInt(c, 10);
    }).sort((a, b) => a - b);
    if (values[0] + 1 === values[1] && values[1] + 1 === values[2]) return true;
    if (values[0] === 1 && values[1] === 12 && values[2] === 13) return true; // Q, K, A
    return false;
  };

  // 21+3 & Hot 3
  if (totalCards >= 3) {
    let ev213 = 0;
    let evHot3 = 0;
    for (const c1 of cards) {
      if (shoe[c1] === 0) continue;
      const p1 = shoe[c1] / totalCards;
      for (const c2 of cards) {
        const count2 = c1 === c2 ? shoe[c2] - 1 : shoe[c2];
        if (count2 <= 0) continue;
        const p2 = count2 / (totalCards - 1);
        for (const c3 of cards) {
          let count3 = shoe[c3];
          if (c1 === c3) count3--;
          if (c2 === c3) count3--;
          if (count3 <= 0) continue;
          const p3 = count3 / (totalCards - 2);
          const prob = p1 * p2 * p3;

          let pSuited: number;
          if (c1 !== c2 && c2 !== c3 && c1 !== c3) pSuited = 1 / 16;
          else if (c1 === c2 && c2 === c3) pSuited = ((D - 1) / (4 * D - 1)) * ((D - 2) / (4 * D - 2));
          else pSuited = ((D - 1) / (4 * D - 1)) * (1 / 4);

          // 21+3 logic
          const straight = isStraight(c1, c2, c3);
          const threeOfKind = (c1 === c2 && c2 === c3);
          if (threeOfKind) {
            ev213 += prob * (pSuited * 100 + (1 - pSuited) * 30);
          } else if (straight) {
            ev213 += prob * (pSuited * 40 + (1 - pSuited) * 10);
          } else {
            ev213 += prob * (pSuited * 5 + (1 - pSuited) * -1);
          }

          // Hot 3 logic (Aces are valued at 1 or 11 to maximize payout)
          const getHot3Total = (cardsList: Card[]) => {
            let totalVal = 0;
            let acesCount = 0;
            for (const c of cardsList) {
              if (c === 'A') {
                acesCount++;
                totalVal += 11;
              } else if (['T', 'J', 'Q', 'K'].includes(c)) {
                totalVal += 10;
              } else {
                totalVal += parseInt(c, 10);
              }
            }
            while (totalVal > 21 && acesCount > 0) {
              totalVal -= 10;
              acesCount--;
            }
            return totalVal;
          };

          const total = getHot3Total([c1, c2, c3]);
          if (c1 === '7' && c2 === '7' && c3 === '7') {
             evHot3 += prob * 100;
          } else if (total === 21) {
             evHot3 += prob * (pSuited * 20 + (1 - pSuited) * 4);
          } else if (total === 20) {
             evHot3 += prob * 2;
          } else if (total === 19) {
             evHot3 += prob * 1;
          } else {
             evHot3 += prob * -1;
          }
        }
      }
    }
    twentyOnePlusThree = ev213;
    hot3 = evHot3;
  }

  // Bust It
  if (totalCards > 0) {
    let evBustIt = 0;
    for (const upcard of cards) {
      if (shoe[upcard] === 0) continue;
      const probUpcard = shoe[upcard] / totalCards;
      const shoeMinusUpcard = { ...shoe, [upcard]: shoe[upcard] - 1 };

      const probs = getDealerProbabilities([upcard], shoeMinusUpcard, options, undefined, false);
      const b3 = probs.bust_3 || 0;
      const b4 = probs.bust_4 || 0;
      const b5 = probs.bust_5 || 0;
      const b6 = probs.bust_6 || 0;
      const b7 = probs.bust_7 || 0;
      const b8 = probs.bust_8_plus || 0;

      const winProb = b3 + b4 + b5 + b6 + b7 + b8;
      const loseProb = 1 - winProb;
      const upcardEv = b3 * 1 + b4 * 2 + b5 * 9 + b6 * 50 + b7 * 100 + b8 * 250 - loseProb * 1;

      evBustIt += probUpcard * upcardEv;
    }
    bustIt = evBustIt;
  }

  return { perfectPairs, twentyOnePlusThree, hot3, bustIt };
}

export function getBestMove(
  playerHand: Card[],
  dealerUpcard: Card,
  shoe: Shoe,
  options: GameOptions
): BestMoveResult {
  const memo = new Map<string, number>();
  const dealerCache = new Map<string, DealerProbabilities>();

  const dealerCards = [dealerUpcard];

  // Stand EV
  const standEV = calculateStandEV(playerHand, dealerCards, shoe, options, dealerCache);

  // Hit EV
  const hitEV = calculateHitEV(playerHand, shoe, dealerCards, options, 0, memo, dealerCache);

  // Double EV (only on 2 cards usually)
  let doubleEV: number | null = null;
  if (playerHand.length === 2) {
    doubleEV = calculateDoubleEV(playerHand, shoe, dealerCards, options, dealerCache);
  }

  // Split EV
  let splitEV: number | null = null;
  if (playerHand.length === 2 && areCardsEqualValue(playerHand[0], playerHand[1])) {
     splitEV = calculateSplitEV(playerHand, shoe, dealerCards, options, 0, memo, dealerCache);
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