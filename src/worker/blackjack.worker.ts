import { getBestMove, getSideBetsEV, type BestMoveResult, type SideBetsEV } from '../engine/blackjackEngine';
import { type Card, type Shoe, type GameOptions } from '../types';

export interface WorkerMessageData {
  type: 'bestMove' | 'sideBets';
  playerHand?: Card[];
  dealerUpcard?: Card;
  shoe: Shoe;
  options: GameOptions;
}

export interface WorkerResponseMessageData {
  type: 'bestMove' | 'sideBets';
  result?: BestMoveResult;
  sideBets?: SideBetsEV;
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
    }
  } catch (error) {
    console.error("Worker error:", error);
  }
};
