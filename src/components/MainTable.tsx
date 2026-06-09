import React from 'react';
import { type Card, type Hand } from '../types';

interface MainTableProps {
  dealerCards: Card[];
  playerHands: Hand[];
  discardCards: Card[];
  activeHandIndex: number;
  activeSlot: { type: 'dealer' | 'player' | 'discard', handIndex?: number } | null;
  setActiveSlot: (slot: { type: 'dealer' | 'player' | 'discard', handIndex?: number }) => void;
  onSplit?: (handIndex: number) => void;
  onNextHand?: () => void;
}

export const MainTable: React.FC<MainTableProps> = ({
  dealerCards,
  playerHands,
  discardCards,
  activeHandIndex,
  activeSlot,
  setActiveSlot,
  onSplit,
  onNextHand,
}) => {

  const renderCard = (card: Card, index: number, _isDealer: boolean) => (
    <div key={index} className="w-10 h-14 sm:w-12 sm:h-16 md:w-16 md:h-24 bg-white rounded shadow-md flex items-center justify-center text-lg sm:text-xl md:text-2xl font-bold text-gray-800 border-2 border-gray-300 shrink-0">
      {card}
    </div>
  );

  const renderEmptySlot = (type: 'dealer' | 'player' | 'discard', handIndex?: number) => {
    const isActive = activeSlot?.type === type && activeSlot?.handIndex === handIndex;
    return (
      <div
        onClick={() => setActiveSlot({ type, handIndex })}
        className={`w-10 h-14 sm:w-12 sm:h-16 md:w-16 md:h-24 rounded border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
          isActive ? 'border-yellow-400 bg-yellow-50' : 'border-gray-400 hover:border-gray-200 hover:bg-white/10'
        }`}
      >
        <span className={isActive ? 'text-yellow-600 font-bold' : 'text-gray-400'}>+</span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center bg-green-800 p-2 sm:p-4 overflow-y-auto">
      {/* Dealer Zone */}
      <div className="flex flex-col items-center mb-6 w-full">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80">Dealer</h2>
        <div className="flex flex-wrap gap-1 md:gap-2 p-2 bg-black/20 rounded-xl min-h-[4.5rem] md:min-h-[7rem] min-w-[120px] md:min-w-[200px] justify-center items-center">
          {dealerCards.map((card, idx) => renderCard(card, idx, true))}
          {renderEmptySlot('dealer')}
        </div>
      </div>

      {/* Discard Tray Zone */}
      <div className="flex flex-col items-center mb-6 w-full">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80">Other Players (Discard Tray)</h2>
        <div className="flex flex-wrap gap-1 md:gap-2 p-2 bg-black/20 rounded-xl min-h-[4.5rem] md:min-h-[7rem] w-full max-w-4xl justify-center items-center">
          {discardCards.map((card, idx) => renderCard(card, idx, false))}
          {renderEmptySlot('discard')}
        </div>
      </div>

      {/* Player Zone */}
      <div className="flex flex-col items-center w-full mt-auto mb-4">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80">Player</h2>
        <div className="flex gap-2 sm:gap-4 md:gap-8 overflow-x-auto max-w-full pb-2 w-full justify-center">
          {playerHands.map((hand, index) => {
            const isActiveHand = index === activeHandIndex;
            const canSplit = hand.cards.length === 2 && hand.cards[0] === hand.cards[1];

            return (
              <div
                key={index}
                className={`flex flex-col items-center p-2 md:p-4 rounded-xl transition-all ${
                  isActiveHand ? 'bg-blue-600/30 ring-2 md:ring-4 ring-blue-400' : 'bg-black/20'
                }`}
              >
                <div className="flex flex-wrap gap-1 md:gap-2 mb-2 md:mb-4 items-center justify-center min-h-[4.5rem] md:min-h-[7rem] max-w-[280px]">
                  {hand.cards.map((card, idx) => renderCard(card, idx, false))}
                  {renderEmptySlot('player', index)}
                </div>

                <div className="flex gap-2 mt-auto">
                  {onSplit && canSplit && (
                    <button
                      onClick={() => onSplit(index)}
                      className="px-2 py-1 md:px-3 md:py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs md:text-sm font-medium transition-colors"
                    >
                      Split
                    </button>
                  )}
                  {onNextHand && playerHands.length > 1 && isActiveHand && (
                    <button
                      onClick={onNextHand}
                      className="px-2 py-1 md:px-3 md:py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs md:text-sm font-medium transition-colors"
                    >
                      Next Hand
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
