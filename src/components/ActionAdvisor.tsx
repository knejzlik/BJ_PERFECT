import React from 'react';
import { type BestMoveResult, type BetSuggestion, type SideBetsEV } from '../engine/blackjackEngine';

interface ActionAdvisorProps {
  bestMove: BestMoveResult | null;
  sideBetsEV: SideBetsEV | null;
  betSuggestion: BetSuggestion | null;
  isLoading?: boolean;
}

export const ActionAdvisor: React.FC<ActionAdvisorProps> = ({ bestMove, sideBetsEV, betSuggestion, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <p className="text-lg">Počítám optimální strategii...</p>
      </div>
    );
  }

  const content = () => {
    if (!bestMove) {
      return (
        <div className="flex-1 flex flex-col">
          {sideBetsEV && (
            <div className="mb-4 flex-1">
              <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3 uppercase tracking-wider">Side Bets EV</p>
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm sm:text-base">
                  <tbody>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3 sm:py-3 sm:px-4 font-medium">Perfect Pairs</td>
                      <td className="py-2 px-3 sm:py-3 sm:px-4 text-right font-mono">
                        {sideBetsEV.perfectPairs !== null ? (
                          <span className={sideBetsEV.perfectPairs > 0 ? 'text-green-400' : 'text-red-400'}>
                            {sideBetsEV.perfectPairs > 0 ? '+' : ''}{sideBetsEV.perfectPairs.toFixed(4)}
                          </span>
                        ) : <span className="text-gray-500">N/A</span>}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3 sm:py-3 sm:px-4 font-medium">21+3</td>
                      <td className="py-2 px-3 sm:py-3 sm:px-4 text-right font-mono">
                        {sideBetsEV.twentyOnePlusThree !== null ? (
                          <span className={sideBetsEV.twentyOnePlusThree > 0 ? 'text-green-400' : 'text-red-400'}>
                            {sideBetsEV.twentyOnePlusThree > 0 ? '+' : ''}{sideBetsEV.twentyOnePlusThree.toFixed(4)}
                          </span>
                        ) : <span className="text-gray-500">N/A</span>}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3 sm:py-3 sm:px-4 font-medium">Hot 3</td>
                      <td className="py-2 px-3 sm:py-3 sm:px-4 text-right font-mono">
                        {sideBetsEV.hot3 !== null ? (
                          <span className={sideBetsEV.hot3 > 0 ? 'text-green-400' : 'text-red-400'}>
                            {sideBetsEV.hot3 > 0 ? '+' : ''}{sideBetsEV.hot3.toFixed(4)}
                          </span>
                        ) : <span className="text-gray-500">N/A</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 sm:py-3 sm:px-4 font-medium">Bust It</td>
                      <td className="py-2 px-3 sm:py-3 sm:px-4 text-right font-mono">
                        {sideBetsEV.bustIt !== null ? (
                          <span className={sideBetsEV.bustIt > 0 ? 'text-green-400' : 'text-red-400'}>
                            {sideBetsEV.bustIt > 0 ? '+' : ''}{sideBetsEV.bustIt.toFixed(4)}
                          </span>
                        ) : <span className="text-gray-500">N/A</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="p-6 flex flex-col items-center justify-center text-gray-400 text-center flex-1">
            <p>Enter dealer and player cards to see the optimal playing strategy.</p>
          </div>
        </div>
      );
    }

    const { bestAction, bestEV, actionEVs } = bestMove;

    return (
      <>
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
      </>
    );
  };

  const actionColors: Record<string, string> = {
    Hit: 'bg-green-500',
    Stand: 'bg-red-500',
    Double: 'bg-blue-500',
    Split: 'bg-purple-500',
    Surrender: 'bg-yellow-600',
  };

  return (
    <div className="p-4 sm:p-6 text-white h-full flex flex-col lg:overflow-y-auto">
      <h2 className="text-xl sm:text-2xl font-bold border-b border-gray-600 pb-2 mb-4">Action Advisor</h2>

      {betSuggestion && (
        <div className="mb-6 bg-gray-800 border border-blue-500/30 rounded-lg p-4 shadow-inner">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Running Count:</span>
            <span className="font-mono text-white">{betSuggestion.runningCount > 0 ? '+' : ''}{betSuggestion.runningCount}</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-400">True Count:</span>
            <span className="font-mono text-white">{betSuggestion.trueCount > 0 ? '+' : ''}{betSuggestion.trueCount}</span>
          </div>
          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Suggested Bet</p>
            <div className="text-2xl font-black text-green-400">
              ${betSuggestion.suggestedBet}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col xl:block">
        {content()}
      </div>
    </div>
  );
};
