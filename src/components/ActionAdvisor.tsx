import React from 'react';
import { type BestMoveResult } from '../engine/blackjackEngine';

interface ActionAdvisorProps {
  bestMove: BestMoveResult | null;
  isLoading?: boolean;
}

export const ActionAdvisor: React.FC<ActionAdvisorProps> = ({ bestMove, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <p className="text-lg">Počítám optimální strategii...</p>
      </div>
    );
  }

  if (!bestMove) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-gray-400 text-center">
        <p>Enter dealer and player cards to see the optimal strategy.</p>
      </div>
    );
  }

  const { bestAction, bestEV, actionEVs } = bestMove;

  const actionColors: Record<string, string> = {
    Hit: 'bg-green-500',
    Stand: 'bg-red-500',
    Double: 'bg-blue-500',
    Split: 'bg-purple-500',
    Surrender: 'bg-yellow-600',
  };

  return (
    <div className="p-4 sm:p-6 text-white h-full flex flex-col lg:overflow-y-auto">
      <h2 className="text-xl sm:text-2xl font-bold border-b border-gray-600 pb-2 mb-4 sm:mb-6">Action Advisor</h2>

      <div className="flex-1 flex flex-col xl:block">
        <div className="mb-6 sm:mb-8 text-center shrink-0">
          <p className="text-xs sm:text-sm text-gray-400 mb-2 uppercase tracking-wider">Recommended Action</p>
          <div className={`${actionColors[bestAction] || 'bg-gray-500'} text-3xl sm:text-4xl font-black py-4 sm:py-6 rounded-xl shadow-lg uppercase tracking-widest`}>
            {bestAction}
          </div>
          <p className="mt-2 sm:mt-3 text-base sm:text-lg font-mono">
            EV: <span className={bestEV > 0 ? 'text-green-400' : bestEV < 0 ? 'text-red-400' : 'text-gray-300'}>
              {bestEV > 0 ? '+' : ''}{bestEV.toFixed(4)}
            </span>
          </p>
        </div>

        <div className="flex-1">
          <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3 uppercase tracking-wider">All Options</p>
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm sm:text-base">
              <tbody>
                {Object.entries(actionEVs).map(([action, ev]) => {
                  if (ev === null) return null;
                  const isBest = action === bestAction;
                  return (
                    <tr key={action} className={`border-b border-gray-800 last:border-0 ${isBest ? 'bg-white/5' : ''}`}>
                      <td className="py-2 px-3 sm:py-3 sm:px-4 font-medium">
                        {action}
                        {isBest && <span className="ml-2 text-[10px] sm:text-xs bg-yellow-500 text-black px-1.5 sm:px-2 py-0.5 rounded-full font-bold">BEST</span>}
                      </td>
                      <td className="py-2 px-3 sm:py-3 sm:px-4 text-right font-mono">
                        <span className={ev > 0 ? 'text-green-400' : ev < 0 ? 'text-red-400' : 'text-gray-300'}>
                          {ev > 0 ? '+' : ''}{ev.toFixed(4)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
