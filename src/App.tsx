import { useState } from 'react';
import { type GameState, type GameOptions, initializeShoe, type Card } from './types';
import { Sidebar } from './components/Sidebar';
import { MainTable } from './components/MainTable';
import { DeckTracker } from './components/DeckTracker';
import { ActionAdvisor } from './components/ActionAdvisor';
import { type BestMoveResult } from './engine/blackjackEngine';
import { useEffect, useRef } from 'react';

const DEFAULT_OPTIONS: GameOptions = {
  decks: 6,
  standOnSoft17: true, // S17
  doubleAfterSplit: true, // DAS
  surrenderAllowed: true,
  blackjackPayout: 1.5, // 3:2
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
  const [trackerMode, setTrackerMode] = useState<'REMOVE' | 'ADD'>('REMOVE');
  const [activeSlot, setActiveSlot] = useState<{ type: 'dealer' | 'player' | 'discard', handIndex?: number } | null>({ type: 'player', handIndex: 0 });
  const [bestMove, setBestMove] = useState<BestMoveResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker/blackjack.worker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (event) => {
      setBestMove(event.data.result);
      setIsCalculating(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    const dealerUpcard = gameState.dealerCards[0];
    const activeHand = gameState.playerHands[gameState.activeHandIndex];

    if (dealerUpcard && activeHand && activeHand.cards.length >= 2) {
      setIsCalculating(true);
      workerRef.current?.postMessage({
        playerHand: activeHand.cards,
        dealerUpcard,
        shoe: gameState.shoe,
        options: gameState.options,
      });
    } else {
      setBestMove(null);
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
    setActiveSlot({ type: 'player', handIndex: 0 });
  };

  const handleCardClick = (card: Card) => {
    setGameState((prev) => {
      const newState = { ...prev };
      const newShoe = { ...prev.shoe };

      if (trackerMode === 'REMOVE') {
        if (!activeSlot) return prev;
        if (newShoe[card] <= 0) return prev; // Cannot remove if 0

        newShoe[card]--;

        if (activeSlot.type === 'dealer') {
          newState.dealerCards = [...prev.dealerCards, card];
        } else if (activeSlot.type === 'player' && activeSlot.handIndex !== undefined) {
          const newHands = [...prev.playerHands];
          newHands[activeSlot.handIndex] = {
            ...newHands[activeSlot.handIndex],
            cards: [...newHands[activeSlot.handIndex].cards, card],
          };
          newState.playerHands = newHands;
        } else if (activeSlot.type === 'discard') {
          newState.discardCards = [...prev.discardCards, card];
        }
      } else if (trackerMode === 'ADD') {
        // Find if this card is on the table, and remove it, putting it back in shoe
        // This is a bit tricky: do we just add to shoe, or remove from table?
        // The spec says: "Pokud je aktivní mód ADD, kliknutí na kartu v trackeru ji vrátí do balíčku a smaže ji ze stolu."
        // We need to figure out WHERE to remove it from.
        // Let's remove from the active slot if it exists there, or just the last occurrence.

        let removedFromTable = false;

        if (activeSlot?.type === 'dealer') {
           const idx = newState.dealerCards.lastIndexOf(card);
           if (idx !== -1) {
             newState.dealerCards = [...newState.dealerCards];
             newState.dealerCards.splice(idx, 1);
             removedFromTable = true;
           }
        } else if (activeSlot?.type === 'player' && activeSlot.handIndex !== undefined) {
           const handCards = newState.playerHands[activeSlot.handIndex].cards;
           const idx = handCards.lastIndexOf(card);
           if (idx !== -1) {
             const newHands = [...newState.playerHands];
             const newCards = [...handCards];
             newCards.splice(idx, 1);
             newHands[activeSlot.handIndex] = { ...newHands[activeSlot.handIndex], cards: newCards };
             newState.playerHands = newHands;
             removedFromTable = true;
           }
        } else if (activeSlot?.type === 'discard') {
           const idx = newState.discardCards.lastIndexOf(card);
           if (idx !== -1) {
             newState.discardCards = [...newState.discardCards];
             newState.discardCards.splice(idx, 1);
             removedFromTable = true;
           }
        }

        // If we didn't remove from active slot, try to find any occurrence starting from discard, then dealer, then player hands.
        if (!removedFromTable) {
           const discardIdx = newState.discardCards.lastIndexOf(card);
           if (discardIdx !== -1) {
             newState.discardCards = [...newState.discardCards];
             newState.discardCards.splice(discardIdx, 1);
             removedFromTable = true;
           } else {
             const dealerIdx = newState.dealerCards.lastIndexOf(card);
             if (dealerIdx !== -1) {
               newState.dealerCards = [...newState.dealerCards];
               newState.dealerCards.splice(dealerIdx, 1);
               removedFromTable = true;
             } else {
               for (let i = newState.playerHands.length - 1; i >= 0; i--) {
                  const hCards = newState.playerHands[i].cards;
                  const hIdx = hCards.lastIndexOf(card);
                  if (hIdx !== -1) {
                    const newHands = [...newState.playerHands];
                    const newCards = [...hCards];
                    newCards.splice(hIdx, 1);
                    newHands[i] = { ...newHands[i], cards: newCards };
                    newState.playerHands = newHands;
                    removedFromTable = true;
                    break;
                  }
               }
             }
           }
        }

        if (removedFromTable) {
            newShoe[card]++;
        } else {
            // Cannot remove from table as it's not there, maybe just do nothing.
            return prev;
        }
      }

      return { ...newState, shoe: newShoe };
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
    setActiveSlot({ type: 'player', handIndex });
  };

  const handleNextHand = () => {
    setGameState((prev) => {
      const nextIndex = (prev.activeHandIndex + 1) % prev.playerHands.length;
      setActiveSlot({ type: 'player', handIndex: nextIndex });
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
              dealerCards={gameState.dealerCards}
              playerHands={gameState.playerHands}
              discardCards={gameState.discardCards}
              activeHandIndex={gameState.activeHandIndex}
              activeSlot={activeSlot}
              setActiveSlot={setActiveSlot}
              onSplit={handleSplit}
              onNextHand={handleNextHand}
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
             <ActionAdvisor bestMove={bestMove} isLoading={isCalculating} />
          </div>
        </div>

        {/* Bottom Deck Tracker */}
        <div className="shrink-0 bg-gray-900 z-10">
          <DeckTracker
            shoe={gameState.shoe}
            mode={trackerMode}
            setMode={setTrackerMode}
            onCardClick={handleCardClick}
          />
        </div>
      </div>
    </div>
  );
}

export default App;