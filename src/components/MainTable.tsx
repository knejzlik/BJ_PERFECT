import React from 'react';
import { type Card, type Hand, type Shoe } from '../types';

interface MainTableProps {
  shoe: Shoe;
  dealerCards: Card[];
  playerHands: Hand[];
  discardCards: Card[];
  activeHandIndex: number;
  onSplit?: (handIndex: number) => void;
  onNextHand?: () => void;

  onAddDealerCard: (card: Card) => void;
  onRemoveDealerCard: (index: number) => void;

  onAddDiscardCard: (card: Card) => void;
  onRemoveDiscardCard: (index: number) => void;

  onAddPlayerCard: (handIndex: number, card: Card) => void;
  onRemovePlayerCard: (handIndex: number, cardIndex: number) => void;

  onClearTable: () => void;
  onNextRound: () => void;
}

const CARDS: Card[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const MainTable: React.FC<MainTableProps> = ({
  shoe,
  dealerCards,
  playerHands,
  discardCards,
  activeHandIndex,
  onSplit,
  onNextHand,
  onAddDealerCard,
  onRemoveDealerCard,
  onAddDiscardCard,
  onRemoveDiscardCard,
  onAddPlayerCard,
  onRemovePlayerCard,
  onClearTable,
  onNextRound,
}) => {

  const renderCard = (card: Card, index: number, onRemove: () => void) => (
    <div
      key={index}
      onClick={onRemove}
      className="w-10 h-14 sm:w-12 sm:h-16 md:w-16 md:h-24 bg-white rounded shadow-md flex items-center justify-center text-lg sm:text-xl md:text-2xl font-bold text-gray-800 border-2 border-gray-300 shrink-0 cursor-pointer hover:bg-red-100 hover:border-red-400 group relative transition-colors"
    >
      <span className="group-hover:hidden">{card}</span>
      <span className="hidden group-hover:block text-red-600">X</span>
    </div>
  );

  const renderKeyboard = (onAdd: (card: Card) => void, active: boolean) => (
    <div className={`flex flex-wrap justify-center gap-1 mt-2 transition-opacity ${active ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
      {CARDS.map((card) => {
        const count = shoe[card];
        const isEmpty = count === 0;
        return (
          <button
            key={card}
            onClick={() => onAdd(card)}
            disabled={isEmpty}
            className={`w-8 h-10 sm:w-10 sm:h-12 rounded shadow-sm text-sm sm:text-base font-bold flex items-center justify-center transition-transform active:scale-95 ${
              isEmpty
                ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                : 'bg-white/90 text-gray-900 hover:bg-white'
            }`}
          >
            {card}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center bg-green-800 p-2 sm:p-4 overflow-y-auto">

      {/* Top Actions */}
      <div className="flex gap-4 w-full justify-end mb-4">
        <button
          onClick={onNextRound}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
        >
          Next Round
        </button>
        <button
          onClick={onClearTable}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
        >
          Clear Table
        </button>
      </div>

      {/* Dealer Zone */}
      <div className="flex flex-col items-center mb-6 w-full">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80">Dealer</h2>
        <div className="flex flex-col items-center p-2 bg-black/20 rounded-xl min-w-[200px] md:min-w-[300px]">
          <div className="flex flex-wrap gap-1 md:gap-2 justify-center items-center min-h-[4.5rem] md:min-h-[7rem]">
            {dealerCards.length === 0 && <span className="text-white/30 text-sm">No cards</span>}
            {dealerCards.map((card, idx) => renderCard(card, idx, () => onRemoveDealerCard(idx)))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 w-full">
            {renderKeyboard(onAddDealerCard, true)}
          </div>
        </div>
      </div>

      {/* Discard Tray Zone */}
      <div className="flex flex-col items-center mb-6 w-full">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80">Other Players (Discard)</h2>
        <div className="flex flex-col items-center p-2 bg-black/20 rounded-xl w-full max-w-4xl">
          <div className="flex flex-wrap gap-1 md:gap-2 justify-center items-center min-h-[4.5rem] md:min-h-[7rem]">
            {discardCards.length === 0 && <span className="text-white/30 text-sm">No cards</span>}
            {discardCards.map((card, idx) => renderCard(card, idx, () => onRemoveDiscardCard(idx)))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 w-full">
             {renderKeyboard(onAddDiscardCard, true)}
          </div>
        </div>
      </div>

      {/* Player Zone */}
      <div className="flex flex-col items-center w-full mt-auto mb-4">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80">Player</h2>
        <div className="flex gap-2 sm:gap-4 md:gap-8 overflow-x-auto max-w-full pb-2 w-full justify-center items-start">
          {playerHands.map((hand, index) => {
            const isActiveHand = index === activeHandIndex;
            const canSplit = hand.cards.length === 2 && hand.cards[0] === hand.cards[1];

            return (
              <div
                key={index}
                className={`flex flex-col items-center p-2 md:p-4 rounded-xl transition-all w-full max-w-sm shrink-0 ${
                  isActiveHand ? 'bg-blue-600/30 ring-2 md:ring-4 ring-blue-400' : 'bg-black/20'
                }`}
              >
                <div className="flex flex-wrap gap-1 md:gap-2 mb-2 justify-center items-center min-h-[4.5rem] md:min-h-[7rem]">
                  {hand.cards.length === 0 && <span className="text-white/30 text-sm">No cards</span>}
                  {hand.cards.map((card, idx) => renderCard(card, idx, () => onRemovePlayerCard(index, idx)))}
                </div>

                <div className="w-full pt-2 border-t border-white/10 mb-2">
                   {renderKeyboard((card) => onAddPlayerCard(index, card), isActiveHand)}
                </div>

                <div className="flex gap-2 mt-auto pt-2">
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
