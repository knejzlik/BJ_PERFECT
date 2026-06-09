import { useState } from 'react';
import { type GameState, type GameOptions, initializeShoe, type Card } from './types';
import { Sidebar } from './components/Sidebar';
import { MainTable } from './components/MainTable';
import { ActionAdvisor } from './components/ActionAdvisor';
import { type BestMoveResult, type SideBetsEV } from './engine/blackjackEngine';
import { useEffect, useRef } from 'react';

import { getBetSuggestion } from './engine/blackjackEngine';

const DEFAULT_OPTIONS: GameOptions = {
  decks: 6,
  standOnSoft17: true, // S17
  doubleAfterSplit: true, // DAS
  surrenderAllowed: true,
  blackjackPayout: 1.5, // 3:2
  minBet: 10,
  balance: 1000,
  countingSystem: 'Hi-Lo',
};

const INITIAL_STATE: GameState = {
  dealerCards: [],
  playerHands: [{ cards: [], bet: 1, isSplitHand: false }],
  discardCards: [],
  activeHandIndex: 0,
  shoe: initializeShoe(DEFAULT_OPTIONS.decks),
  options: DEFAULT_OPTIONS,
};

function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);

  // UI State
  const [bestMove, setBestMove] = useState<BestMoveResult | null>(null);
  const [sideBetsEV, setSideBetsEV] = useState<SideBetsEV | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker/blackjack.worker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (event) => {
      const { type, result, sideBets } = event.data;
      if (type === 'bestMove') {
        setBestMove(result);
        setIsCalculating(false);
      } else if (type === 'sideBets') {
        setSideBetsEV(sideBets);
        setIsCalculating(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    const dealerUpcard = gameState.dealerCards[0];
    const activeHand = gameState.playerHands[gameState.activeHandIndex];
    const isTableEmpty = gameState.dealerCards.length === 0 && activeHand.cards.length === 0;

    if (dealerUpcard && activeHand && activeHand.cards.length >= 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCalculating(true);
      workerRef.current?.postMessage({
        type: 'bestMove',
        playerHand: activeHand.cards,
        dealerUpcard,
        shoe: gameState.shoe,
        options: gameState.options,
      });
    } else if (isTableEmpty) {
      setBestMove(null);
      setIsCalculating(true);
      workerRef.current?.postMessage({
        type: 'sideBets',
        shoe: gameState.shoe,
        options: gameState.options,
      });
    } else {
      setBestMove(null);
      setSideBetsEV(null);
      setIsCalculating(false);
    }
  }, [
    gameState.dealerCards,
    gameState.playerHands,
    gameState.activeHandIndex,
    gameState.shoe,
    gameState.options
  ]);

  const handleOptionsChange = (newOptionsOrUpdater: React.SetStateAction<GameOptions>) => {
    setGameState(prev => {
      const newOptions = typeof newOptionsOrUpdater === 'function' ? newOptionsOrUpdater(prev.options) : newOptionsOrUpdater;

      // If decks changed, reset the shoe and table
      if (newOptions.decks !== prev.options.decks) {
        return {
          ...INITIAL_STATE,
          options: newOptions,
          shoe: initializeShoe(newOptions.decks),
        };
      }

      return { ...prev, options: newOptions };
    });
  };

  const resetShoe = () => {
    setGameState(prev => ({
      ...INITIAL_STATE,
      options: prev.options,
      shoe: initializeShoe(prev.options.decks),
    }));
  };

  const handleAddDealerCard = (card: Card) => {
    setGameState(prev => {
      if (prev.shoe[card] <= 0) return prev;
      return {
        ...prev,
        shoe: { ...prev.shoe, [card]: prev.shoe[card] - 1 },
        dealerCards: [...prev.dealerCards, card]
      };
    });
  };

  const handleRemoveDealerCard = (index: number) => {
    setGameState(prev => {
      const card = prev.dealerCards[index];
      const newDealerCards = [...prev.dealerCards];
      newDealerCards.splice(index, 1);
      return {
        ...prev,
        shoe: { ...prev.shoe, [card]: prev.shoe[card] + 1 },
        dealerCards: newDealerCards
      };
    });
  };

  const handleAddDiscardCard = (card: Card) => {
    setGameState(prev => {
      if (prev.shoe[card] <= 0) return prev;
      return {
        ...prev,
        shoe: { ...prev.shoe, [card]: prev.shoe[card] - 1 },
        discardCards: [...prev.discardCards, card]
      };
    });
  };

  const handleRemoveDiscardCard = (index: number) => {
    setGameState(prev => {
      const card = prev.discardCards[index];
      const newDiscardCards = [...prev.discardCards];
      newDiscardCards.splice(index, 1);
      return {
        ...prev,
        shoe: { ...prev.shoe, [card]: prev.shoe[card] + 1 },
        discardCards: newDiscardCards
      };
    });
  };

  const handleAddPlayerCard = (handIndex: number, card: Card) => {
    setGameState(prev => {
      if (prev.shoe[card] <= 0) return prev;
      const newHands = [...prev.playerHands];
      newHands[handIndex] = {
        ...newHands[handIndex],
        cards: [...newHands[handIndex].cards, card]
      };
      return {
        ...prev,
        shoe: { ...prev.shoe, [card]: prev.shoe[card] - 1 },
        playerHands: newHands,
        activeHandIndex: handIndex
      };
    });
  };

  const handleRemovePlayerCard = (handIndex: number, cardIndex: number) => {
    setGameState(prev => {
      const card = prev.playerHands[handIndex].cards[cardIndex];
      const newHands = [...prev.playerHands];
      const newCards = [...newHands[handIndex].cards];
      newCards.splice(cardIndex, 1);
      newHands[handIndex] = { ...newHands[handIndex], cards: newCards };
      return {
        ...prev,
        shoe: { ...prev.shoe, [card]: prev.shoe[card] + 1 },
        playerHands: newHands
      };
    });
  };

  const handleNextRound = () => {
    setGameState(prev => {
      // Move all cards from table into discard pile implicitly (they just stay in the discard pile logically, but let's visually clear them)
      // Actually, standard is discard pile grows. So let's push all current cards to discardCards.
      const allPlayerCards = prev.playerHands.flatMap(h => h.cards);
      return {
        ...prev,
        dealerCards: [],
        playerHands: [{ cards: [], bet: 1, isSplitHand: false }],
        discardCards: [...prev.discardCards, ...prev.dealerCards, ...allPlayerCards],
        activeHandIndex: 0
      };
    });
  };

  const handleClearTable = () => {
    setGameState(prev => {
      // Return ALL cards (dealer, player, discard) to the shoe
      const allPlayerCards = prev.playerHands.flatMap(h => h.cards);
      const allCards = [...prev.dealerCards, ...allPlayerCards, ...prev.discardCards];

      const newShoe = { ...prev.shoe };
      allCards.forEach(c => newShoe[c]++);

      return {
        ...prev,
        dealerCards: [],
        playerHands: [{ cards: [], bet: 1, isSplitHand: false }],
        discardCards: [],
        activeHandIndex: 0,
        shoe: newShoe
      };
    });
  };

  const handleSplit = (handIndex: number) => {
    setGameState((prev) => {
      const hands = [...prev.playerHands];
      const handToSplit = hands[handIndex];

      if (handToSplit.cards.length !== 2 || handToSplit.cards[0] !== handToSplit.cards[1]) {
        return prev;
      }

      const card1 = handToSplit.cards[0];
      const card2 = handToSplit.cards[1];

      hands.splice(handIndex, 1,
        { cards: [card1], bet: handToSplit.bet, isSplitHand: true },
        { cards: [card2], bet: handToSplit.bet, isSplitHand: true }
      );

      return {
        ...prev,
        playerHands: hands,
        activeHandIndex: handIndex, // First split hand is active
      };
    });
  };

  const handleNextHand = () => {
    setGameState((prev) => {
      const nextIndex = (prev.activeHandIndex + 1) % prev.playerHands.length;
      return { ...prev, activeHandIndex: nextIndex };
    });
  };


  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-900 font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between bg-gray-800 p-4 border-b border-gray-700 shrink-0">
        <h1 className="text-white font-bold text-lg">BJ Strategist</h1>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="text-gray-300 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
      </div>

      <Sidebar
        options={gameState.options}
        setOptions={handleOptionsChange}
        onResetShoe={resetShoe}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex flex-col xl:flex-row overflow-hidden relative">

          {/* Main Table Area */}
          <div className="flex-1 flex flex-col relative overflow-hidden">
            <MainTable
              shoe={gameState.shoe}
              dealerCards={gameState.dealerCards}
              playerHands={gameState.playerHands}
              discardCards={gameState.discardCards}
              activeHandIndex={gameState.activeHandIndex}
              onSplit={handleSplit}
              onNextHand={handleNextHand}
              onAddDealerCard={handleAddDealerCard}
              onRemoveDealerCard={handleRemoveDealerCard}
              onAddDiscardCard={handleAddDiscardCard}
              onRemoveDiscardCard={handleRemoveDiscardCard}
              onAddPlayerCard={handleAddPlayerCard}
              onRemovePlayerCard={handleRemovePlayerCard}
              onClearTable={handleClearTable}
              onNextRound={handleNextRound}
            />

            {/* Insurance Detector */}
            {gameState.dealerCards.length > 0 && gameState.dealerCards[0] === 'A' && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-sm">
                <div className="bg-blue-900/90 border-2 border-blue-400 p-2 sm:p-4 rounded-xl shadow-2xl flex flex-col items-center backdrop-blur-sm">
                  <h3 className="text-white font-bold text-base sm:text-lg mb-1 uppercase tracking-widest">Pojištění</h3>
                  {(() => {
                    const tensCount = gameState.shoe['T'] + gameState.shoe['J'] + gameState.shoe['Q'] + gameState.shoe['K'];
                    const totalCards = Object.values(gameState.shoe).reduce((a, b) => a + b, 0);
                    const prob = totalCards > 0 ? tensCount / totalCards : 0;
                    // Insurance pays 2:1. EV = (prob * 2) - ((1 - prob) * 1)
                    const ev = prob * 2 - (1 - prob);

                    return (
                      <div className="text-center">
                        <p className="text-blue-200 text-xs sm:text-sm mb-2">
                          Tens ratio: {(prob * 100).toFixed(1)}% | EV: {ev > 0 ? '+' : ''}{ev.toFixed(3)}
                        </p>
                        {ev > 0 ? (
                          <div className="bg-green-500 text-black font-black px-2 py-1 sm:px-4 sm:py-2 rounded uppercase animate-pulse text-sm sm:text-base">
                            Zkoupit pojištění
                          </div>
                        ) : (
                          <div className="bg-red-500/80 text-white font-bold px-2 py-1 sm:px-4 sm:py-2 rounded uppercase text-sm sm:text-base">
                            Nekupovat
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Action Advisor Area (Side on Desktop, Bottom in Scroll on Mobile/Tablet) */}
          <div className="xl:w-80 bg-gray-800 border-t xl:border-t-0 xl:border-l border-gray-700 shadow-xl shrink-0">
             <ActionAdvisor
               bestMove={bestMove}
               sideBetsEV={sideBetsEV}
               betSuggestion={getBetSuggestion(gameState.shoe, gameState.options)}
               isLoading={isCalculating}
             />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;