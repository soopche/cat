import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BookmarkCheck, 
  RotateCcw, 
  Clock, 
  Trophy, 
  CheckCircle2, 
  Volume2,
  Play,
  Shuffle,
  GraduationCap,
  Sparkles,
  Crown,
  Users
} from 'lucide-react';
import { 
  RUSSIAN_ALPHABET, 
  WORDS_BY_LETTER, 
  WORD_EMOJIS, 
  VOWEL_LETTERS,
  getNextCustomSprintLetter,
  formatSyllables,
  matchesRussianTypedChar
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
import {
  CoopPlayerState,
  CoopGameConfig,
  determineCoopWinner
} from '../utils/mqttCoopRoom';

export type SprintSubMode = 'random' | 'custom_letters';

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
  onLetterMastered?: (letter?: string) => void;
  learnedAlphabetLetters?: string[];
  // Co-op props
  isCoopRoomActive?: boolean;
  isCoopHost?: boolean;
  coopPartner?: CoopPlayerState | null;
  coopSharedConfig?: CoopGameConfig | null;
  coopRoundTrigger?: number;
  onPublishCoopConfig?: (config: Partial<CoopGameConfig>, startRound?: boolean) => void;
  onUpdateCoopSelfProgress?: (patch: Partial<CoopPlayerState>) => void;
}

function generateSharedSprintSequence(
  subMode: SprintSubMode,
  selectedLetters: string[],
  roundsCount: number = 40
): { letter: string; words: string[] }[] {
  const sequence: { letter: string; words: string[] }[] = [];
  const allValid = RUSSIAN_ALPHABET.filter(l => WORDS_BY_LETTER[l]?.length > 0);
  let cursor = 0;
  let prevLetter = '';

  for (let i = 0; i < roundsCount; i++) {
    let letter = 'А';
    if (subMode === 'custom_letters') {
      const step = getNextCustomSprintLetter(selectedLetters, cursor);
      letter = step.letter;
      cursor = step.nextIndex;
    } else {
      const candidates = prevLetter ? allValid.filter(l => l !== prevLetter) : allValid;
      letter = candidates[Math.floor(Math.random() * candidates.length)] || 'К';
      prevLetter = letter;
    }
    const words = [...(WORDS_BY_LETTER[letter] || ['КОТ', 'КИТ'])].sort(
      () => Math.random() - 0.5
    );
    sequence.push({ letter, words });
  }
  return sequence;
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
  onWordCompleted,
  onUnlockAchievement,
  onLetterMastered,
  learnedAlphabetLetters = [],
  isCoopRoomActive = false,
  isCoopHost = false,
  coopPartner = null,
  coopSharedConfig = null,
  coopRoundTrigger = 0,
  onPublishCoopConfig,
  onUpdateCoopSelfProgress
}) => {
  const [sprintSubMode, setSprintSubMode] = useState<SprintSubMode>('random');
  const [selectedLetters, setSelectedLetters] = useState<string[]>(['А']);

  // Configuration
  const [wordsPerLetter, setWordsPerLetter] = useState<number>(5);
  const [minutesLimit, setMinutesLimit] = useState<number>(5);
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
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);
  const [hintKey, setHintKey] = useState<string | null>(null);
  const [, setErrorsCount] = useState<number>(0);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextLetterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const customLetterCursorRef = useRef<number>(0);
  const sharedSequenceRef = useRef<{ letter: string; words: string[] }[] | null>(null);
  const sequenceRoundIdxRef = useRef<number>(0);
  const appliedConfigIdRef = useRef<string>('');
  const lastStartedSprintAtRef = useRef<number>(0);
  const prevRoundTriggerRef = useRef<number>(coopRoundTrigger);
  const currentWordRef = useRef<string>('КОТ');
  const typedCharsRef = useRef<string>('');

  const canChangeSettings = !isCoopRoomActive || isCoopHost;

  // Toggle a letter in the custom alphabet selector
  const handleToggleSelectLetter = (letter: string) => {
    if (!canChangeSettings) return;
    setSelectedLetters(prev => {
      if (prev.includes(letter)) {
        return prev.filter(l => l !== letter);
      }
      return [...prev, letter];
    });
  };

  // Select next 5 unlearned letters in alphabetical order
  const handleSelectNextUnlearned = () => {
    if (!canChangeSettings) return;
    const learnedSet = new Set(learnedAlphabetLetters);
    const unlearned = RUSSIAN_ALPHABET.filter(l => !learnedSet.has(l)).slice(0, 5);
    if (unlearned.length > 0) {
      setSelectedLetters(unlearned);
    } else {
      setSelectedLetters(RUSSIAN_ALPHABET.slice(0, 5));
    }
  };

  // Pick a new letter based on shared Co-op sequence OR local sub-mode
  const pickNewLetter = useCallback((avoidLetter?: string) => {
    if (sharedSequenceRef.current && sharedSequenceRef.current.length > 0) {
      const idx = sequenceRoundIdxRef.current % sharedSequenceRef.current.length;
      const item = sharedSequenceRef.current[idx];
      sequenceRoundIdxRef.current += 1;
      setCurrentLetter(item.letter);
      setLetterWordsPool(item.words);
      currentWordRef.current = item.words[0];
      setCurrentWord(item.words[0]);
      typedCharsRef.current = '';
      setTypedChars('');
      setWordsCompletedForLetter(0);
      setHintKey(null);
      return;
    }

    if (sprintSubMode === 'custom_letters') {
      const { letter, nextIndex } = getNextCustomSprintLetter(
        selectedLetters,
        customLetterCursorRef.current
      );
      customLetterCursorRef.current = nextIndex;
      const words = [...(WORDS_BY_LETTER[letter] || ['АРБУЗ', 'АИСТ'])].sort(
        () => Math.random() - 0.5
      );
      setCurrentLetter(letter);
      setLetterWordsPool(words);
      currentWordRef.current = words[0];
      setCurrentWord(words[0]);
      typedCharsRef.current = '';
      setTypedChars('');
      setWordsCompletedForLetter(0);
      setHintKey(null);
      return;
    }

    const lettersWithWords = RUSSIAN_ALPHABET.filter(l => WORDS_BY_LETTER[l]?.length > 0);
    const candidates = avoidLetter
      ? lettersWithWords.filter(l => l !== avoidLetter)
      : lettersWithWords;
    const randomLetter = candidates[Math.floor(Math.random() * candidates.length)] || 'К';

    const words = [...(WORDS_BY_LETTER[randomLetter] || ['КОТ', 'КИТ'])].sort(
      () => Math.random() - 0.5
    );
    setCurrentLetter(randomLetter);
    setLetterWordsPool(words);
    currentWordRef.current = words[0];
    setCurrentWord(words[0]);
    typedCharsRef.current = '';
    setTypedChars('');
    setWordsCompletedForLetter(0);
    setHintKey(null);
  }, [sprintSubMode, selectedLetters]);

  // Launch game with specific parameters (used both locally and from Co-op sync)
  const launchSprintSession = useCallback((params: {
    subMode: SprintSubMode;
    letters: string[];
    wordsGoal: number;
    mins: number;
    sequence: { letter: string; words: string[] }[];
  }) => {
    if (nextLetterTimeoutRef.current) {
      clearTimeout(nextLetterTimeoutRef.current);
      nextLetterTimeoutRef.current = null;
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    sharedSequenceRef.current = params.sequence;
    sequenceRoundIdxRef.current = 0;
    customLetterCursorRef.current = 0;

    setSprintSubMode(params.subMode);
    setSelectedLetters(params.letters);
    setWordsPerLetter(params.wordsGoal);
    setMinutesLimit(params.mins);

    setIsPlaying(true);
    setIsFinished(false);
    setHasSaved(false);
    setTotalWordsCompleted(0);
    setLettersMastered([]);
    setErrorsCount(0);
    setRemainingSeconds(params.mins * 60);
    startTimeRef.current = Date.now();

    const firstItem = params.sequence[0] || { letter: 'А', words: ['АРБУЗ', 'АИСТ'] };
    sequenceRoundIdxRef.current = 1;
    setCurrentLetter(firstItem.letter);
    setLetterWordsPool(firstItem.words);
    currentWordRef.current = firstItem.words[0];
    setCurrentWord(firstItem.words[0]);
    typedCharsRef.current = '';
    setTypedChars('');
    setWordsCompletedForLetter(0);
    setHintKey(null);

    onUpdateCoopSelfProgress?.({
      mode: 'letter_sprint',
      progressPercent: 0,
      wordsCompleted: 0,
      lettersMastered: 0,
      wpm: 0,
      cpm: 0,
      accuracy: 100,
      elapsedSeconds: 0,
      isFinished: false,
      finishedAt: undefined
    });

    if (soundEnabled) {
      if (params.subMode === 'custom_letters') {
        speakRussianText(`Начали! Тренируем выбранные буквы: ${params.letters.join(', ')}. Пиши слова!`);
      } else {
        speakRussianText(`Начали! Буква будет выбрана случайно. Пиши слова!`);
      }
    }
  }, [soundEnabled, onUpdateCoopSelfProgress]);

  // Start game session (triggered by button)
  const startGame = useCallback(() => {
    if (sprintSubMode === 'custom_letters' && selectedLetters.length === 0) return;

    const seq = generateSharedSprintSequence(sprintSubMode, selectedLetters, 40);

    if (isCoopRoomActive && isCoopHost) {
      onPublishCoopConfig?.(
        {
          mode: 'letter_sprint',
          sprintSubMode,
          sprintSelectedLetters: selectedLetters,
          sprintWordsPerLetter: wordsPerLetter,
          sprintMinutesLimit: minutesLimit,
          sprintSequence: seq,
          sprintStartedAt: Date.now()
        },
        true
      );
    }

    launchSprintSession({
      subMode: sprintSubMode,
      letters: selectedLetters,
      wordsGoal: wordsPerLetter,
      mins: minutesLimit,
      sequence: seq
    });
  }, [
    sprintSubMode,
    selectedLetters,
    wordsPerLetter,
    minutesLimit,
    isCoopRoomActive,
    isCoopHost,
    onPublishCoopConfig,
    launchSprintSession
  ]);

  // Publish settings changes from Host to Guest ONLY while in setup screen (not when finishing a round)
  useEffect(() => {
    if (isCoopRoomActive && isCoopHost && !isPlaying && !isFinished) {
      onPublishCoopConfig?.(
        {
          mode: 'letter_sprint',
          sprintSubMode,
          sprintSelectedLetters: selectedLetters,
          sprintWordsPerLetter: wordsPerLetter,
          sprintMinutesLimit: minutesLimit,
          sprintSequence: undefined,
          sprintStartedAt: undefined
        },
        false
      );
    }
  }, [isCoopRoomActive, isCoopHost, sprintSubMode, selectedLetters, wordsPerLetter, minutesLimit]);

  // Sync Guest settings and round start when Host publishes config
  useEffect(() => {
    if (!isCoopRoomActive || isCoopHost || !coopSharedConfig || coopSharedConfig.mode !== 'letter_sprint') return;
    if (coopSharedConfig.configId && coopSharedConfig.configId !== appliedConfigIdRef.current) {
      appliedConfigIdRef.current = coopSharedConfig.configId;
      const nextSub = coopSharedConfig.sprintSubMode || 'random';
      const nextLetters = coopSharedConfig.sprintSelectedLetters || ['А'];
      const nextWords = coopSharedConfig.sprintWordsPerLetter || 5;
      const nextMins = coopSharedConfig.sprintMinutesLimit || 5;

      // Only launch a new sprint session if Host explicitly started a new round with a new sprintStartedAt timestamp
      if (
        coopSharedConfig.sprintSequence &&
        coopSharedConfig.sprintSequence.length > 0 &&
        coopSharedConfig.sprintStartedAt &&
        coopSharedConfig.sprintStartedAt !== lastStartedSprintAtRef.current
      ) {
        lastStartedSprintAtRef.current = coopSharedConfig.sprintStartedAt;
        launchSprintSession({
          subMode: nextSub,
          letters: nextLetters,
          wordsGoal: nextWords,
          mins: nextMins,
          sequence: coopSharedConfig.sprintSequence
        });
      } else if (!isPlaying && !isFinished) {
        setSprintSubMode(nextSub);
        setSelectedLetters(nextLetters);
        setWordsPerLetter(nextWords);
        setMinutesLimit(nextMins);
      }
    }
  }, [isCoopRoomActive, isCoopHost, coopSharedConfig, launchSprintSession, isPlaying, isFinished]);

  // Also allow Host's "Начать игру" button in CoopBar to start the sprint (only when coopRoundTrigger increments)
  useEffect(() => {
    if (coopRoundTrigger > prevRoundTriggerRef.current) {
      prevRoundTriggerRef.current = coopRoundTrigger;
      if (isCoopRoomActive && isCoopHost) {
        startGame();
      }
    }
  }, [coopRoundTrigger, isCoopRoomActive, isCoopHost, startGame]);

  // Stop / Finish game session
  const finishGame = useCallback(() => {
    const finishNow = Date.now();
    if (nextLetterTimeoutRef.current) {
      clearTimeout(nextLetterTimeoutRef.current);
      nextLetterTimeoutRef.current = null;
    }
    setIsPlaying(false);
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    if (soundEnabled) {
      playAlarmBeep();
      setTimeout(() => playSuccessFanfare(), 300);
    }
    launchConfetti();

    const totalSec = minutesLimit * 60;
    const wpmCalc = Math.round(totalWordsCompleted / Math.max(0.5, minutesLimit));

    onUpdateCoopSelfProgress?.({
      mode: 'letter_sprint',
      progressPercent: 100,
      wordsCompleted: totalWordsCompleted,
      lettersMastered: lettersMastered.length,
      wpm: wpmCalc,
      cpm: wpmCalc * 5,
      elapsedSeconds: totalSec,
      isFinished: true,
      finishedAt: finishNow
    });

    // Calculate XP
    const earnedXp = totalWordsCompleted * 4 + lettersMastered.length * 15;
    onAddXp(earnedXp);
  }, [soundEnabled, totalWordsCompleted, lettersMastered.length, minutesLimit, onAddXp, onUpdateCoopSelfProgress]);

  const finishGameRef = useRef(finishGame);
  finishGameRef.current = finishGame;

  // Accurate wall-clock countdown timer effect (does not reset interval when words are typed)
  useEffect(() => {
    if (isPlaying && !isFinished) {
      const totalSec = minutesLimit * 60;
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const left = Math.max(0, totalSec - elapsed);
        setRemainingSeconds(left);
        if (left <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          finishGameRef.current();
        }
      }, 250);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isFinished, minutesLimit]);

  // If in Co-op mode and the partner's timer finishes while our timer is at the end (<= 2s), finish together cleanly
  useEffect(() => {
    if (isCoopRoomActive && isPlaying && !isFinished && coopPartner?.isFinished && remainingSeconds <= 2) {
      finishGameRef.current();
    }
  }, [isCoopRoomActive, isPlaying, isFinished, coopPartner?.isFinished, remainingSeconds]);

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

    const activeWord = currentWordRef.current;
    const newWordsOnLetter = wordsCompletedForLetter + 1;
    const newTotal = totalWordsCompleted + 1;
    setTotalWordsCompleted(newTotal);
    onWordCompleted?.(1, activeWord.length);

    const elapsedSec = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    const liveWpm = Math.round((newTotal / elapsedSec) * 60);

    if (newWordsOnLetter >= wordsPerLetter) {
      // Completed letter goal!
      if (soundEnabled) playSuccessFanfare();
      launchConfetti();
      onLetterMastered?.(currentLetter);
      const nextMasteredCount = lettersMastered.length + 1;

      onUpdateCoopSelfProgress?.({
        mode: 'letter_sprint',
        wordsCompleted: newTotal,
        lettersMastered: nextMasteredCount,
        wpm: liveWpm,
        cpm: liveWpm * 5,
        elapsedSeconds: elapsedSec
      });

      setLettersMastered(prev => {
        const nextList = [...prev, currentLetter];
        try {
          const todayKey = 'typecat_letters_daily_' + new Date().toISOString().slice(0, 10);
          const raw = localStorage.getItem(todayKey);
          const dailyList: string[] = raw ? JSON.parse(raw) : [];
          if (!dailyList.includes(currentLetter)) {
            dailyList.push(currentLetter);
            localStorage.setItem(todayKey, JSON.stringify(dailyList));
          }
          if (dailyList.length >= 10 || nextList.length >= 10) {
            onUnlockAchievement?.('letter_hunter');
          }
        } catch {
          if (nextList.length >= 10) {
            onUnlockAchievement?.('letter_hunter');
          }
        }
        return nextList;
      });

      // Pick next letter (from shared sequence or local mode)
      if (nextLetterTimeoutRef.current) {
        clearTimeout(nextLetterTimeoutRef.current);
      }
      nextLetterTimeoutRef.current = setTimeout(() => {
        pickNewLetter(currentLetter);
      }, 220);
    } else {
      setWordsCompletedForLetter(newWordsOnLetter);
      onUpdateCoopSelfProgress?.({
        mode: 'letter_sprint',
        wordsCompleted: newTotal,
        lettersMastered: lettersMastered.length,
        wpm: liveWpm,
        cpm: liveWpm * 5,
        elapsedSeconds: elapsedSec
      });
      const nextWord = letterWordsPool[newWordsOnLetter % letterWordsPool.length] || activeWord;
      currentWordRef.current = nextWord;
      setCurrentWord(nextWord);
      typedCharsRef.current = '';
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
    lettersMastered.length,
    pickNewLetter,
    onWordCompleted,
    onUnlockAchievement,
    onLetterMastered,
    onUpdateCoopSelfProgress
  ]);

  // Handle character input (uses ref-backed word/chars and supports Russian layout fallback)
  const handleCharInput = useCallback((char: string, keyCode?: string) => {
    const activeWord = currentWordRef.current;
    const activeTyped = typedCharsRef.current;
    if (!isPlaying || isFinished || !activeWord) return;
    if (activeTyped.length >= activeWord.length) return;

    const nextExpected = activeWord[activeTyped.length];
    if (matchesRussianTypedChar(char, nextExpected, keyCode)) {
      setHintKey(null);
      const newTyped = activeTyped + nextExpected;
      typedCharsRef.current = newTyped;
      setTypedChars(newTyped);

      if (newTyped === activeWord) {
        handleWordComplete();
      }
    } else {
      if (soundEnabled) playErrorTone();
      setErrorsCount(prev => prev + 1);
    }
  }, [isPlaying, isFinished, handleWordComplete, soundEnabled]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT') {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsPlaying(false);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (activeEl instanceof HTMLButtonElement) {
          activeEl.blur();
        }
        e.preventDefault();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        handleCharInput(e.key, e.code);
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
      details:
        sprintSubMode === 'custom_letters'
          ? `Выбор букв (${selectedLetters.join(', ')}): освоено ${lettersMastered.length}, слов: ${totalWordsCompleted}`
          : `Освоено букв: ${lettersMastered.length}, слов: ${totalWordsCompleted}`,
      createdAt: new Date().toISOString()
    };
    onSaveRecord(record);
    setHasSaved(true);
  };

  const expectedChar = isPlaying && !isFinished && currentWord ? currentWord[typedChars.length] : undefined;
  const currentEmoji = WORD_EMOJIS[currentWord] || '🔤';
  const learnedSet = new Set(learnedAlphabetLetters);

  const selfStateForWinner: CoopPlayerState = {
    playerId: 'self',
    name: playerName || user?.displayName || 'Ты',
    isHost: isCoopHost,
    color: 'orange',
    mode: 'letter_sprint',
    progressPercent: 100,
    wordsCompleted: totalWordsCompleted,
    lettersMastered: lettersMastered.length,
    wpm: Math.round(totalWordsCompleted / Math.max(0.5, minutesLimit)),
    cpm: Math.round(totalWordsCompleted / Math.max(0.5, minutesLimit)) * 5,
    accuracy: 98,
    elapsedSeconds: minutesLimit * 60,
    isFinished,
    sessionWordsTotal: 0,
    rewardSecondsTotal: 0,
    updatedAt: Date.now()
  };

  const coopWinner = isCoopRoomActive ? determineCoopWinner(selfStateForWinner, coopPartner) : null;

  return (
    <div translate="no" className="notranslate w-full max-w-5xl flex flex-col items-center gap-3">
      {/* Top Setting or Status Bar */}
      {!isPlaying && !isFinished ? (
        <div className="w-full bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col items-center gap-3.5">
          {/* Header & Sub-mode Tabs */}
          <div className="text-center max-w-2xl w-full flex flex-col items-center">
            <div className="flex items-center justify-center gap-2.5 mb-1">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-inner">
                <BookmarkCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Режим: Буквенный спринт
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-lg">
              {sprintSubMode === 'random'
                ? 'Котик случайно загадывает букву из алфавита. Напечатай заданное число слов на эту букву, чтобы открыть следующую!'
                : 'Выбери одну или несколько букв из алфавита. Слова на выбранные буквы будут гоняться по кругу всё время таймера!'}
            </p>

            {/* Sub-Mode Switcher (Подразделы буквенного спринта) */}
            <div className="mt-2.5 inline-flex p-1 bg-purple-50 rounded-2xl border border-purple-100 gap-1.5 flex-wrap justify-center">
              <button
                type="button"
                disabled={!canChangeSettings}
                onClick={() => setSprintSubMode('random')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 disabled:opacity-60 ${
                  sprintSubMode === 'random'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                    : 'text-purple-800 hover:bg-purple-100/80'
                }`}
              >
                <Shuffle className="w-4 h-4" />
                <span>Случайные буквы</span>
              </button>

              <button
                type="button"
                disabled={!canChangeSettings}
                onClick={() => setSprintSubMode('custom_letters')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 disabled:opacity-60 ${
                  sprintSubMode === 'custom_letters'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200'
                    : 'text-purple-800 hover:bg-purple-100/80'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Выбор букв (Обучение)</span>
              </button>
            </div>

            {!canChangeSettings && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>Настройки и буквы выбирает создатель комнаты — ждём старта!</span>
              </div>
            )}
          </div>

          {/* Custom Letter Selector Panel (only in 'custom_letters' sub-mode) */}
          {sprintSubMode === 'custom_letters' && (
            <div className="w-full max-w-3xl bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-purple-50/60 p-4 sm:p-5 rounded-2xl border border-amber-200/80 flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-slate-800">
                    Выбери буквы для тренировки:
                  </span>
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-extrabold">
                    {selectedLetters.length > 0
                      ? `Выбрано (${selectedLetters.length}): ${selectedLetters.slice(0, 12).join(', ')}${selectedLetters.length > 12 ? '...' : ''}`
                      : 'Ни одной буквы не выбрано'}
                  </span>
                </div>

                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Выучено по алфавиту: {learnedSet.size} / {RUSSIAN_ALPHABET.length}
                </span>
              </div>

              {/* Quick Preset Buttons */}
              {canChangeSettings && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedLetters([...VOWEL_LETTERS])}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 transition shadow-2xs"
                  >
                    Гласные (10)
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectNextUnlearned}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition shadow-2xs"
                  >
                    Следующие 5 по алфавиту
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLetters([...RUSSIAN_ALPHABET])}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition shadow-2xs"
                  >
                    Весь алфавит (33)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLetters([])}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border border-slate-200 transition"
                  >
                    Очистить
                  </button>
                </div>
              )}

              {/* 33-Letter Alphabet Grid */}
              <div className="grid grid-cols-7 sm:grid-cols-11 gap-1.5">
                {RUSSIAN_ALPHABET.map(letter => {
                  const isSelected = selectedLetters.includes(letter);
                  const isLearned = learnedSet.has(letter);
                  const orderIndex = selectedLetters.indexOf(letter);

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!canChangeSettings}
                      onClick={() => handleToggleSelectLetter(letter)}
                      aria-label={`Буква ${letter}`}
                      className={`relative h-10 sm:h-11 rounded-xl font-black text-sm sm:text-base transition transform active:scale-95 flex items-center justify-center border ${
                        isSelected
                          ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-orange-600 shadow-md shadow-amber-200/80 scale-105'
                          : isLearned
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                    >
                      <span>{letter}</span>
                      {isSelected && orderIndex >= 0 && selectedLetters.length <= 10 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-purple-700 text-white text-[9px] font-bold flex items-center justify-center shadow">
                          {orderIndex + 1}
                        </span>
                      )}
                      {!isSelected && isLearned && (
                        <span
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center"
                          title="Буква уже изучена"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                    type="button"
                    disabled={!canChangeSettings}
                    onClick={() => setWordsPerLetter(count)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition border disabled:opacity-60 ${
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

            {/* Time limit */}
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
                    type="button"
                    disabled={!canChangeSettings}
                    onClick={() => setMinutesLimit(mins)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition border disabled:opacity-60 ${
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

          {canChangeSettings ? (
            <button
              type="button"
              onClick={startGame}
              disabled={sprintSubMode === 'custom_letters' && selectedLetters.length === 0}
              className="px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-lg rounded-2xl shadow-lg shadow-purple-200 transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>
                {sprintSubMode === 'custom_letters' && selectedLetters.length === 0
                  ? 'Выбери хотя бы 1 букву'
                  : sprintSubMode === 'custom_letters'
                  ? `Начать обучение (${selectedLetters.length} букв)`
                  : 'Начать спринт'}
              </span>
            </button>
          ) : (
            <div className="px-6 py-3 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-2xl font-black text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Ожидаем, пока создатель комнаты нажмёт «Начать спринт»...</span>
            </div>
          )}
        </div>
      ) : isPlaying ? (
        <div className="w-full flex flex-col gap-3">
          {/* Header Stats Bar during game */}
          <div className="w-full bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
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

              {/* Active letters queue in Custom Letters mode */}
              {sprintSubMode === 'custom_letters' && selectedLetters.length > 0 && (
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl flex-wrap">
                  <span className="text-[11px] font-bold text-amber-800 mr-1">Буквы:</span>
                  {selectedLetters.slice(0, 12).map(letter => (
                    <span
                      key={letter}
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center transition ${
                        letter === currentLetter
                          ? 'bg-amber-500 text-white shadow-2xs scale-110'
                          : 'bg-white text-slate-600 border border-amber-200'
                      }`}
                    >
                      {letter}
                    </span>
                  ))}
                  {selectedLetters.length > 12 && (
                    <span className="text-[10px] font-bold text-amber-700 ml-1">
                      +{selectedLetters.length - 12}
                    </span>
                  )}
                </div>
              )}

              {/* Co-op Live Scoreboard Pill during Sprint */}
              {isCoopRoomActive && (
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl text-xs font-bold">
                  <span className="text-orange-700">🟠 Ты: <b>{totalWordsCompleted}</b> сл. ({lettersMastered.length} букв)</span>
                  <span className="text-indigo-300">|</span>
                  <span className="text-indigo-700">
                    🔵 {coopPartner ? `${coopPartner.name}: ` : 'Друг: '}
                    <b>{coopPartner?.wordsCompleted ?? 0}</b> сл. ({coopPartner?.lettersMastered ?? 0} букв)
                  </span>
                </div>
              )}
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
                type="button"
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
            <div className="flex items-center justify-center gap-1 text-5xl sm:text-6xl font-mono font-black tracking-widest my-2 flex-wrap">
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
                  type="button"
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
        /* Finish Summary Card (with Co-op Winner & Side-by-Side Comparison) */
        <div className="w-full bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col gap-5 animate-fade-in-up">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">⏱️</span>
                <h3 className="text-2xl font-black">
                  {isCoopRoomActive && coopPartner
                    ? coopWinner === 'self'
                      ? 'Ты победил в Буквенном спринте!'
                      : coopWinner === 'partner'
                      ? `Победил ${coopPartner.name}!`
                      : 'Дружеская ничья в спринте!'
                    : 'Время вышло! Отличный результат!'}
                </h3>
              </div>
              <p className="text-purple-100 text-sm max-w-lg leading-relaxed">
                Ты напечатал <b className="text-white text-base">{totalWordsCompleted} слов</b> и освоил{' '}
                <b className="text-white text-base">{lettersMastered.length} букв</b> (
                {Array.from(new Set(lettersMastered)).join(', ') || 'начал тренировку'}) за {minutesLimit} мин!
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveToLeaderboard}
                disabled={hasSaved}
                className={`px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition ${
                  hasSaved
                    ? 'bg-purple-900 text-white cursor-default'
                    : 'bg-white text-purple-900 hover:bg-purple-50 active:scale-95'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 ${hasSaved ? 'text-emerald-400' : 'hidden'}`} />
                <Trophy className={`w-5 h-5 text-amber-500 ${hasSaved ? 'hidden' : ''}`} />
                <span>{hasSaved ? 'Рекорд сохранён!' : 'В рекорды'}</span>
              </button>

              <button
                type="button"
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

          {isCoopRoomActive && coopPartner && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/20">
              <div className="bg-white/15 rounded-2xl p-3.5 border border-white/20">
                <div className="text-xs font-black uppercase text-amber-300 mb-1 flex items-center justify-between">
                  <span>🟠 Твой результат</span>
                  {coopWinner === 'self' && <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px]">🥇 1 место</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mt-2">
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Слов</div>
                    <div className="text-base font-mono font-black">{totalWordsCompleted}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Букв освоено</div>
                    <div className="text-base font-mono font-black">{lettersMastered.length}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">WPM</div>
                    <div className="text-base font-mono font-black">{selfStateForWinner.wpm}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/15 rounded-2xl p-3.5 border border-white/20">
                <div className="text-xs font-black uppercase text-sky-200 mb-1 flex items-center justify-between">
                  <span>🔵 Партнёр: {coopPartner.name}</span>
                  {coopWinner === 'partner' && <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px]">🥇 1 место</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mt-2">
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Слов</div>
                    <div className="text-base font-mono font-black">{coopPartner.wordsCompleted}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Букв освоено</div>
                    <div className="text-base font-mono font-black">{coopPartner.lettersMastered}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">WPM</div>
                    <div className="text-base font-mono font-black">{coopPartner.wpm}</div>
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
        disabled={!isPlaying || isFinished}
      />
    </div>
  );
};
