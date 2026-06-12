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

  onNextRound: () => void;

  // Keyboard focus target props
  activeKeyboardZone: 'dealer' | 'player' | 'discard';
  setActiveKeyboardZone: (zone: 'dealer' | 'player' | 'discard') => void;
  discardMode: 'add' | 'remove';
  setDiscardMode: (mode: 'add' | 'remove') => void;

  // Share props
  onExport: () => void;
  onImportClick: () => void;
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
  onNextRound,
  activeKeyboardZone,
  setActiveKeyboardZone,
  discardMode,
  setDiscardMode,
  onExport,
  onImportClick,
}) => {
  const [glowingButton, setGlowingButton] = React.useState<{ zone: string, card: Card } | null>(null);

  const renderCard = (card: Card, index: number, onRemove: () => void) => (
    <div
      key={index}
      onClick={onRemove}
      className="w-10 h-14 sm:w-12 sm:h-16 md:w-16 md:h-24 bg-white rounded shadow-md flex items-center justify-center text-lg sm:text-xl md:text-2xl font-bold text-gray-800 border-2 border-gray-300 shrink-0 cursor-pointer hover:bg-red-100 hover:border-red-400 group relative transition-all animate-card-entry"
    >
      <span className="group-hover:hidden">{card}</span>
      <span className="hidden group-hover:block text-red-600">X</span>
    </div>
  );

  const renderKeyboard = (
    onAction: (card: Card) => void,
    active: boolean,
    zone: string,
    isDisabled?: (card: Card) => boolean
  ) => (
    <div className={`flex flex-wrap justify-center gap-1 md:gap-2 mt-2 transition-opacity ${active ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
      {CARDS.map((card) => {
        const disabled = isDisabled ? isDisabled(card) : shoe[card] === 0;
        const isGlowing = glowingButton?.zone === zone && glowingButton?.card === card;
        return (
          <button
            key={card}
            onClick={() => {
              setGlowingButton({ zone, card });
              onAction(card);
              setTimeout(() => {
                setGlowingButton(null);
              }, 400);
            }}
            disabled={disabled}
            className={`w-8 h-10 sm:w-10 sm:h-12 md:w-14 md:h-16 rounded shadow-sm text-sm sm:text-base md:text-xl font-bold flex items-center justify-center transition-all active:scale-95 ${
              disabled
                ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                : isGlowing
                ? 'bg-blue-500 text-white animate-click-glow border-2 border-blue-400'
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
    <div className="flex-1 flex flex-col items-center bg-green-800 p-2 sm:p-4 overflow-y-auto w-full">

      {/* Top Actions */}
      <div className="flex justify-between items-center w-full max-w-4xl mb-4 border-b border-white/10 pb-4">
        <div className="flex gap-2">
          <button
            onClick={onExport}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-1.5 px-3 rounded-lg transition-all text-xs md:text-sm flex items-center gap-1.5 shadow-sm border border-white/10 active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            Export
          </button>
          <button
            onClick={onImportClick}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-1.5 px-3 rounded-lg transition-all text-xs md:text-sm flex items-center gap-1.5 shadow-sm border border-white/10 active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            Import
          </button>
        </div>
        <button
          onClick={onNextRound}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-lg transition-all text-xs md:text-sm shadow-md active:scale-95 cursor-pointer"
        >
          Next Round
        </button>
      </div>

      {/* Dealer Zone */}
      <div className="flex flex-col items-center mb-6 w-full">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80 flex items-center gap-2">
          Dealer
          {activeKeyboardZone === 'dealer' && (
            <span className="text-[10px] bg-blue-500 text-white font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase">Active KB</span>
          )}
        </h2>
        <div
          onClick={() => setActiveKeyboardZone('dealer')}
          className={`flex flex-col items-center p-2 rounded-xl min-w-[200px] md:min-w-[300px] transition-all cursor-pointer ${
            activeKeyboardZone === 'dealer'
              ? 'bg-blue-600/20 ring-2 md:ring-4 ring-blue-400'
              : 'bg-black/20 hover:bg-black/30'
          }`}
        >
          <div className="flex flex-wrap gap-1 md:gap-2 justify-center items-center min-h-[4.5rem] md:min-h-[7rem]">
            {dealerCards.length === 0 && <span className="text-white/30 text-sm">No cards</span>}
            {dealerCards.map((card, idx) => renderCard(card, idx, () => onRemoveDealerCard(idx)))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 w-full">
            {renderKeyboard(onAddDealerCard, activeKeyboardZone === 'dealer', 'dealer')}
          </div>
        </div>
      </div>

      {/* Discard Tray Zone */}
      <div className="flex flex-col items-center mb-6 w-full">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80 flex items-center gap-2">
          Other Players (Discard)
          {activeKeyboardZone === 'discard' && (
            <span className="text-[10px] bg-blue-500 text-white font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase">Active KB</span>
          )}
        </h2>
        <div
          onClick={() => setActiveKeyboardZone('discard')}
          className={`flex flex-col items-center p-2 rounded-xl w-full max-w-4xl transition-all cursor-pointer ${
            activeKeyboardZone === 'discard'
              ? 'bg-blue-600/20 ring-2 md:ring-4 ring-blue-400'
              : 'bg-black/20 hover:bg-black/30'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 w-full px-4 py-2 bg-black/30 rounded-lg mb-2">
            <span className="text-white font-medium text-sm md:text-lg">
              Discarded Cards: <span className="font-bold text-yellow-400 ml-2">{discardCards.length}</span>
            </span>
            <div className="flex items-center gap-4">
              {/* Add/Remove Toggle */}
              <div className="flex items-center bg-gray-700/50 rounded-lg p-0.5 border border-gray-600/30">
                <button
                  onClick={() => setDiscardMode('add')}
                  className={`px-3 py-1 text-xs md:text-sm font-bold rounded-md transition-all ${
                    discardMode === 'add'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Add
                </button>
                <button
                  onClick={() => setDiscardMode('remove')}
                  className={`px-3 py-1 text-xs md:text-sm font-bold rounded-md transition-all ${
                    discardMode === 'remove'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Remove
                </button>
              </div>

              {/* Undo Button */}
              {discardCards.length > 0 && (
                <button
                  onClick={() => onRemoveDiscardCard(discardCards.length - 1)}
                  className="text-red-400 hover:text-red-300 text-xs md:text-sm font-bold border border-red-500/30 hover:bg-red-500/10 px-3 py-1 rounded transition-colors"
                >
                  Undo Last Discard
                </button>
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-white/10 w-full">
             {renderKeyboard(
               (card) => {
                 if (discardMode === 'add') {
                   onAddDiscardCard(card);
                 } else {
                   const index = discardCards.lastIndexOf(card);
                   if (index !== -1) {
                     onRemoveDiscardCard(index);
                   }
                 }
               },
               activeKeyboardZone === 'discard',
               'discard',
               (card) => {
                 if (discardMode === 'add') {
                   return shoe[card] === 0;
                 } else {
                   return !discardCards.includes(card);
                 }
               }
             )}
          </div>
        </div>
      </div>

      {/* Player Zone */}
      <div className="flex flex-col items-center w-full mt-auto mb-4">
        <h2 className="text-sm md:text-xl font-bold text-white mb-2 tracking-wider uppercase opacity-80 flex items-center gap-2">
          Player
          {activeKeyboardZone === 'player' && (
            <span className="text-[10px] bg-blue-500 text-white font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase">Active KB</span>
          )}
        </h2>
        <div className="flex gap-2 sm:gap-4 md:gap-8 overflow-x-auto max-w-full pb-2 w-full justify-center items-start">
          {playerHands.map((hand, index) => {
            const isActiveHand = index === activeHandIndex;
            const canSplit = hand.cards.length === 2 && hand.cards[0] === hand.cards[1];

            return (
              <div
                key={index}
                onClick={() => setActiveKeyboardZone('player')}
                className={`flex flex-col items-center p-2 md:p-4 rounded-xl transition-all w-full max-w-sm shrink-0 cursor-pointer ${
                  isActiveHand
                    ? activeKeyboardZone === 'player'
                      ? 'bg-blue-600/30 ring-2 md:ring-4 ring-blue-400'
                      : 'bg-blue-600/10 ring-2 ring-blue-400/30'
                    : 'bg-black/20 hover:bg-black/30'
                }`}
              >
                <div className="flex flex-wrap gap-1 md:gap-2 mb-2 justify-center items-center min-h-[4.5rem] md:min-h-[7rem]">
                  {hand.cards.length === 0 && <span className="text-white/30 text-sm">No cards</span>}
                  {hand.cards.map((card, idx) => renderCard(card, idx, () => onRemovePlayerCard(index, idx)))}
                </div>

                <div className="w-full pt-2 border-t border-white/10 mb-2">
                   {renderKeyboard((card) => onAddPlayerCard(index, card), isActiveHand && activeKeyboardZone === 'player', `player-${index}`)}
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
