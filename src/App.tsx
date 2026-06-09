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
  activeHandIndex: 0,
  shoe: initializeShoe(DEFAULT_OPTIONS.decks),
  options: DEFAULT_OPTIONS,
};

function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);

  // UI State
  const [trackerMode, setTrackerMode] = useState<'REMOVE' | 'ADD'>('REMOVE');
  const [activeSlot, setActiveSlot] = useState<{ type: 'dealer' | 'player', handIndex?: number } | null>({ type: 'player', handIndex: 0 });
  const [bestMove, setBestMove] = useState<BestMoveResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
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
        }

        // If we didn't remove from active slot, maybe try to find any occurrence? Or just add it back if it's less than max
        if (!removedFromTable) {
           // We could just add it back to the shoe without removing from table if not found in active slot,
           // but the prompt says "smaže ji ze stolu".
           // Let's just find the first occurrence from end of dealer, then player hands.
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
    <div className="flex h-screen bg-gray-900 font-sans overflow-hidden">
      <Sidebar
        options={gameState.options}
        setOptions={handleOptionsChange}
        onResetShoe={resetShoe}
      />

      <div className="flex-1 flex flex-col relative">
        <MainTable
          dealerCards={gameState.dealerCards}
          playerHands={gameState.playerHands}
          activeHandIndex={gameState.activeHandIndex}
          activeSlot={activeSlot}
          setActiveSlot={setActiveSlot}
          onSplit={handleSplit}
          onNextHand={handleNextHand}
        />

        {/* Insurance Detector */}
        {gameState.dealerCards.length > 0 && gameState.dealerCards[0] === 'A' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-blue-900/90 border-2 border-blue-400 p-4 rounded-xl shadow-2xl flex flex-col items-center backdrop-blur-sm">
              <h3 className="text-white font-bold text-lg mb-1 uppercase tracking-widest">Pojištění</h3>
              {(() => {
                const tensCount = gameState.shoe['T'] + gameState.shoe['J'] + gameState.shoe['Q'] + gameState.shoe['K'];
                const totalCards = Object.values(gameState.shoe).reduce((a, b) => a + b, 0);
                const prob = totalCards > 0 ? tensCount / totalCards : 0;
                // Insurance pays 2:1. EV = (prob * 2) - ((1 - prob) * 1)
                const ev = prob * 2 - (1 - prob);

                return (
                  <div className="text-center">
                    <p className="text-blue-200 text-sm mb-2">
                      Tens ratio: {(prob * 100).toFixed(1)}% | EV: {ev > 0 ? '+' : ''}{ev.toFixed(3)}
                    </p>
                    {ev > 0 ? (
                      <div className="bg-green-500 text-black font-black px-4 py-2 rounded uppercase animate-pulse">
                        Zkoupit pojištění
                      </div>
                    ) : (
                      <div className="bg-red-500/80 text-white font-bold px-4 py-2 rounded uppercase">
                        Nekupovat
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Right side panel for ActionAdvisor */}
        <div className="absolute right-0 top-0 bottom-[140px] w-80 bg-gray-800 border-l border-gray-700 shadow-xl overflow-y-auto hidden xl:block">
           <ActionAdvisor bestMove={bestMove} isLoading={isCalculating} />
        </div>

        <div className="h-[140px]">
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