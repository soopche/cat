import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BookmarkCheck, 
  RotateCcw, 
  Clock, 
  Trophy, 
  Sparkles, 
  CheckCircle2, 
  Volume2,
  Play,
  Settings2,
  HelpCircle
} from 'lucide-react';
import { 
  RUSSIAN_ALPHABET, 
  WORDS_BY_LETTER, 
  WORD_EMOJIS, 
  formatSyllables 
} from '../data/words';
import { VirtualKeyboard } from './VirtualKeyboard';
import { 
  playCorrectBeep, 
  playErrorTone, 
  playSuccessFanfare, 
  playAlarmBeep,
  launchConfetti, 
  speakRussianText 
} from '../utils/soundAndEffects';
import { ScoreRecord } from '../firebase';
import { User } from 'firebase/auth';

interface LetterSprintModeProps {
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
  onUnlockAchievement?: (id: string) => void;
  onLetterMastered?: () => void;
}

export const LetterSprintMode: React.FC<LetterSprintModeProps> = ({
  user,
  playerName = '',
  soundEnabled,
  onSaveRecord,
  onAddXp,
  kbScale,
  onSetKbScale,
  isMobileMode,
  onToggleMobileMode,
  isRewardMode,
  onWordCompleted,
  onUnlockAchievement,
  onLetterMastered
}) => {
  // Configuration
  const [wordsPerLetter, setWordsPerLetter] = useState<number>(5);
  const [minutesLimit, setMinutesLimit] = useState<number>(3);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Current Game State
  const [currentLetter, setCurrentLetter] = useState<string>('К');
  const [letterWordsPool, setLetterWordsPool] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string>('КОТ');
  const [typedChars, setTypedChars] = useState<string>('');
  const [wordsCompletedForLetter, setWordsCompletedForLetter] = useState<number>(0);
  const [totalWordsCompleted, setTotalWordsCompleted] = useState<number>(0);
  const [lettersMastered, setLettersMastered] = useState<string[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(180);
  const [hintKey, setHintKey] = useState<string | null>(null);
  const [errorsCount, setErrorsCount] = useState<number>(0);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Pick a new random letter different from current
  const pickNewLetter = useCallback((avoidLetter?: string) => {
    const lettersWithWords = RUSSIAN_ALPHABET.filter(l => WORDS_BY_LETTER[l]?.length > 0);
    const candidates = avoidLetter ? lettersWithWords.filter(l => l !== avoidLetter) : lettersWithWords;
    const randomLetter = candidates[Math.floor(Math.random() * candidates.length)] || 'К';
    
    const words = [...(WORDS_BY_LETTER[randomLetter] || ['КОТ', 'КИТ'])].sort(() => Math.random() - 0.5);
    setCurrentLetter(randomLetter);
    setLetterWordsPool(words);
    setCurrentWord(words[0]);
    setTypedChars('');
    setWordsCompletedForLetter(0);
    setHintKey(null);
  }, []);

  // Start game session
  const startGame = useCallback(() => {
    setIsPlaying(true);
    setIsFinished(false);
    setHasSaved(false);
    setTotalWordsCompleted(0);
    setLettersMastered([]);
    setErrorsCount(0);
    setRemainingSeconds(minutesLimit * 60);
    startTimeRef.current = Date.now();
    pickNewLetter();

    if (soundEnabled) {
      speakRussianText(`Начали! Буква будет выбрана случайно. Пиши слова!`);
    }
  }, [minutesLimit, pickNewLetter, soundEnabled]);

  // Stop / Finish game session
  const finishGame = useCallback(() => {
    setIsPlaying(false);
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    if (soundEnabled) {
      playAlarmBeep();
      setTimeout(() => playSuccessFanfare(), 300);
    }
    launchConfetti();

    // Calculate XP
    const earnedXp = totalWordsCompleted * 4 + lettersMastered.length * 15;
    onAddXp(earnedXp);
  }, [soundEnabled, totalWordsCompleted, lettersMastered.length, onAddXp]);

  // Countdown timer effect
  useEffect(() => {
    if (isPlaying && !isFinished) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            finishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isFinished, finishGame]);

  // Hint key
  useEffect(() => {
    if (!isPlaying || !currentWord || isFinished) return;
    const nextChar = currentWord[typedChars.length];
    const timer = setTimeout(() => {
      setHintKey(nextChar);
    }, 3500);
    return () => clearTimeout(timer);
  }, [isPlaying, currentWord, typedChars, isFinished]);

  // Complete word
  const handleWordComplete = useCallback(() => {
    if (soundEnabled) playCorrectBeep();

    const newWordsOnLetter = wordsCompletedForLetter + 1;
    const newTotal = totalWordsCompleted + 1;
    setTotalWordsCompleted(newTotal);
    onWordCompleted?.(1, currentWord.length);

    if (newWordsOnLetter >= wordsPerLetter) {
      // Completed letter goal!
      if (soundEnabled) playSuccessFanfare();
      launchConfetti();
      onLetterMastered?.();
      setLettersMastered(prev => {
        const nextList = [...prev, currentLetter];
        // Track daily letters mastered in localStorage
        try {
          const todayKey = 'typecat_letters_daily_' + new Date().toISOString().slice(0, 10);
          const raw = localStorage.getItem(todayKey);
          let dailyList: string[] = raw ? JSON.parse(raw) : [];
          if (!dailyList.includes(currentLetter)) {
            dailyList.push(currentLetter);
            localStorage.setItem(todayKey, JSON.stringify(dailyList));
          }
          if (dailyList.length >= 10 || nextList.length >= 10) {
            onUnlockAchievement?.('letter_hunter');
          }
        } catch (e) {
          if (nextList.length >= 10) {
            onUnlockAchievement?.('letter_hunter');
          }
        }
        return nextList;
      });
      
      // New letter
      setTimeout(() => {
        pickNewLetter(currentLetter);
      }, 300);
    } else {
      setWordsCompletedForLetter(newWordsOnLetter);
      // Next word for same letter
      const nextWord = letterWordsPool[newWordsOnLetter % letterWordsPool.length] || currentWord;
      setCurrentWord(nextWord);
      setTypedChars('');
      setHintKey(null);
    }
  }, [
    soundEnabled, 
    wordsCompletedForLetter, 
    totalWordsCompleted, 
    wordsPerLetter, 
    currentLetter, 
    letterWordsPool, 
    currentWord, 
    pickNewLetter,
    onWordCompleted,
    onUnlockAchievement,
    onLetterMastered
  ]);

  // Handle character input
  const handleCharInput = useCallback((char: string) => {
    if (!isPlaying || isFinished || !currentWord) return;

    const nextExpected = currentWord[typedChars.length];
    const upperInput = char.toUpperCase();

    if (upperInput === nextExpected) {
      setHintKey(null);
      const newTyped = typedChars + nextExpected;
      setTypedChars(newTyped);

      if (newTyped === currentWord) {
        handleWordComplete();
      }
    } else {
      if (soundEnabled) playErrorTone();
      setErrorsCount(prev => prev + 1);
    }
  }, [isPlaying, isFinished, currentWord, typedChars, handleWordComplete, soundEnabled]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === 'Escape') {
        setIsPlaying(false);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        handleCharInput(e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, handleCharInput]);

  // Save to leaderboard
  const handleSaveToLeaderboard = () => {
    if (hasSaved) return;
    const totalDurationSeconds = minutesLimit * 60 - remainingSeconds;
    const durationMinutes = Math.max(0.1, totalDurationSeconds / 60);
    const calculatedWpm = Math.round(totalWordsCompleted / durationMinutes);

    const effectiveName = (playerName && playerName.trim()) || user?.displayName || 'Буквенный следопыт';
    const record: ScoreRecord = {
      id: 'letter_sprint_' + Date.now(),
      userId: user ? user.uid : 'guest_' + Math.random().toString(36).substring(2, 8),
      userName: effectiveName,
      userPhoto: user?.photoURL || undefined,
      mode: 'letter_sprint',
      wpm: calculatedWpm,
      cpm: Math.round(calculatedWpm * 5),
      accuracy: 98,
      wordsCount: totalWordsCompleted,
      timeSeconds: Math.max(1, totalDurationSeconds),
      details: `Освоено букв: ${lettersMastered.length}, слов: ${totalWordsCompleted}`,
      createdAt: new Date().toISOString()
    };
    onSaveRecord(record);
    setHasSaved(true);
  };

  const expectedChar = isPlaying && !isFinished && currentWord ? currentWord[typedChars.length] : undefined;
  const currentEmoji = WORD_EMOJIS[currentWord] || '🔤';

  return (
    <div translate="no" className="notranslate w-full max-w-5xl flex flex-col items-center gap-3">
      {/* Top Setting or Status Bar */}
      {!isPlaying && !isFinished ? (
        <div className="w-full bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col items-center gap-6">
          <div className="text-center max-w-lg">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <BookmarkCheck className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              Режим: Буквенный спринт
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Котик случайно загадывает букву. Твоя задача — напечатать заданное число слов на эту букву,
              после чего откроется новая буква! Успей пройти как можно больше до конца таймера!
            </p>
          </div>

          {/* Config Controls */}
          <div className="w-full max-w-md bg-purple-50/70 p-4 rounded-2xl border border-purple-100 flex flex-col gap-4">
            {/* Words per letter */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-purple-900 mb-1.5">
                <span>Слов на каждую букву:</span>
                <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-mono font-bold">
                  {wordsPerLetter} слов
                </span>
              </div>
              <div className="flex gap-2">
                {[3, 5, 8, 10].map(count => (
                  <button
                    key={count}
                    onClick={() => setWordsPerLetter(count)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition border ${
                      wordsPerLetter === count
                        ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                        : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Time limit (1 to 10 minutes) */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-purple-900 mb-1.5">
                <span>Время игры:</span>
                <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-mono font-bold">
                  {minutesLimit} {minutesLimit === 1 ? 'минута' : minutesLimit < 5 ? 'минуты' : 'минут'}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 5, 10].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setMinutesLimit(mins)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition border ${
                      minutesLimit === mins
                        ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                        : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    {mins} мин
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={startGame}
            className="px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-purple-200 transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Начать спринт</span>
          </button>
        </div>
      ) : isPlaying ? (
        <div className="w-full flex flex-col gap-3">
          {/* Header Stats Bar during game */}
          <div className="w-full bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-pink-500 text-white font-black text-2xl rounded-2xl flex items-center justify-center shadow-md">
                {currentLetter}
              </div>
              <div>
                <div className="text-xs font-bold text-purple-600 uppercase">
                  Текущая буква: «{currentLetter}»
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Слово: <b className="text-slate-800">{wordsCompletedForLetter + 1}</b> из {wordsPerLetter}
                </div>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-xl border border-purple-200 font-mono font-bold text-lg">
                <Clock className="w-4 h-4 text-purple-500" />
                <span>
                  {Math.floor(remainingSeconds / 60)}:
                  {(remainingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <button
                onClick={() => setIsPlaying(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                title="Остановить"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Target Word Playfield */}
          <div className="w-full bg-white rounded-3xl p-6 sm:p-8 shadow-md border-2 border-purple-100 flex flex-col items-center justify-center relative min-h-[190px]">
            <div className="text-4xl sm:text-5xl mb-2 animate-bounce">
              {currentEmoji}
            </div>

            {/* Big Word */}
            <div className="flex items-center justify-center gap-1 text-5xl sm:text-6xl font-mono font-black tracking-widest my-2">
              {currentWord.split('').map((char, index) => {
                let colorClass = "text-slate-300";
                if (index < typedChars.length) {
                  colorClass = "text-purple-600";
                } else if (index === typedChars.length) {
                  colorClass = "text-slate-900 border-b-4 border-purple-600 animate-pulse";
                }
                return (
                  <span key={index} className={`${colorClass} transition-colors duration-150`}>
                    {char}
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
                  onClick={() => speakRussianText(currentWord)}
                  className="p-1.5 rounded-full hover:bg-purple-50 text-purple-600 transition"
                  title="Озвучить слово"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Letter Progress Dots */}
            <div className="flex gap-1.5 mt-4">
              {Array.from({ length: wordsPerLetter }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    i < wordsCompletedForLetter
                      ? 'bg-purple-600 scale-110'
                      : 'bg-purple-100'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Finish Summary Card */
        <div className="w-full bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">⏱️</span>
              <h3 className="text-2xl font-black">Время вышло! Отличный результат!</h3>
            </div>
            <p className="text-purple-100 text-sm max-w-lg leading-relaxed">
              Ты напечатал <b className="text-white text-base">{totalWordsCompleted} слов</b> и освоил{' '}
              <b className="text-white text-base">{lettersMastered.length} букв</b> (
              {lettersMastered.join(', ') || 'начал тренировку'}) за {minutesLimit} мин!
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveToLeaderboard}
              disabled={hasSaved}
              className={`px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition ${
                hasSaved
                  ? 'bg-purple-900 text-white cursor-default'
                  : 'bg-white text-purple-900 hover:bg-purple-50 active:scale-95'
              }`}
            >
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>{hasSaved ? 'Рекорд сохранён!' : 'В рекорды'}</span>
            </button>

            <button
              onClick={() => {
                setIsFinished(false);
                setIsPlaying(false);
              }}
              className="px-4 py-3 bg-purple-900/60 hover:bg-purple-900 text-white rounded-2xl font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Ещё раз</span>
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
        disabled={!isPlaying || isFinished}
      />
    </div>
  );
};
