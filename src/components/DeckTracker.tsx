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
    <div className="bg-gray-900 p-4 border-t border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">Deck Tracker</h3>
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setMode('REMOVE')}
            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${
              mode === 'REMOVE' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            REMOVE (Play Card)
          </button>
          <button
            onClick={() => setMode('ADD')}
            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${
              mode === 'ADD' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            ADD (Return Card)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-13 gap-2 flex-wrap justify-center flex">
        {CARDS.map((card) => {
          const count = shoe[card];
          const isEmpty = count === 0;

          return (
            <div key={card} className="flex flex-col items-center">
              <button
                onClick={() => onCardClick(card)}
                disabled={mode === 'REMOVE' && isEmpty}
                className={`w-12 h-16 rounded shadow-sm text-xl font-bold flex items-center justify-center transition-transform active:scale-95 ${
                  mode === 'REMOVE' && isEmpty
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
              >
                {card}
              </button>
              <span className={`mt-1 text-xs font-mono font-medium ${isEmpty ? 'text-red-500' : 'text-gray-300'}`}>
                {count} left
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
