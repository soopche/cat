import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Target, 
  RotateCcw, 
  Trophy, 
  Clock, 
  Volume2,
  Crown
} from 'lucide-react';
import { WORD_DATABASE, WORD_EMOJIS, formatSyllables } from '../data/words';
import { VirtualKeyboard } from './VirtualKeyboard';
import { 
  playCorrectBeep, 
  playErrorTone, 
  playSuccessFanfare, 
  launchConfetti, 
  speakRussianText 
} from '../utils/soundAndEffects';
import { ScoreRecord } from '../firebase';
import { User } from 'firebase/auth';
import {
  CoopPlayerState,
  CoopGameConfig,
  determineCoopWinner
} from '../utils/mqttCoopRoom';

interface WordGoalModeProps {
  user: User | null;
  playerName?: string;
  onChangePlayerName?: (name: string) => void;
  soundEnabled: boolean;
  onSaveRecord: (rec: ScoreRecord) => void;
  onAddXp: (amount: number) => void;
  kbScale: number;
  onSetKbScale: (s: number) => void;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
  isRewardMode?: boolean;
  onWordCompleted?: (wordsCount?: number, charLength?: number) => void;
  onMarathonCompleted?: (wpm: number, accuracy: number, wordsCount: number) => void;
  // Co-op props
  isCoopRoomActive?: boolean;
  isCoopHost?: boolean;
  coopPartner?: CoopPlayerState | null;
  coopSharedConfig?: CoopGameConfig | null;
  coopRoundTrigger?: number;
  onPublishCoopConfig?: (config: Partial<CoopGameConfig>, startRound?: boolean) => void;
  onUpdateCoopSelfProgress?: (patch: Partial<CoopPlayerState>) => void;
}

export const WordGoalMode: React.FC<WordGoalModeProps> = ({
  user,
  playerName = '',
  onChangePlayerName,
  soundEnabled,
  onSaveRecord,
  onAddXp,
  kbScale,
  onSetKbScale,
  isMobileMode,
  onToggleMobileMode,
  onWordCompleted,
  onMarathonCompleted,
  isCoopRoomActive = false,
  isCoopHost = false,
  coopPartner = null,
  coopSharedConfig = null,
  coopRoundTrigger = 0,
  onPublishCoopConfig,
  onUpdateCoopSelfProgress
}) => {
  const [targetGoal, setTargetGoal] = useState<number>(50);
  const [customGoalInput, setCustomGoalInput] = useState<string>('50');
  const [wordsQueue, setWordsQueue] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [typedChars, setTypedChars] = useState<string>('');
  const [errorsCount, setErrorsCount] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [finishedAtTime, setFinishedAtTime] = useState<number | undefined>(undefined);
  const [hasSaved, setHasSaved] = useState<boolean>(false);
  const [wpm, setWpm] = useState<number>(0);
  const [cpm, setCpm] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(100);
  const [hintKey, setHintKey] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const tabletInputRef = useRef<HTMLInputElement>(null);
  const currentWordIndexRef = useRef<number>(0);
  const typedCharsRef = useRef<string>('');
  const errorsCountRef = useRef<number>(0);
  const wordTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeydownTimeRef = useRef<number>(0);
  const appliedConfigIdRef = useRef<string>('');

  currentWordIndexRef.current = currentWordIndex;
  typedCharsRef.current = typedChars;
  errorsCountRef.current = errorsCount;

  // Helper to generate word queue for any given count (strictly single words without spaces)
  const buildWordQueue = (count: number) => {
    const singleWords: string[] = [];
    Object.values(WORD_DATABASE).forEach(list => {
      list.forEach(w => {
        if (!w.includes(' ')) {
          singleWords.push(w);
        }
      });
    });
    const queue: string[] = [];
    for (let i = 0; i < count; i++) {
      const pick = singleWords[Math.floor(Math.random() * singleWords.length)] || 'КОТ';
      queue.push(pick);
    }
    return queue;
  };

  // Start or reset game for a specific goal (or shared Co-op queue)
  const startGoalGame = useCallback((
    goalCount: number,
    sharedQueue?: string[],
    broadcastToCoop: boolean = false
  ) => {
    if (wordTransitionTimeoutRef.current) {
      clearTimeout(wordTransitionTimeoutRef.current);
      wordTransitionTimeoutRef.current = null;
    }
    const validatedCount = Math.max(3, Math.min(300, goalCount));
    const newQueue = sharedQueue && sharedQueue.length > 0 ? sharedQueue : buildWordQueue(validatedCount);

    setTargetGoal(validatedCount);
    setCustomGoalInput(validatedCount.toString());
    setWordsQueue(newQueue);
    setCurrentWordIndex(0);
    currentWordIndexRef.current = 0;
    setTypedChars('');
    typedCharsRef.current = '';
    setErrorsCount(0);
    errorsCountRef.current = 0;
    setStartTime(null);
    setElapsedSeconds(0);
    setIsFinished(false);
    setFinishedAtTime(undefined);
    setHasSaved(false);
    setWpm(0);
    setCpm(0);
    setAccuracy(100);
    setHintKey(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    onUpdateCoopSelfProgress?.({
      mode: 'word_goal',
      progressPercent: 0,
      wordsCompleted: 0,
      wpm: 0,
      cpm: 0,
      accuracy: 100,
      elapsedSeconds: 0,
      isFinished: false,
      finishedAt: undefined
    });

    if (broadcastToCoop && isCoopRoomActive && isCoopHost) {
      onPublishCoopConfig?.(
        {
          mode: 'word_goal',
          marathonTargetGoal: validatedCount,
          marathonWordsQueue: newQueue
        },
        true
      );
    }
  }, [isCoopRoomActive, isCoopHost, onPublishCoopConfig, onUpdateCoopSelfProgress]);

  // Initialize once on mount with 50 words
  useEffect(() => {
    startGoalGame(50, undefined, false);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wordTransitionTimeoutRef.current) clearTimeout(wordTransitionTimeoutRef.current);
    };
  }, []);

  // Sync when Co-op shared config updates (Guest round start)
  useEffect(() => {
    if (!isCoopRoomActive || isCoopHost || !coopSharedConfig || coopSharedConfig.mode !== 'word_goal') return;
    if (coopSharedConfig.configId && coopSharedConfig.configId !== appliedConfigIdRef.current) {
      appliedConfigIdRef.current = coopSharedConfig.configId;
      if (coopSharedConfig.marathonTargetGoal && coopSharedConfig.marathonWordsQueue) {
        startGoalGame(coopSharedConfig.marathonTargetGoal, coopSharedConfig.marathonWordsQueue, false);
      }
    }
  }, [isCoopRoomActive, isCoopHost, coopSharedConfig, startGoalGame]);

  // Also reset round when Host clicks "Начать игру" in CoopBar
  useEffect(() => {
    if (coopRoundTrigger > 0 && isCoopRoomActive) {
      if (isCoopHost) {
        startGoalGame(targetGoal, undefined, true);
      } else if (coopSharedConfig?.marathonTargetGoal && coopSharedConfig?.marathonWordsQueue) {
        startGoalGame(coopSharedConfig.marathonTargetGoal, coopSharedConfig.marathonWordsQueue, false);
      }
    }
  }, [coopRoundTrigger]);

  // Publish initial host config when entering WordGoalMode as Host
  useEffect(() => {
    if (isCoopRoomActive && isCoopHost && wordsQueue.length > 0) {
      onPublishCoopConfig?.(
        {
          mode: 'word_goal',
          marathonTargetGoal: targetGoal,
          marathonWordsQueue: wordsQueue
        },
        false
      );
    }
  }, [isCoopRoomActive, isCoopHost]);

  // Smooth, uninterrupted live timer
  useEffect(() => {
    if (startTime && !isFinished) {
      const updateTimer = () => {
        const seconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        setElapsedSeconds(seconds);

        const wordsFinished = currentWordIndexRef.current;
        const currentWpm = Math.round((wordsFinished / seconds) * 60);
        setWpm(currentWpm);

        const pct = Math.min(100, Math.round((wordsFinished / Math.max(1, targetGoal)) * 100));
        onUpdateCoopSelfProgress?.({
          mode: 'word_goal',
          progressPercent: pct,
          wordsCompleted: wordsFinished,
          wpm: currentWpm,
          elapsedSeconds: seconds,
          isFinished: false
        });
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 250);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, isFinished, targetGoal, onUpdateCoopSelfProgress]);

  const currentWord = wordsQueue[currentWordIndex] || '';

  // Auto hint
  useEffect(() => {
    if (!currentWord || isFinished) return;
    const nextChar = currentWord[typedChars.length];
    const timer = setTimeout(() => {
      setHintKey(nextChar);
    }, 3500);
    return () => clearTimeout(timer);
  }, [currentWord, typedChars, isFinished]);

  // Handle completion
  const handleFinished = useCallback((finalErrors: number) => {
    const finishNow = Date.now();
    setIsFinished(true);
    setFinishedAtTime(finishNow);
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = startTime ? Math.max(1, Math.round((finishNow - startTime) / 1000)) : 1;
    const finalWpm = Math.round((targetGoal / duration) * 60);

    const totalChars = wordsQueue.reduce((acc, w) => acc + w.length, 0);
    const finalCpm = Math.round((totalChars / duration) * 60);
    const totalAttempts = totalChars + finalErrors;
    const finalAcc = totalAttempts > 0 ? Math.round((totalChars / totalAttempts) * 100) : 100;

    setElapsedSeconds(duration);
    setWpm(finalWpm);
    setCpm(finalCpm);
    setAccuracy(finalAcc);

    onUpdateCoopSelfProgress?.({
      mode: 'word_goal',
      progressPercent: 100,
      wordsCompleted: targetGoal,
      wpm: finalWpm,
      cpm: finalCpm,
      accuracy: finalAcc,
      elapsedSeconds: duration,
      isFinished: true,
      finishedAt: finishNow
    });

    if (soundEnabled) playSuccessFanfare();
    launchConfetti();

    const earnedXp = Math.round(targetGoal * 3 + finalWpm);
    onAddXp(earnedXp);
    onMarathonCompleted?.(finalWpm, finalAcc, targetGoal);
  }, [startTime, targetGoal, wordsQueue, soundEnabled, onAddXp, onMarathonCompleted, onUpdateCoopSelfProgress]);

  // Advance to next word
  const nextWord = useCallback(() => {
    if (currentWordIndexRef.current + 1 >= targetGoal) {
      handleFinished(errorsCountRef.current);
    } else {
      const nextIdx = currentWordIndexRef.current + 1;
      currentWordIndexRef.current = nextIdx;
      setCurrentWordIndex(nextIdx);
      typedCharsRef.current = '';
      setTypedChars('');
      setHintKey(null);

      const pct = Math.min(100, Math.round((nextIdx / Math.max(1, targetGoal)) * 100));
      onUpdateCoopSelfProgress?.({
        mode: 'word_goal',
        progressPercent: pct,
        wordsCompleted: nextIdx
      });
    }
  }, [targetGoal, handleFinished, onUpdateCoopSelfProgress]);

  // Handle character input
  const handleCharInput = useCallback((char: string) => {
    if (isFinished || !currentWord) return;
    if (typedCharsRef.current.length >= currentWord.length) return;

    if (!startTime) {
      setStartTime(Date.now());
    }

    const nextExpected = currentWord[typedCharsRef.current.length];
    const upperInput = char.toUpperCase();
    const isYoEquivalent =
      (nextExpected === 'Ё' && upperInput === 'Е') ||
      (nextExpected === 'Е' && upperInput === 'Ё');

    if (upperInput === nextExpected || isYoEquivalent || (nextExpected === ' ' && char === ' ')) {
      if (soundEnabled) playCorrectBeep();
      setHintKey(null);
      const newTyped = typedCharsRef.current + nextExpected;
      typedCharsRef.current = newTyped;
      setTypedChars(newTyped);

      if (newTyped === currentWord) {
        onWordCompleted?.(1, currentWord.length);
        wordTransitionTimeoutRef.current = setTimeout(() => {
          nextWord();
        }, 100);
      }
    } else {
      if (soundEnabled) playErrorTone();
      const nextErr = errorsCountRef.current + 1;
      errorsCountRef.current = nextErr;
      setErrorsCount(nextErr);
    }
  }, [isFinished, currentWord, startTime, soundEnabled, nextWord, onWordCompleted]);

  // Physical keyboard listener: strictly block Enter and Space from triggering focused buttons!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        activeEl.tagName === 'INPUT' &&
        activeEl !== tabletInputRef.current
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        startGoalGame(targetGoal, undefined, isCoopHost);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (activeEl instanceof HTMLButtonElement) {
          activeEl.blur();
        }
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (activeEl instanceof HTMLButtonElement) {
          activeEl.blur();
        }
        if (currentWord[typedCharsRef.current.length] === ' ') {
          lastKeydownTimeRef.current = Date.now();
          handleCharInput(' ');
        }
        return;
      }

      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        lastKeydownTimeRef.current = Date.now();
        handleCharInput(e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleCharInput, startGoalGame, targetGoal, currentWord, isCoopHost]);

  // Tablet / Android Chrome IME fallback input handler
  const handleTabletInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    e.target.value = '';
    if (!val) return;
    if (Date.now() - lastKeydownTimeRef.current < 25) return;
    const lastChar = val[val.length - 1];
    if (lastChar) {
      handleCharInput(lastChar);
    }
  };

  const handleSaveToLeaderboard = () => {
    if (hasSaved) return;
    const effectiveName = (playerName && playerName.trim()) || user?.displayName || 'Юный бегун';
    const record: ScoreRecord = {
      id: 'marathon_' + Date.now(),
      userId: user ? user.uid : 'guest_' + Math.random().toString(36).substring(2, 8),
      userName: effectiveName,
      userPhoto: user?.photoURL || undefined,
      mode: 'word_goal',
      wpm,
      cpm,
      accuracy,
      wordsCount: targetGoal,
      timeSeconds: Math.max(1, elapsedSeconds),
      details: `Марафон: ${targetGoal} слов за ${elapsedSeconds} с`,
      createdAt: new Date().toISOString()
    };
    onSaveRecord(record);
    setHasSaved(true);
  };

  const handleApplyCustomGoal = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.currentTarget.blur();
    customInputRef.current?.blur();
    const parsed = parseInt(customGoalInput, 10);
    if (!isNaN(parsed) && parsed >= 3 && parsed <= 300) {
      startGoalGame(parsed, undefined, true);
    }
  };

  const myWordsDone = isFinished ? targetGoal : currentWordIndex;
  const progressPercent = Math.min(100, Math.round((myWordsDone / Math.max(1, targetGoal)) * 100));
  const partnerWordsDone = coopPartner?.wordsCompleted ?? 0;
  const partnerProgressPercent = Math.min(100, Math.round((partnerWordsDone / Math.max(1, targetGoal)) * 100));

  const expectedChar = !isFinished && currentWord ? currentWord[typedChars.length] : undefined;
  const currentEmoji = WORD_EMOJIS[currentWord] || '🐾';
  const canChangeSettings = !isCoopRoomActive || isCoopHost;

  const selfStateForWinner: CoopPlayerState = {
    playerId: 'self',
    name: playerName || user?.displayName || 'Ты',
    isHost: isCoopHost,
    color: 'orange',
    mode: 'word_goal',
    progressPercent,
    wordsCompleted: myWordsDone,
    lettersMastered: 0,
    wpm,
    cpm,
    accuracy,
    elapsedSeconds,
    isFinished,
    finishedAt: finishedAtTime,
    sessionWordsTotal: 0,
    rewardSecondsTotal: 0,
    updatedAt: Date.now()
  };

  const coopWinner = isCoopRoomActive ? determineCoopWinner(selfStateForWinner, coopPartner) : null;

  return (
    <div translate="no" className="notranslate w-full max-w-5xl flex flex-col items-center gap-3">
      {/* Hidden IME fallback input for Android tablets */}
      <input
        ref={tabletInputRef}
        type="text"
        value=""
        onChange={handleTabletInputChange}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only pointer-events-none opacity-0 w-0 h-0 absolute"
      />

      {/* Top Setting Bar: Target Words selection */}
      <div className="w-full bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
            <Target className="w-4 h-4 text-emerald-500" />
            Выбери цель слов:
          </span>

          {[10, 25, 50, 100].map(count => (
            <button
              key={count}
              type="button"
              disabled={!canChangeSettings}
              onClick={(e) => {
                e.currentTarget.blur();
                startGoalGame(count, undefined, true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border disabled:opacity-60 ${
                targetGoal === count
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{count} слов</span>
            </button>
          ))}

          {/* Any custom number input */}
          {canChangeSettings ? (
            <div className="flex items-center gap-1.5 ml-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 ml-1">Своё число:</span>
              <input
                ref={customInputRef}
                type="number"
                min={3}
                max={300}
                value={customGoalInput}
                onChange={(e) => setCustomGoalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyCustomGoal();
                  }
                }}
                className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center font-bold bg-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleApplyCustomGoal}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                }}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                Задать
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              Дистанцию ({targetGoal} слов) задаёт создатель комнаты
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            startGoalGame(targetGoal, isCoopHost ? undefined : wordsQueue, isCoopHost);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition text-xs font-bold"
          title="Сбросить марафон (Esc)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Сначала</span>
        </button>
      </div>

      {/* Progress Track: 2 Cats of different colors move towards the Trophy in Co-op! */}
      <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col gap-2.5">
        <div className="flex justify-between items-center text-xs font-bold text-slate-500 flex-wrap gap-2">
          <span key={`goal-${targetGoal}-${myWordsDone}`} className="flex items-center gap-1">
            <span className="text-emerald-600 text-base font-black">{myWordsDone}</span> / <span>{targetGoal}</span> слов напечатано
          </span>

          {isCoopRoomActive && coopPartner && (
            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-3 py-0.5 rounded-full font-extrabold">
              {myWordsDone > partnerWordsDone
                ? `🥇 Идёт первым: Ты (${myWordsDone} из ${targetGoal})`
                : partnerWordsDone > myWordsDone
                ? `🥇 Идёт первым: ${coopPartner.name} (${partnerWordsDone} из ${targetGoal})`
                : `⚡ Бежите ноздря в ноздрю (${myWordsDone} из ${targetGoal})`}
            </span>
          )}

          <span className="flex items-center gap-1 font-mono text-amber-600">
            <Clock className="w-3.5 h-3.5" />
            {Math.floor(elapsedSeconds / 60)}:
            {(elapsedSeconds % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {/* Lane 1: Player's Orange Cat on Emerald Track */}
        <div className="flex items-center gap-2">
          {isCoopRoomActive && (
            <span className="w-24 truncate text-xs font-black text-orange-600">
              🟠 Ты ({myWordsDone})
            </span>
          )}
          <div className="relative flex-1 h-8 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200 flex items-center">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-500 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Running Orange Cat marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 select-none text-xl"
              style={{ left: `clamp(4px, calc(${progressPercent}% - 14px), calc(100% - 36px))` }}
            >
              🐱
            </div>

            {/* Golden Goal Trophy */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-base select-none">
              🏆
            </div>
          </div>
        </div>

        {/* Lane 2 (Co-op): Partner's Blue Cat on Sky/Indigo Track */}
        {isCoopRoomActive && (
          <div className="flex items-center gap-2">
            <span className="w-24 truncate text-xs font-black text-indigo-600">
              🔵 {coopPartner ? `${coopPartner.name} (${partnerWordsDone})` : 'Друг...'}
            </span>
            <div className="relative flex-1 h-8 bg-indigo-50/70 rounded-full overflow-hidden p-1 border border-indigo-200 flex items-center">
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${partnerProgressPercent}%` }}
              />

              {/* Running Blue/Purple Cat marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 select-none text-xl"
                style={{ left: `clamp(4px, calc(${partnerProgressPercent}% - 14px), calc(100% - 36px))` }}
                style-filter="hue-rotate(190deg)"
              >
                🐾
              </div>

              {/* Golden Goal Trophy */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-base select-none">
                🏆
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Word Arena */}
      {!isFinished && currentWord && (
        <div
          translate="no"
          onClick={() => {
            if (isMobileMode) {
              tabletInputRef.current?.focus({ preventScroll: true });
            }
          }}
          className="notranslate w-full bg-white rounded-3xl p-6 sm:p-8 shadow-md border-2 border-emerald-100 flex flex-col items-center justify-center relative min-h-[190px]"
        >
          <div className="text-4xl sm:text-5xl mb-2 animate-bounce">
            {currentEmoji}
          </div>

          {/* Big typed characters */}
          <div translate="no" className="notranslate flex items-center justify-center gap-1 text-5xl sm:text-6xl font-mono font-black tracking-widest my-2 flex-wrap select-none">
            {currentWord.split('').map((char, index) => {
              let colorClass = "text-slate-300";
              if (index < typedChars.length) {
                colorClass = "text-emerald-500";
              } else if (index === typedChars.length) {
                colorClass = "text-slate-900 border-b-4 border-emerald-500 animate-pulse";
              }
              return (
                <span key={index} translate="no" className={`notranslate inline-block px-[1px] ${colorClass} transition-colors duration-150`}>
                  {char === ' ' ? '\u00A0' : char}
                </span>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span translate="no" className="notranslate text-xs text-slate-400 font-medium">
              Слоги: <b className="text-slate-600">{formatSyllables(currentWord)}</b>
            </span>

            {soundEnabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  speakRussianText(currentWord);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                }}
                className="p-1.5 rounded-full hover:bg-emerald-50 text-emerald-600 transition"
                title="Озвучить слово"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completion Trophy Card (with Co-op Winner & Side-by-Side Comparison) */}
      {(isFinished || (isCoopRoomActive && coopPartner?.isFinished)) && (
        <div className="w-full bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-700 rounded-3xl p-6 text-white shadow-xl flex flex-col gap-4 animate-fade-in-up">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-4xl">🏆</span>
                <h3 className="text-2xl font-black">
                  {isCoopRoomActive && coopPartner
                    ? coopWinner === 'self'
                      ? 'Ты первым прибежал к кубку!'
                      : coopWinner === 'partner'
                      ? `${coopPartner.name} первым прибежал к кубку!`
                      : 'Оба котика прибежали одновременно!'
                    : `Марафон ${targetGoal} слов завершён!`}
                </h3>
              </div>
              <p className="text-emerald-100 text-sm mt-1">
                Твой результат: <b className="text-white text-lg">{wpm} WPM</b> ({cpm} зн/мин), время:{' '}
                <b className="text-white text-lg">
                  {Math.floor(elapsedSeconds / 60)}м {elapsedSeconds % 60}с
                </b>
                , точность: <b className="text-white text-lg">{accuracy}%</b>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!user && onChangePlayerName && !hasSaved && (
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => onChangePlayerName(e.target.value)}
                  placeholder="Твоё имя для рекорда..."
                  maxLength={24}
                  className="px-3 py-2 rounded-xl bg-white/95 text-slate-800 text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              )}

              {isFinished && (
                <button
                  type="button"
                  onClick={handleSaveToLeaderboard}
                  disabled={hasSaved}
                  className={`px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition ${
                    hasSaved
                      ? 'bg-emerald-800 text-white cursor-default'
                      : 'bg-white text-emerald-900 hover:bg-emerald-50 active:scale-95'
                  }`}
                >
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span>{hasSaved ? 'Рекорд в Топ-50!' : 'Сохранить рекорд'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startGoalGame(targetGoal, undefined, isCoopHost);
                }}
                className="px-4 py-3 bg-emerald-800/60 hover:bg-emerald-800 text-white rounded-2xl font-bold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Новый забег</span>
              </button>
            </div>
          </div>

          {isCoopRoomActive && coopPartner && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/20">
              <div className="bg-white/15 rounded-2xl p-3.5 border border-white/20">
                <div className="text-xs font-black uppercase text-amber-300 mb-1 flex items-center justify-between">
                  <span>🟠 Твой котик</span>
                  {coopWinner === 'self' && <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px]">🥇 Победитель</span>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center mt-2">
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Слов</div>
                    <div className="text-base font-mono font-black">{myWordsDone}/{targetGoal}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">WPM</div>
                    <div className="text-base font-mono font-black">{wpm}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Точность</div>
                    <div className="text-base font-mono font-black">{accuracy}%</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Время</div>
                    <div className="text-base font-mono font-black">{elapsedSeconds}с</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/15 rounded-2xl p-3.5 border border-white/20">
                <div className="text-xs font-black uppercase text-sky-200 mb-1 flex items-center justify-between">
                  <span>🔵 Котик друга: {coopPartner.name}</span>
                  {coopWinner === 'partner' && <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px]">🥇 Победитель</span>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center mt-2">
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Слов</div>
                    <div className="text-base font-mono font-black">{coopPartner.wordsCompleted}/{targetGoal}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">WPM</div>
                    <div className="text-base font-mono font-black">{coopPartner.wpm}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Точность</div>
                    <div className="text-base font-mono font-black">{coopPartner.accuracy}%</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Время</div>
                    <div className="text-base font-mono font-black">{coopPartner.elapsedSeconds}с</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Virtual Keyboard */}
      <VirtualKeyboard
        currentExpectedChar={expectedChar}
        hintKey={hintKey}
        onKeyPress={handleCharInput}
        isMobileMode={isMobileMode}
        onToggleMobileMode={onToggleMobileMode}
        kbScale={kbScale}
        onSetKbScale={onSetKbScale}
        disabled={isFinished}
      />
    </div>
  );
};
