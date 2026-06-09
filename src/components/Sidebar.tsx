import React from 'react';
import { type GameOptions } from '../types';

interface SidebarProps {
  options: GameOptions;
  setOptions: React.Dispatch<React.SetStateAction<GameOptions>>;
  onResetShoe?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ options, setOptions, onResetShoe, isOpen, onClose }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    let parsedValue: string | number | boolean = value;
    if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'decks' || name === 'minBet' || name === 'balance') {
      parsedValue = parseInt(value, 10) || 0;
    } else if (name === 'blackjackPayout') {
      parsedValue = parseFloat(value);
    } else if (name === 'countingSystem') {
      parsedValue = value;
    }

    setOptions((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={`fixed lg:static top-0 left-0 h-full bg-gray-800 text-white p-4 flex flex-col gap-4 z-30 transition-transform duration-300 w-64 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex items-center justify-between border-b border-gray-600 pb-2">
          <h2 className="text-xl font-bold">Table Options</h2>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Decks (1-8)</label>
            <select
              name="decks"
              value={options.decks}
              onChange={handleChange}
              className="bg-gray-700 text-white p-2 rounded"
            >
              {[1, 2, 3, 4, 5, 6, 8].map((d) => (
                <option key={d} value={d}>
                  {d} Deck{d > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Stand on Soft 17</label>
            <input
              type="checkbox"
              name="standOnSoft17"
              checked={options.standOnSoft17}
              onChange={handleChange}
              className="w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Double After Split (DAS)</label>
            <input
              type="checkbox"
              name="doubleAfterSplit"
              checked={options.doubleAfterSplit}
              onChange={handleChange}
              className="w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Surrender Allowed</label>
            <input
              type="checkbox"
              name="surrenderAllowed"
              checked={options.surrenderAllowed}
              onChange={handleChange}
              className="w-4 h-4"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Blackjack Payout</label>
            <select
              name="blackjackPayout"
              value={options.blackjackPayout}
              onChange={handleChange}
              className="bg-gray-700 text-white p-2 rounded"
            >
              <option value={1.5}>3:2 (1.5x)</option>
              <option value={1.2}>6:5 (1.2x)</option>
              <option value={1.0}>1:1 (1.0x)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-600 pt-4 mt-2">
            <label className="text-sm font-medium text-blue-300">Bankroll & Betting</label>
            <div className="flex flex-col gap-1 mb-2">
              <label className="text-xs text-gray-400">Counting System</label>
              <select
                name="countingSystem"
                value={options.countingSystem}
                onChange={handleChange}
                className="bg-gray-700 text-white p-2 rounded w-full"
              >
                <option value="Hi-Lo">Hi-Lo (Standard)</option>
                <option value="Wong Halves">Wong Halves (High Precision)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Balance</label>
              <input
                type="number"
                name="balance"
                value={options.balance}
                onChange={handleChange}
                className="bg-gray-700 text-white p-2 rounded w-full"
                min="0"
                step="10"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Min Bet</label>
              <input
                type="number"
                name="minBet"
                value={options.minBet}
                onChange={handleChange}
                className="bg-gray-700 text-white p-2 rounded w-full"
                min="1"
                step="1"
              />
            </div>
          </div>
        </div>

        {onResetShoe && (
          <button
            onClick={onResetShoe}
            className="mt-auto bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Reset Shoe
          </button>
        )}
      </div>
    </>
  );
};
