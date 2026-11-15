import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Target, 
  RotateCcw, 
  Trophy, 
  Clock, 
  Zap, 
  Volume2
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

interface WordGoalModeProps {
  user: User | null;
  soundEnabled: boolean;
  onSaveRecord: (rec: ScoreRecord) => void;
  onAddXp: (amount: number) => void;
  kbScale: number;
  onSetKbScale: (s: number) => void;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
  isRewardMode?: boolean;
  onWordCompleted?: (wordsCount?: number, charLength?: number) => void;
}

export const WordGoalMode: React.FC<WordGoalModeProps> = ({
  user,
  soundEnabled,
  onSaveRecord,
  onAddXp,
  kbScale,
  onSetKbScale,
  isMobileMode,
  onToggleMobileMode,
  isRewardMode,
  onWordCompleted
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
  const [hasSaved, setHasSaved] = useState<boolean>(false);
  const [wpm, setWpm] = useState<number>(0);
  const [cpm, setCpm] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(100);
  const [hintKey, setHintKey] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Start or reset game for a specific goal
  const startGoalGame = useCallback((goalCount: number) => {
    const validatedCount = Math.max(3, Math.min(300, goalCount));
    const newQueue = buildWordQueue(validatedCount);

    setTargetGoal(validatedCount);
    setCustomGoalInput(validatedCount.toString());
    setWordsQueue(newQueue);
    setCurrentWordIndex(0);
    setTypedChars('');
    setErrorsCount(0);
    setStartTime(null);
    setElapsedSeconds(0);
    setIsFinished(false);
    setHasSaved(false);
    setWpm(0);
    setCpm(0);
    setAccuracy(100);
    setHintKey(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Initialize once on mount with 50 words
  useEffect(() => {
    startGoalGame(50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // Run ONLY on mount!

  // Live timer
  useEffect(() => {
    if (startTime && !isFinished) {
      timerRef.current = setInterval(() => {
        const seconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        setElapsedSeconds(seconds);

        const wordsFinished = currentWordIndex;
        const currentWpm = Math.round((wordsFinished / seconds) * 60);
        setWpm(currentWpm);
      }, 500);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, isFinished, currentWordIndex]);

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
  const handleFinished = useCallback(() => {
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = startTime ? Math.max(1, (Date.now() - startTime) / 1000) : 1;
    const finalWpm = Math.round((targetGoal / duration) * 60);

    const totalChars = wordsQueue.reduce((acc, w) => acc + w.length, 0);
    const finalCpm = Math.round((totalChars / duration) * 60);
    const totalAttempts = totalChars + errorsCount;
    const finalAcc = totalAttempts > 0 ? Math.round((totalChars / totalAttempts) * 100) : 100;

    setWpm(finalWpm);
    setCpm(finalCpm);
    setAccuracy(finalAcc);

    if (soundEnabled) playSuccessFanfare();
    launchConfetti();

    // Reward XP
    const earnedXp = Math.round(targetGoal * 3 + finalWpm);
    onAddXp(earnedXp);
  }, [startTime, targetGoal, wordsQueue, errorsCount, soundEnabled, onAddXp]);

  // Advance to next word
  const nextWord = useCallback(() => {
    if (currentWordIndex + 1 >= targetGoal) {
      handleFinished();
    } else {
      setCurrentWordIndex(prev => prev + 1);
      setTypedChars('');
      setHintKey(null);
    }
  }, [currentWordIndex, targetGoal, handleFinished]);

  // Handle character input
  const handleCharInput = useCallback((char: string) => {
    if (isFinished || !currentWord) return;

    if (!startTime) {
      setStartTime(Date.now());
    }

    const nextExpected = currentWord[typedChars.length];
    const upperInput = char.toUpperCase();

    if (upperInput === nextExpected || (nextExpected === ' ' && char === ' ')) {
      if (soundEnabled) playCorrectBeep();
      setHintKey(null);
      const newTyped = typedChars + nextExpected;
      setTypedChars(newTyped);

      if (newTyped === currentWord) {
        onWordCompleted?.(1, currentWord.length);
        setTimeout(() => {
          nextWord();
        }, 120);
      }
    } else {
      if (soundEnabled) playErrorTone();
      setErrorsCount(prev => prev + 1);
    }
  }, [isFinished, currentWord, startTime, typedChars, soundEnabled, nextWord, onWordCompleted]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        startGoalGame(targetGoal);
        return;
      }
      if (e.key === ' ' && currentWord[typedChars.length] === ' ') {
        e.preventDefault();
        handleCharInput(' ');
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        handleCharInput(e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCharInput, startGoalGame, targetGoal, currentWord, typedChars]);

  const handleSaveToLeaderboard = () => {
    if (hasSaved) return;
    const record: ScoreRecord = {
      id: 'marathon_' + Date.now(),
      userId: user ? user.uid : 'guest_' + Math.random().toString(36).substring(2, 8),
      userName: user?.displayName || 'Юный бегун',
      userPhoto: user?.photoURL || undefined,
      mode: 'word_goal',
      wpm,
      cpm,
      accuracy,
      wordsCount: targetGoal,
      timeSeconds: elapsedSeconds,
      details: `Марафон: ${targetGoal} слов за ${elapsedSeconds} с`,
      createdAt: new Date().toISOString()
    };
    onSaveRecord(record);
    setHasSaved(true);
  };

  const handleApplyCustomGoal = () => {
    const parsed = parseInt(customGoalInput, 10);
    if (!isNaN(parsed) && parsed >= 3 && parsed <= 300) {
      startGoalGame(parsed);
    }
  };

  const progressPercent = Math.min(100, Math.round((currentWordIndex / targetGoal) * 100));
  const expectedChar = !isFinished && currentWord ? currentWord[typedChars.length] : undefined;
  const currentEmoji = WORD_EMOJIS[currentWord] || '🐾';

  return (
    <div className="w-full max-w-5xl flex flex-col items-center gap-3">
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
              onClick={() => startGoalGame(count)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border ${
                targetGoal === count
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {count} слов
            </button>
          ))}

          {/* Any custom number input */}
          <div className="flex items-center gap-1.5 ml-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 ml-1">Своё число:</span>
            <input
              type="number"
              min={3}
              max={300}
              value={customGoalInput}
              onChange={(e) => setCustomGoalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyCustomGoal();
              }}
              className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center font-bold bg-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleApplyCustomGoal}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
            >
              Задать
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => startGoalGame(targetGoal)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition text-xs font-bold"
          title="Сбросить марафон (Esc)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Сначала</span>
        </button>
      </div>

      {/* Progress Track: The Cat walks towards treats */}
      <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2">
          <span className="flex items-center gap-1">
            <span className="text-emerald-600 text-base font-black">{currentWordIndex}</span> / {targetGoal} слов напечатано
          </span>
          <span className="flex items-center gap-1 font-mono text-amber-600">
            <Clock className="w-3.5 h-3.5" />
            {Math.floor(elapsedSeconds / 60)}:
            {(elapsedSeconds % 60).toString().padStart(2, '0')}
          </span>
        </div>

        <div className="relative w-full h-8 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200 flex items-center">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Running Cat marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 select-none text-xl"
            style={{ left: `calc(${progressPercent}% - 14px)` }}
          >
            🐱
          </div>

          {/* Golden Goal marker */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-base select-none">
            🏆
          </div>
        </div>
      </div>

      {/* Current Word Arena */}
      {!isFinished && currentWord && (
        <div className="w-full bg-white rounded-3xl p-6 sm:p-8 shadow-md border-2 border-emerald-100 flex flex-col items-center justify-center relative min-h-[190px]">
          
          <div className="text-4xl sm:text-5xl mb-2 animate-bounce">
            {currentEmoji}
          </div>

          {/* Big typed characters */}
          <div className="flex items-center justify-center gap-1 text-5xl sm:text-6xl font-mono font-black tracking-widest my-2 flex-wrap">
            {currentWord.split('').map((char, index) => {
              let colorClass = "text-slate-300";
              if (index < typedChars.length) {
                colorClass = "text-emerald-500";
              } else if (index === typedChars.length) {
                colorClass = "text-slate-900 border-b-4 border-emerald-500 animate-pulse";
              }
              return (
                <span key={index} className={`${colorClass} transition-colors duration-150`}>
                  {char === ' ' ? '\u00A0' : char}
                </span>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-slate-400 font-medium">
              Слоги: <b className="text-slate-600">{formatSyllables(currentWord)}</b>
            </span>

            {soundEnabled && (
              <button
                type="button"
                onClick={() => speakRussianText(currentWord)}
                className="p-1.5 rounded-full hover:bg-emerald-50 text-emerald-600 transition"
                title="Озвучить слово"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completion Trophy Card */}
      {isFinished && (
        <div className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-4xl">🏆</span>
              <h3 className="text-2xl font-black">Марафон {targetGoal} слов завершён!</h3>
            </div>
            <p className="text-emerald-100 text-sm mt-1">
              Ты преодолел всю дистанцию! Твоя скорость:{' '}
              <b className="text-white text-lg">{wpm} WPM</b> ({cpm} зн/мин), время:{' '}
              <b className="text-white text-lg">
                {Math.floor(elapsedSeconds / 60)}м {elapsedSeconds % 60}с
              </b>
              , точность: <b className="text-white text-lg">{accuracy}%</b>.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              <span>{hasSaved ? 'Рекорд записан!' : 'Сохранить рекорд'}</span>
            </button>

            <button
              type="button"
              onClick={() => startGoalGame(targetGoal)}
              className="px-4 py-3 bg-emerald-800/60 hover:bg-emerald-800 text-white rounded-2xl font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Новый забег</span>
            </button>
          </div>
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
