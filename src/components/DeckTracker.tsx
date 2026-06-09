import React from 'react';
import { type Card, type Shoe } from '../types';

interface DeckTrackerProps {
  shoe: Shoe;
  mode: 'REMOVE' | 'ADD';
  setMode: (mode: 'REMOVE' | 'ADD') => void;
  onCardClick: (card: Card) => void;
}

const CARDS: Card[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const DeckTracker: React.FC<DeckTrackerProps> = ({ shoe, mode, setMode, onCardClick }) => {
  return (
    <div className="bg-gray-900 p-2 sm:p-4 border-t border-gray-700">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-2 sm:mb-4 gap-2">
        <h3 className="text-white font-bold text-base sm:text-lg hidden sm:block">Deck Tracker</h3>
        <div className="flex bg-gray-800 rounded-lg p-1 w-full sm:w-auto overflow-x-auto justify-center">
          <button
            onClick={() => setMode('REMOVE')}
            className={`px-2 py-1 sm:px-4 sm:py-1 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              mode === 'REMOVE' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            REMOVE (Play Card)
          </button>
          <button
            onClick={() => setMode('ADD')}
            className={`px-2 py-1 sm:px-4 sm:py-1 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              mode === 'ADD' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            ADD (Return Card)
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-2 gap-1 sm:gap-2 justify-start md:justify-center w-full">
        {CARDS.map((card) => {
          const count = shoe[card];
          const isEmpty = count === 0;

          return (
            <div key={card} className="flex flex-col items-center min-w-max">
              <button
                onClick={() => onCardClick(card)}
                disabled={mode === 'REMOVE' && isEmpty}
                className={`w-10 h-14 sm:w-12 sm:h-16 rounded shadow-sm text-lg sm:text-xl font-bold flex items-center justify-center transition-transform active:scale-95 ${
                  mode === 'REMOVE' && isEmpty
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
              >
                {card}
              </button>
              <span className={`mt-1 text-[10px] sm:text-xs font-mono font-medium ${isEmpty ? 'text-red-500' : 'text-gray-300'}`}>
                {count} left
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
