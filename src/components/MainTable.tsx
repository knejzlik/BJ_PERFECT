import React from 'react';
import { type Card, type Hand } from '../types';

interface MainTableProps {
  dealerCards: Card[];
  playerHands: Hand[];
  activeHandIndex: number;
  activeSlot: { type: 'dealer' | 'player', handIndex?: number } | null;
  setActiveSlot: (slot: { type: 'dealer' | 'player', handIndex?: number }) => void;
  onSplit?: (handIndex: number) => void;
  onNextHand?: () => void;
}

export const MainTable: React.FC<MainTableProps> = ({
  dealerCards,
  playerHands,
  activeHandIndex,
  activeSlot,
  setActiveSlot,
  onSplit,
  onNextHand,
}) => {

  const renderCard = (card: Card, index: number, _isDealer: boolean) => (
    <div key={index} className="w-16 h-24 bg-white rounded-lg shadow-md flex items-center justify-center text-2xl font-bold text-gray-800 border-2 border-gray-300">
      {card}
    </div>
  );

  const renderEmptySlot = (type: 'dealer' | 'player', handIndex?: number) => {
    const isActive = activeSlot?.type === type && activeSlot?.handIndex === handIndex;
    return (
      <div
        onClick={() => setActiveSlot({ type, handIndex })}
        className={`w-16 h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
          isActive ? 'border-yellow-400 bg-yellow-50' : 'border-gray-400 hover:border-gray-200 hover:bg-white/10'
        }`}
      >
        <span className={isActive ? 'text-yellow-600 font-bold' : 'text-gray-400'}>+</span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-green-800 p-8">
      {/* Dealer Zone */}
      <div className="flex flex-col items-center mb-16 w-full">
        <h2 className="text-xl font-bold text-white mb-4 tracking-wider uppercase opacity-80">Dealer</h2>
        <div className="flex gap-2 p-4 bg-black/20 rounded-xl min-w-[200px] justify-center items-center">
          {dealerCards.map((card, idx) => renderCard(card, idx, true))}
          {renderEmptySlot('dealer')}
        </div>
      </div>

      {/* Player Zone */}
      <div className="flex flex-col items-center w-full">
        <h2 className="text-xl font-bold text-white mb-4 tracking-wider uppercase opacity-80">Player</h2>
        <div className="flex gap-8 overflow-x-auto max-w-full pb-4">
          {playerHands.map((hand, index) => {
            const isActiveHand = index === activeHandIndex;
            const canSplit = hand.cards.length === 2 && hand.cards[0] === hand.cards[1];

            return (
              <div
                key={index}
                className={`flex flex-col items-center p-4 rounded-xl transition-all ${
                  isActiveHand ? 'bg-blue-600/30 ring-4 ring-blue-400' : 'bg-black/20'
                }`}
              >
                <div className="flex gap-2 mb-4 min-h-[6rem] items-center">
                  {hand.cards.map((card, idx) => renderCard(card, idx, false))}
                  {renderEmptySlot('player', index)}
                </div>

                <div className="flex gap-2 mt-auto">
                  {onSplit && canSplit && (
                    <button
                      onClick={() => onSplit(index)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium transition-colors"
                    >
                      Split
                    </button>
                  )}
                  {onNextHand && playerHands.length > 1 && isActiveHand && (
                    <button
                      onClick={onNextHand}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium transition-colors"
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
