import { getBestMove, getSideBetsEV, getBetSuggestion, type BestMoveResult, type SideBetsEV, type BetSuggestion } from '../engine/blackjackEngine';
import { type Card, type Shoe, type GameOptions } from '../types';

export interface WorkerMessageData {
  type: 'bestMove' | 'sideBets' | 'betSuggestion';
  playerHand?: Card[];
  dealerUpcard?: Card;
  shoe: Shoe;
  options: GameOptions;
}

export interface WorkerResponseMessageData {
  type: 'bestMove' | 'sideBets' | 'betSuggestion';
  result?: BestMoveResult;
  sideBets?: SideBetsEV;
  betSuggestion?: BetSuggestion;
}

self.onmessage = (event: MessageEvent<WorkerMessageData>) => {
  const { type, playerHand, dealerUpcard, shoe, options } = event.data;

  try {
    if (type === 'bestMove' && playerHand && dealerUpcard) {
      const result = getBestMove(playerHand, dealerUpcard, shoe, options);
      self.postMessage({ type: 'bestMove', result });
    } else if (type === 'sideBets') {
      const sideBets = getSideBetsEV(shoe, options);
      self.postMessage({ type: 'sideBets', sideBets });
    } else if (type === 'betSuggestion') {
      const betSuggestion = getBetSuggestion(shoe, options);
      self.postMessage({ type: 'betSuggestion', betSuggestion });
    }
  } catch (error) {
    console.error("Worker error:", error);
  }
};
