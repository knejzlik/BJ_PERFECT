import React from 'react';
import { type GameOptions } from '../types';

interface SidebarProps {
  options: GameOptions;
  setOptions: React.Dispatch<React.SetStateAction<GameOptions>>;
  onResetShoe?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ options, setOptions, onResetShoe }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    let parsedValue: any = value;
    if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'decks') {
      parsedValue = parseInt(value, 10);
    } else if (name === 'blackjackPayout') {
      parsedValue = parseFloat(value);
    }

    setOptions((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  return (
    <div className="w-64 bg-gray-800 text-white p-4 h-full flex flex-col gap-4">
      <h2 className="text-xl font-bold border-b border-gray-600 pb-2">Table Options</h2>

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

      {onResetShoe && (
        <button
          onClick={onResetShoe}
          className="mt-auto bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Reset Shoe
        </button>
      )}
    </div>
  );
};
