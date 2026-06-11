import { useState, useEffect, useRef } from 'react';
import { type GameState, type GameOptions, initializeShoe, type Card, DEFAULT_KEYBINDS } from './types';
import { Sidebar } from './components/Sidebar';
import { MainTable } from './components/MainTable';
import { ActionAdvisor } from './components/ActionAdvisor';
import { type BestMoveResult, type SideBetsEV, type BetSuggestion } from './engine/blackjackEngine';

const DEFAULT_OPTIONS: GameOptions = {
  decks: 6,
  standOnSoft17: true, // S17
  doubleAfterSplit: true, // DAS
  surrenderAllowed: true,
  blackjackPayout: 1.5, // 3:2
  minBet: 10,
  balance: 1000,
  countingSystem: 'Hi-Lo',
  bettingSystem: 'Kelly Criterion',
  bettingAggressiveness: 1.0,
  allowBetSkipping: false,
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
  const [betSuggestion, setBetSuggestion] = useState<BetSuggestion | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // Keyboard keybinds and focus state
  const [activeKeyboardZone, setActiveKeyboardZone] = useState<'dealer' | 'player' | 'discard'>('player');
  const [discardMode, setDiscardMode] = useState<'add' | 'remove'>('add');

  const LOCAL_STORAGE_KEYBINDS_KEY = 'bj_perfect_keybinds';

  const [keybinds, setKeybinds] = useState<Record<Card, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYBINDS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error loading keybinds:", e);
    }
    return { ...DEFAULT_KEYBINDS };
  });

  const handleUpdateKeybind = (card: Card, key: string) => {
    setKeybinds(prev => {
      const next = { ...prev, [card]: key.toLowerCase() };
      localStorage.setItem(LOCAL_STORAGE_KEYBINDS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleResetKeybinds = () => {
    setKeybinds(DEFAULT_KEYBINDS);
    localStorage.setItem(LOCAL_STORAGE_KEYBINDS_KEY, JSON.stringify(DEFAULT_KEYBINDS));
  };



  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker/blackjack.worker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (event) => {
      const { type, result, sideBets, betSuggestion: suggestedBetResult } = event.data;
      if (type === 'bestMove') {
        setBestMove(result);
        setIsCalculating(false);
      } else if (type === 'sideBets') {
        setSideBetsEV(sideBets);
        setIsCalculating(false);
      } else if (type === 'betSuggestion') {
        setBetSuggestion(suggestedBetResult);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    // Also dispatch betSuggestion update when shoe or options change
    workerRef.current?.postMessage({
      type: 'betSuggestion',
      shoe: gameState.shoe,
      options: gameState.options,
    });
  }, [gameState.shoe, gameState.options]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setActiveKeyboardZone(prev => {
          if (prev === 'player') return 'dealer';
          if (prev === 'dealer') return 'discard';
          return 'player';
        });
        return;
      }

      const pressedKey = e.key.toLowerCase();
      const card = Object.keys(keybinds).find(
        (c) => keybinds[c as Card] === pressedKey
      ) as Card | undefined;

      if (card) {
        e.preventDefault();
        if (activeKeyboardZone === 'dealer') {
          handleAddDealerCard(card);
        } else if (activeKeyboardZone === 'discard') {
          if (discardMode === 'add') {
            handleAddDiscardCard(card);
          } else {
            const index = gameState.discardCards.lastIndexOf(card);
            if (index !== -1) {
              handleRemoveDiscardCard(index);
            }
          }
        } else if (activeKeyboardZone === 'player') {
          handleAddPlayerCard(gameState.activeHandIndex, card);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keybinds, activeKeyboardZone, discardMode, gameState.discardCards, gameState.activeHandIndex]);

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
        keybinds={keybinds}
        onUpdateKeybind={handleUpdateKeybind}
        onResetKeybinds={handleResetKeybinds}
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
              onNextRound={handleNextRound}
              activeKeyboardZone={activeKeyboardZone}
              setActiveKeyboardZone={setActiveKeyboardZone}
              discardMode={discardMode}
              setDiscardMode={setDiscardMode}
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
               betSuggestion={betSuggestion || { runningCount: 0, trueCount: 0, suggestedBet: gameState.options.minBet }}
               isLoading={isCalculating}
             />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;