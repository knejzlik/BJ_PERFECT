import { useState, useEffect, useRef } from 'react';
import { type GameState, type GameOptions, initializeShoe, type Card, DEFAULT_KEYBINDS, type HistoryItem, type Hand } from './types';
import { Sidebar } from './components/Sidebar';
import { MainTable } from './components/MainTable';
import { ActionAdvisor } from './components/ActionAdvisor';
import { type BestMoveResult, type SideBetsEV, type BetSuggestion } from './engine/blackjackEngine';

function exportGameState(gameState: GameState): string {
  const d = gameState.dealerCards.join(',');
  const p = gameState.playerHands.map(h => h.cards.join(',')).join('|');
  
  // Compress discardCards using count mapping
  const discardCounts: Partial<Record<Card, number>> = {};
  for (const card of gameState.discardCards) {
    discardCounts[card] = (discardCounts[card] || 0) + 1;
  }
  const x = Object.entries(discardCounts)
    .map(([card, count]) => `${card}:${count}`)
    .join(',');

  return `BJP:D=${d};P=${p};X=${x}`;
}

function importGameState(importStr: string, options: GameOptions): Partial<GameState> | null {
  const trimmed = importStr.trim();
  if (!trimmed.startsWith('BJP:')) return null;

  const parts = trimmed.substring(4).split(';');
  let dealerCards: Card[] = [];
  let playerHands: Hand[] = [];
  const discardCards: Card[] = [];

  for (const part of parts) {
    const [key, val] = part.split('=');
    if (key === undefined || val === undefined) continue;

    if (key === 'D') {
      dealerCards = val.split(',').filter(c => c !== '') as Card[];
    } else if (key === 'X') {
      const cardParts = val.split(',').filter(c => c !== '');
      for (const cardPart of cardParts) {
        if (cardPart.includes(':')) {
          const [c, countStr] = cardPart.split(':');
          const count = parseInt(countStr, 10) || 0;
          for (let i = 0; i < count; i++) {
            discardCards.push(c as Card);
          }
        } else {
          discardCards.push(cardPart as Card);
        }
      }
    } else if (key === 'P') {
      const handsStr = val.split('|');
      playerHands = handsStr.map(hStr => {
        const hCards = hStr.split(',').filter(c => c !== '') as Card[];
        return {
          cards: hCards,
          bet: options.minBet,
          isSplitHand: handsStr.length > 1
        };
      });
    }
  }

  if (playerHands.length === 0) {
    playerHands = [{ cards: [], bet: options.minBet, isSplitHand: false }];
  }

  const newShoe = initializeShoe(options.decks);
  const allCards = [
    ...dealerCards,
    ...discardCards,
    ...playerHands.flatMap(h => h.cards)
  ];

  for (const card of allCards) {
    if (newShoe[card] > 0) {
      newShoe[card]--;
    } else {
      return null;
    }
  }

  return {
    dealerCards,
    playerHands,
    discardCards,
    shoe: newShoe,
    activeHandIndex: 0
  };
}

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

  // History and Share setup states
  const [cardHistory, setCardHistory] = useState<HistoryItem[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExportClick = () => {
    const code = exportGameState(gameState);
    setExportText(code);
    setIsExportModalOpen(true);
    setCopySuccess(false);
  };

  const handleImportClick = () => {
    setImportText('');
    setImportError(null);
    setIsImportModalOpen(true);
  };

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

  const pushToHistory = (card: Card, zone: 'dealer' | 'player' | 'discard', handIndex?: number) => {
    setCardHistory(prev => {
      const newItem: HistoryItem = {
        id: Math.random().toString(),
        card,
        zone,
        handIndex
      };
      return [newItem, ...prev].slice(0, 10);
    });
  };

  const removeFromHistoryByMatch = (card: Card, zone: 'dealer' | 'player' | 'discard', handIndex?: number) => {
    setCardHistory(prev => {
      const idx = prev.findIndex(item => item.card === card && item.zone === zone && (zone !== 'player' || item.handIndex === handIndex));
      if (idx !== -1) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      return prev;
    });
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

  const handleRemoveFromHistory = (item: HistoryItem) => {
    setGameState(prev => {
      if (item.zone === 'dealer') {
        const index = prev.dealerCards.lastIndexOf(item.card);
        if (index === -1) return prev;
        const newDealerCards = [...prev.dealerCards];
        newDealerCards.splice(index, 1);
        return {
          ...prev,
          shoe: { ...prev.shoe, [item.card]: prev.shoe[item.card] + 1 },
          dealerCards: newDealerCards
        };
      } else if (item.zone === 'discard') {
        const index = prev.discardCards.lastIndexOf(item.card);
        if (index === -1) return prev;
        const newDiscardCards = [...prev.discardCards];
        newDiscardCards.splice(index, 1);
        return {
          ...prev,
          shoe: { ...prev.shoe, [item.card]: prev.shoe[item.card] + 1 },
          discardCards: newDiscardCards
        };
      } else {
        const handIndex = item.handIndex ?? prev.activeHandIndex;
        if (!prev.playerHands[handIndex]) return prev;
        const index = prev.playerHands[handIndex].cards.lastIndexOf(item.card);
        if (index === -1) return prev;
        const newHands = [...prev.playerHands];
        const newCards = [...newHands[handIndex].cards];
        newCards.splice(index, 1);
        newHands[handIndex] = { ...newHands[handIndex], cards: newCards };
        return {
          ...prev,
          shoe: { ...prev.shoe, [item.card]: prev.shoe[item.card] + 1 },
          playerHands: newHands
        };
      }
    });

    setCardHistory(prev => prev.filter(h => h.id !== item.id));
  };

  const resetShoe = () => {
    setGameState(prev => ({
      ...INITIAL_STATE,
      options: prev.options,
      shoe: initializeShoe(prev.options.decks),
    }));
    setCardHistory([]);
  };

  const handleAddDealerCard = (card: Card) => {
    if (gameState.shoe[card] <= 0) return;
    setGameState(prev => ({
      ...prev,
      shoe: { ...prev.shoe, [card]: prev.shoe[card] - 1 },
      dealerCards: [...prev.dealerCards, card]
    }));
    pushToHistory(card, 'dealer');
  };

  const handleRemoveDealerCard = (index: number) => {
    const card = gameState.dealerCards[index];
    if (!card) return;
    setGameState(prev => {
      const newDealerCards = [...prev.dealerCards];
      newDealerCards.splice(index, 1);
      return {
        ...prev,
        shoe: { ...prev.shoe, [card]: prev.shoe[card] + 1 },
        dealerCards: newDealerCards
      };
    });
    removeFromHistoryByMatch(card, 'dealer');
  };

  const handleAddDiscardCard = (card: Card) => {
    if (gameState.shoe[card] <= 0) return;
    setGameState(prev => ({
      ...prev,
      shoe: { ...prev.shoe, [card]: prev.shoe[card] - 1 },
      discardCards: [...prev.discardCards, card]
    }));
    pushToHistory(card, 'discard');
  };

  const handleRemoveDiscardCard = (index: number) => {
    const card = gameState.discardCards[index];
    if (!card) return;
    setGameState(prev => {
      const newDiscardCards = [...prev.discardCards];
      newDiscardCards.splice(index, 1);
      return {
        ...prev,
        shoe: { ...prev.shoe, [card]: prev.shoe[card] + 1 },
        discardCards: newDiscardCards
      };
    });
    removeFromHistoryByMatch(card, 'discard');
  };

  const handleAddPlayerCard = (handIndex: number, card: Card) => {
    if (gameState.shoe[card] <= 0) return;
    setGameState(prev => {
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
    pushToHistory(card, 'player', handIndex);
  };

  const handleRemovePlayerCard = (handIndex: number, cardIndex: number) => {
    const hand = gameState.playerHands[handIndex];
    if (!hand) return;
    const card = hand.cards[cardIndex];
    if (!card) return;
    setGameState(prev => {
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
    removeFromHistoryByMatch(card, 'player', handIndex);
  };

  const handleNextRound = () => {
    setGameState(prev => {
      const allPlayerCards = prev.playerHands.flatMap(h => h.cards);
      return {
        ...prev,
        dealerCards: [],
        playerHands: [{ cards: [], bet: 1, isSplitHand: false }],
        discardCards: [...prev.discardCards, ...prev.dealerCards, ...allPlayerCards],
        activeHandIndex: 0
      };
    });
    setCardHistory([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              onExport={handleExportClick}
              onImportClick={handleImportClick}
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
          <div className="xl:w-80 bg-gray-800 border-t xl:border-t-0 xl:border-l border-gray-700 shadow-xl shrink-0 flex flex-col h-full overflow-hidden">
             <ActionAdvisor
               bestMove={bestMove}
               sideBetsEV={sideBetsEV}
               betSuggestion={betSuggestion || { runningCount: 0, trueCount: 0, suggestedBet: gameState.options.minBet }}
               isLoading={isCalculating}
               cardHistory={cardHistory}
               onRemoveFromHistory={handleRemoveFromHistory}
             />
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Import Setup
              </h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Paste a shared configuration code (starts with <code className="text-blue-300 font-mono">BJP:</code>) below to load the dealer, player, and discard cards.
              </p>
              {importError && (
                <div className="mb-3 p-2 bg-red-500/20 border border-red-500/40 rounded text-red-300 text-xs font-medium">
                  {importError}
                </div>
              )}
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="BJP:D=A;P=8,8|9;X=2,3..."
                className="w-full h-24 bg-gray-950/80 text-white border border-gray-700 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none placeholder-gray-600 shadow-inner"
              />
            </div>
            <div className="bg-gray-900 px-6 py-4 flex justify-end gap-3 border-t border-gray-800">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const imported = importGameState(importText, gameState.options);
                  if (imported) {
                    setGameState(prev => ({ ...prev, ...imported }));
                    setIsImportModalOpen(false);
                    setCardHistory([]);
                    setImportError(null);
                  } else {
                    setImportError('Invalid configuration code or card count exceeds available decks!');
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-500 text-white font-bold transition-all shadow-md"
              >
                Load Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                Export Setup
              </h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Copy this code and share it with another user to let them instantly load your current table setup.
              </p>
              <textarea
                readOnly
                value={exportText}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-24 bg-gray-950/80 text-white border border-gray-700 rounded-lg p-3 text-sm font-mono focus:outline-none resize-none shadow-inner cursor-pointer"
              />
            </div>
            <div className="bg-gray-900 px-6 py-4 flex justify-end gap-3 border-t border-gray-800">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportText)
                    .then(() => {
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    })
                    .catch((err) => {
                      console.error('Failed to copy: ', err);
                    });
                }}
                className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md"
              >
                {copySuccess ? 'Copied! ✓' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;