import { getBestMove, type BestMoveResult } from '../engine/blackjackEngine';
import { type Card, type Shoe, type GameOptions } from '../types';

export interface WorkerMessageData {
  playerHand: Card[];
  dealerUpcard: Card;
  shoe: Shoe;
  options: GameOptions;
}

export interface WorkerResponseMessageData {
  result: BestMoveResult;
}

self.onmessage = (event: MessageEvent<WorkerMessageData>) => {
  const { playerHand, dealerUpcard, shoe, options } = event.data;

  try {
    const result = getBestMove(playerHand, dealerUpcard, shoe, options);
    self.postMessage({ result });
  } catch (error) {
    // Handling error if any
    console.error("Worker error:", error);
  }
};
