import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Zap, 
  RotateCcw, 
  Sparkles, 
  Upload, 
  BookOpen, 
  Trophy, 
  CheckCircle, 
  Play, 
  FileText,
  Users,
  Crown
} from 'lucide-react';
import { PRESET_STORIES } from '../data/words';
import { VirtualKeyboard } from './VirtualKeyboard';
import { 
  playCorrectBeep, 
  playErrorTone, 
  playSuccessFanfare, 
  launchConfetti
} from '../utils/soundAndEffects';
import { ScoreRecord } from '../firebase';
import { User } from 'firebase/auth';
import {
  CoopPlayerState,
  CoopGameConfig,
  determineCoopWinner
} from '../utils/mqttCoopRoom';

interface SpeedTextModeProps {
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
  onSpeedTextCompleted?: (wpm: number, accuracy: number) => void;
  // Co-op props
  isCoopRoomActive?: boolean;
  isCoopHost?: boolean;
  coopPartner?: CoopPlayerState | null;
  coopSharedConfig?: CoopGameConfig | null;
  coopRoundTrigger?: number;
  onPublishCoopConfig?: (config: Partial<CoopGameConfig>, startRound?: boolean) => void;
  onUpdateCoopSelfProgress?: (patch: Partial<CoopPlayerState>) => void;
}

// Sanitize custom or preset text so uncommon typographic symbols don't trap the user on tablet/desktop keyboards
export function sanitizeTypingText(raw: string): string {
  return raw
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/[—–−]/g, '-')
    .replace(/[«»„“”"]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

export const SpeedTextMode: React.FC<SpeedTextModeProps> = ({
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
  onSpeedTextCompleted,
  isCoopRoomActive = false,
  isCoopHost = false,
  coopPartner = null,
  coopSharedConfig = null,
  coopRoundTrigger = 0,
  onPublishCoopConfig,
  onUpdateCoopSelfProgress
}) => {
  const [selectedStoryId, setSelectedStoryId] = useState<string>(PRESET_STORIES[0].id);
  const [targetText, setTargetText] = useState<string>(() => sanitizeTypingText(PRESET_STORIES[0].text));
  const [typedText, setTypedText] = useState<string>('');
  const [errorsCount, setErrorsCount] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [finishedAtTime, setFinishedAtTime] = useState<number | undefined>(undefined);
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customTextDraft, setCustomTextDraft] = useState<string>('');
  const [wpm, setWpm] = useState<number>(0);
  const [cpm, setCpm] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(100);
  const [hasSaved, setHasSaved] = useState<boolean>(false);
  const [racePhase, setRacePhase] = useState<'ready' | 'countdown' | 'racing'>('ready');
  const [countdownValue, setCountdownValue] = useState<number>(3);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const tabletInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const racePhaseRef = useRef<'ready' | 'countdown' | 'racing'>('ready');
  const typedTextRef = useRef<string>('');
  const errorsCountRef = useRef<number>(0);
  const lastKeydownTimeRef = useRef<number>(0);
  const appliedConfigIdRef = useRef<string>('');
  const lastStartedRoundAtRef = useRef<number>(0);
  const prevRoundTriggerRef = useRef<number>(coopRoundTrigger);

  racePhaseRef.current = racePhase;
  typedTextRef.current = typedText;
  errorsCountRef.current = errorsCount;

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Reset or switch text (returns to 'ready' preparation phase)
  const resetTest = useCallback((newText?: string, broadcastToCoop: boolean = false, newStoryId?: string) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const rawToUse = newText !== undefined ? newText : targetText;
    const textToUse = sanitizeTypingText(rawToUse) || sanitizeTypingText(PRESET_STORIES[0].text);
    setTypedText('');
    typedTextRef.current = '';
    setErrorsCount(0);
    errorsCountRef.current = 0;
    setStartTime(null);
    setElapsedSeconds(0);
    setIsFinished(false);
    setFinishedAtTime(undefined);
    setWpm(0);
    setCpm(0);
    setAccuracy(100);
    setHasSaved(false);
    setRacePhase('ready');
    racePhaseRef.current = 'ready';
    setCountdownValue(3);
    setTargetText(textToUse);

    onUpdateCoopSelfProgress?.({
      mode: 'speed_text',
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
          mode: 'speed_text',
          speedStoryId: newStoryId || selectedStoryId,
          speedTargetText: textToUse,
          sprintStartedAt: undefined
        },
        false
      );
    }
  }, [targetText, isCoopRoomActive, isCoopHost, selectedStoryId, onPublishCoopConfig, onUpdateCoopSelfProgress]);

  // Launch 3, 2, 1 countdown and then unlock typing + start timer simultaneously
  const beginCountdown = useCallback((textOverride?: string, storyIdOverride?: string) => {
    const activeEl = document.activeElement;
    if (
      activeEl instanceof HTMLElement &&
      activeEl !== tabletInputRef.current &&
      (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'INPUT')
    ) {
      activeEl.blur();
    }

    resetTest(textOverride, false, storyIdOverride);
    setRacePhase('countdown');
    racePhaseRef.current = 'countdown';
    setCountdownValue(3);
    if (soundEnabled) playCorrectBeep();

    let count = 3;
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count >= 1) {
        setCountdownValue(count);
        if (soundEnabled) playCorrectBeep();
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setRacePhase('racing');
        racePhaseRef.current = 'racing';
        setStartTime(Date.now());
        if (soundEnabled) playCorrectBeep();
        if (isMobileMode) {
          tabletInputRef.current?.focus({ preventScroll: true });
        }
      }
    }, 1000);
  }, [resetTest, soundEnabled, isMobileMode]);

  // Start button handler (Solo or Co-op Host)
  const handleStartRace = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.currentTarget.blur();
    if (isCoopRoomActive && isCoopHost) {
      const startedAt = Date.now();
      lastStartedRoundAtRef.current = startedAt;
      onPublishCoopConfig?.(
        {
          mode: 'speed_text',
          speedStoryId: selectedStoryId,
          speedTargetText: targetText,
          sprintStartedAt: startedAt
        },
        true
      );
    }
    beginCountdown(targetText, selectedStoryId);
  }, [isCoopRoomActive, isCoopHost, selectedStoryId, targetText, onPublishCoopConfig, beginCountdown]);

  // Sync when Co-op shared config updates (Guest round start or story selection)
  useEffect(() => {
    if (!isCoopRoomActive || isCoopHost || !coopSharedConfig || coopSharedConfig.mode !== 'speed_text') return;
    if (coopSharedConfig.configId && coopSharedConfig.configId !== appliedConfigIdRef.current) {
      appliedConfigIdRef.current = coopSharedConfig.configId;
      if (coopSharedConfig.speedStoryId) {
        setSelectedStoryId(coopSharedConfig.speedStoryId);
      }

      if (
        coopSharedConfig.sprintStartedAt &&
        coopSharedConfig.sprintStartedAt !== lastStartedRoundAtRef.current
      ) {
        lastStartedRoundAtRef.current = coopSharedConfig.sprintStartedAt;
        beginCountdown(coopSharedConfig.speedTargetText || targetText, coopSharedConfig.speedStoryId);
        return;
      }

      if (!isFinished && racePhaseRef.current === 'ready' && coopSharedConfig.speedTargetText) {
        resetTest(coopSharedConfig.speedTargetText, false);
      }
    }
  }, [isCoopRoomActive, isCoopHost, coopSharedConfig, isFinished, targetText, resetTest, beginCountdown]);

  // Also launch 3-2-1 countdown when Host clicks "Начать игру" in CoopBar
  useEffect(() => {
    if (coopRoundTrigger > 0 && coopRoundTrigger !== prevRoundTriggerRef.current && isCoopRoomActive) {
      prevRoundTriggerRef.current = coopRoundTrigger;
      if (isCoopHost) {
        handleStartRace();
      } else {
        beginCountdown(coopSharedConfig?.speedTargetText || targetText, coopSharedConfig?.speedStoryId);
      }
    }
  }, [coopRoundTrigger, isCoopRoomActive, isCoopHost, handleStartRace, beginCountdown, coopSharedConfig, targetText]);

  // Publish initial host config when entering SpeedTextMode as Host
  useEffect(() => {
    if (isCoopRoomActive && isCoopHost && racePhase === 'ready' && !isFinished) {
      onPublishCoopConfig?.(
        {
          mode: 'speed_text',
          speedStoryId: selectedStoryId,
          speedTargetText: targetText,
          sprintStartedAt: undefined
        },
        false
      );
    }
  }, [isCoopRoomActive, isCoopHost]);

  // Handle timer without resetting interval on every typed letter
  useEffect(() => {
    if (startTime && !isFinished && racePhase === 'racing') {
      const updateLiveMetrics = () => {
        const seconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        setElapsedSeconds(seconds);

        const chars = typedTextRef.current.length;
        const words = typedTextRef.current.trim().split(/\s+/).filter(Boolean).length;
        const currentCpm = Math.round((chars / seconds) * 60);
        const currentWpm = Math.round((words / seconds) * 60);
        setCpm(currentCpm);
        setWpm(currentWpm);

        const totalAttempts = chars + errorsCountRef.current;
        const acc = totalAttempts > 0 ? Math.round((chars / totalAttempts) * 100) : 100;
        setAccuracy(acc);

        const pct = Math.min(100, Math.round((chars / Math.max(1, targetText.length)) * 100));
        onUpdateCoopSelfProgress?.({
          mode: 'speed_text',
          progressPercent: pct,
          wordsCompleted: words,
          wpm: currentWpm,
          cpm: currentCpm,
          accuracy: acc,
          elapsedSeconds: seconds,
          isFinished: false
        });
      };

      updateLiveMetrics();
      timerRef.current = setInterval(updateLiveMetrics, 400);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, isFinished, racePhase, targetText.length, onUpdateCoopSelfProgress]);

  // Complete handling
  const completeTyping = useCallback((finalErrors: number) => {
    const finishNow = Date.now();
    setIsFinished(true);
    setFinishedAtTime(finishNow);
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = startTime ? Math.max(1, Math.round((finishNow - startTime) / 1000)) : 1;
    const words = targetText.trim().split(/\s+/).length;
    const finalWpm = Math.round((words / duration) * 60);
    const finalCpm = Math.round((targetText.length / duration) * 60);
    const totalAttempts = targetText.length + finalErrors;
    const finalAcc = totalAttempts > 0 ? Math.round((targetText.length / totalAttempts) * 100) : 100;

    setElapsedSeconds(duration);
    setWpm(finalWpm);
    setCpm(finalCpm);
    setAccuracy(finalAcc);

    onUpdateCoopSelfProgress?.({
      mode: 'speed_text',
      progressPercent: 100,
      wordsCompleted: words,
      wpm: finalWpm,
      cpm: finalCpm,
      accuracy: finalAcc,
      elapsedSeconds: duration,
      isFinished: true,
      finishedAt: finishNow
    });

    if (soundEnabled) playSuccessFanfare();
    launchConfetti();

    const xpEarned = Math.round(words * 2 + finalWpm * 0.5);
    onAddXp(xpEarned);
    onSpeedTextCompleted?.(finalWpm, finalAcc);
  }, [startTime, targetText, soundEnabled, onAddXp, onSpeedTextCompleted, onUpdateCoopSelfProgress]);

  // Handle key press (only active after 3-2-1 countdown finishes)
  const handleCharInput = useCallback((char: string) => {
    if (isFinished || !targetText || racePhaseRef.current !== 'racing') return;

    const now = Date.now();
    const effectiveStart = startTime ?? now;
    if (!startTime) {
      setStartTime(now);
    }

    const currentTyped = typedTextRef.current;
    const expectedChar = targetText[currentTyped.length];
    if (expectedChar === undefined) return;

    // Allow matching exact char, or 'е'/'ё' equivalence on tablet keyboards that lack dedicated 'ё'
    const normalizedInput = char === '\u00A0' ? ' ' : char;
    const normalizedExpected = expectedChar === '\u00A0' ? ' ' : expectedChar;
    const isYoEquivalent =
      (normalizedExpected === 'ё' && normalizedInput === 'е') ||
      (normalizedExpected === 'Ё' && normalizedInput === 'Е');

    const match = normalizedInput === normalizedExpected || isYoEquivalent;

    if (match) {
      if (soundEnabled) playCorrectBeep();
      const nextTyped = currentTyped + expectedChar;
      typedTextRef.current = nextTyped;
      setTypedText(nextTyped);

      // Update live stats immediately so WPM/CPM feel responsive on every keystroke
      const secs = Math.max(1, (now - effectiveStart) / 1000);
      const wordsNow = nextTyped.trim().split(/\s+/).filter(Boolean).length;
      const liveCpm = Math.round((nextTyped.length / secs) * 60);
      const liveWpm = Math.round((wordsNow / secs) * 60);
      setCpm(liveCpm);
      setWpm(liveWpm);

      const pct = Math.min(100, Math.round((nextTyped.length / Math.max(1, targetText.length)) * 100));

      if (expectedChar === ' ') {
        const lastWord = targetText.slice(0, currentTyped.length).trim().split(/\s+/).pop() || '';
        if (lastWord) {
          onWordCompleted?.(1, lastWord.length);
        }
      } else if (nextTyped.length === targetText.length) {
        const lastWord = targetText.slice(0, nextTyped.length).trim().split(/\s+/).pop() || '';
        if (lastWord) {
          onWordCompleted?.(1, lastWord.length);
        }
        completeTyping(errorsCountRef.current);
        return;
      }

      onUpdateCoopSelfProgress?.({
        mode: 'speed_text',
        progressPercent: pct,
        wordsCompleted: wordsNow,
        wpm: liveWpm,
        cpm: liveCpm,
        currentTargetWord: targetText,
        currentTypedText: nextTyped,
        errorsCount: errorsCountRef.current
      });
    } else {
      if (soundEnabled) playErrorTone();
      const nextErr = errorsCountRef.current + 1;
      errorsCountRef.current = nextErr;
      setErrorsCount(nextErr);
      const totalAttempts = currentTyped.length + nextErr;
      if (totalAttempts > 0) {
        setAccuracy(Math.round((currentTyped.length / totalAttempts) * 100));
      }
      onUpdateCoopSelfProgress?.({
        mode: 'speed_text',
        errorsCount: nextErr
      });
    }
  }, [isFinished, startTime, targetText, soundEnabled, completeTyping, onWordCompleted, onUpdateCoopSelfProgress]);

  // Sync current target text and typed text for Teacher Study Mode
  useEffect(() => {
    if (!onUpdateCoopSelfProgress || !targetText) return;
    onUpdateCoopSelfProgress({
      mode: 'speed_text',
      currentTargetWord: targetText,
      currentTypedText: typedText,
      errorsCount
    });
  }, [targetText, typedText, errorsCount, onUpdateCoopSelfProgress]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCustomModal) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'TEXTAREA' || (activeTag === 'INPUT' && document.activeElement !== tabletInputRef.current)) {
        return;
      }

      if (e.key === 'Escape') {
        resetTest(targetText, isCoopHost, selectedStoryId);
        return;
      }

      // Prevent Enter from clicking any previously focused button
      if (e.key === 'Enter') {
        e.preventDefault();
        return;
      }

      if (racePhaseRef.current !== 'racing') {
        if (e.key === ' ') e.preventDefault();
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        lastKeydownTimeRef.current = Date.now();
        handleCharInput(' ');
        return;
      }

      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        lastKeydownTimeRef.current = Date.now();
        handleCharInput(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCharInput, resetTest, showCustomModal, targetText, isCoopHost, selectedStoryId]);

  // Tablet / Android Chrome IME fallback input handler
  const handleTabletInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    e.target.value = '';
    if (!val || showCustomModal || racePhaseRef.current !== 'racing') return;
    if (Date.now() - lastKeydownTimeRef.current < 25) return;
    const lastChar = val[val.length - 1];
    if (lastChar) {
      handleCharInput(lastChar);
    }
  };

  // Load custom story file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && content.trim().length > 0) {
        const sanitized = sanitizeTypingText(content);
        if (sanitized) {
          setSelectedStoryId('custom');
          resetTest(sanitized, true, 'custom');
          setShowCustomModal(false);
          setCustomTextDraft('');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Simple child-friendly stories generator
  const handleGenerateStory = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    const themes = [
      {
        title: "Солнечный зайчик",
        text: "Маленький солнечный зайчик прыгал по комнате. Он весело заглянул в круглое зеркало и прыгнул на пушистый ковёр. Котёнок Пушок вытянул мягкую лапку и хотел поймать тёплый лучик. Зайчик блеснул на потолке и звонко рассмеялся."
      },
      {
        title: "Космический друг",
        text: "В далёкой галактике летал весёлый робот по имени Блип. У него были добрые зелёные глазки и маленькие антенны. Робот собирал звёздную пыльцу и поливал космические цветы. Каждый вечер он махал Земле своей железной ручкой."
      },
      {
        title: "Ёжик и сладкая малина",
        text: "Колючий ёжик гулял по лесной тропинке. Возле высокой сосны он увидел спелую красную малинку. Ёжик сорвал ягодку и положил в плетёную корзинку. Дома мама сварит вкусный чай для всей дружной семьи."
      }
    ];
    const pick = themes[Math.floor(Math.random() * themes.length)];
    setSelectedStoryId('generated');
    resetTest(pick.text, true, 'generated');
  };

  const handleSaveToLeaderboard = () => {
    if (hasSaved) return;
    const effectiveName = (playerName && playerName.trim()) || user?.displayName || 'Юный мастер печати';
    const record: ScoreRecord = {
      id: 'speed_' + Date.now(),
      userId: user ? user.uid : 'guest_' + Math.random().toString(36).substring(2, 8),
      userName: effectiveName,
      userPhoto: user?.photoURL || undefined,
      mode: 'speed_text',
      wpm,
      cpm,
      accuracy,
      wordsCount: targetText.trim().split(/\s+/).length,
      timeSeconds: Math.max(1, elapsedSeconds),
      details: `Текст: ${targetText.slice(0, 30)}...`,
      createdAt: new Date().toISOString()
    };
    onSaveRecord(record);
    setHasSaved(true);
  };

  const currentChar = !isFinished && racePhase === 'racing' && typedText.length < targetText.length
    ? targetText[typedText.length]
    : undefined;

  const myProgressPct = Math.min(100, Math.round((typedText.length / Math.max(1, targetText.length)) * 100));
  const partnerProgressPct = coopPartner?.progressPercent ?? 0;

  const canChangeSettings = !isCoopRoomActive || isCoopHost;

  const selfStateForWinner: CoopPlayerState = {
    playerId: 'self',
    name: playerName || user?.displayName || 'Ты',
    isHost: isCoopHost,
    color: 'orange',
    mode: 'speed_text',
    progressPercent: myProgressPct,
    wordsCompleted: typedText.trim().split(/\s+/).filter(Boolean).length,
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
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".txt"
        className="hidden"
      />

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

      {/* Mode Bar & Story Selector */}
      <div className="w-full bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
            <BookOpen className="w-4 h-4 text-blue-500" />
            Выбор рассказа:
          </span>

          {PRESET_STORIES.map(story => (
            <button
              key={story.id}
              type="button"
              disabled={!canChangeSettings}
              onClick={(e) => {
                e.currentTarget.blur();
                setSelectedStoryId(story.id);
                resetTest(story.text, true, story.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border disabled:opacity-60 ${
                selectedStoryId === story.id
                  ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {story.title}
            </button>
          ))}

          {!canChangeSettings && (
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              Рассказ выбирает создатель комнаты
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {canChangeSettings && (
            <>
              <button
                type="button"
                onClick={handleGenerateStory}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition shadow-sm"
                title="Сгенерировать новый простой детский рассказ"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Генерировать</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setShowCustomModal(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-sm"
                title="Ввести или загрузить свой собственный текст"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Свой текст</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              resetTest(targetText, isCoopHost, selectedStoryId);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
            }}
            className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition"
            title="Начать сначала (Esc)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Co-op Dual Race Track when in a Co-op Room */}
      {isCoopRoomActive && (
        <div className="w-full bg-white rounded-2xl p-3.5 shadow-sm border-2 border-indigo-100 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
            <span className="flex items-center gap-1.5 text-indigo-700 font-black uppercase">
              <Users className="w-4 h-4 text-indigo-600" />
              Совместная гонка по тексту
            </span>
            {coopPartner ? (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-extrabold">
                {myProgressPct > partnerProgressPct
                  ? `🥇 Ты впереди (${myProgressPct}% против ${partnerProgressPct}%)`
                  : partnerProgressPct > myProgressPct
                  ? `🥇 Лидирует ${coopPartner.name} (${partnerProgressPct}% против ${myProgressPct}%)`
                  : `⚡ Идёте наравне (${myProgressPct}%)`}
              </span>
            ) : (
              <span className="text-slate-400">Ожидание второго игрока в комнате...</span>
            )}
          </div>

          {/* Player 1 (Self - Orange Cat) */}
          <div className="flex items-center gap-2.5">
            <span className="w-28 truncate text-xs font-black text-orange-700 flex items-center gap-1">
              <span>🐱</span>
              <span>Ты ({wpm} WPM)</span>
            </span>
            <div className="relative flex-1 h-6 bg-orange-50 rounded-full overflow-hidden border border-orange-200 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${myProgressPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 text-base transition-all duration-300 select-none"
                style={{ left: `clamp(4px, calc(${myProgressPct}% - 12px), calc(100% - 28px))` }}
              >
                🐱
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">🏁</div>
            </div>
            <span className="w-10 text-right font-mono text-xs font-black text-orange-700">{myProgressPct}%</span>
          </div>

          {/* Player 2 (Partner - Blue Cat) */}
          <div className="flex items-center gap-2.5">
            <span className="w-28 truncate text-xs font-black text-indigo-700 flex items-center gap-1">
              <span>🐾</span>
              <span>{coopPartner ? `${coopPartner.name} (${coopPartner.wpm} WPM)` : 'Друг...'}</span>
            </span>
            <div className="relative flex-1 h-6 bg-indigo-50 rounded-full overflow-hidden border border-indigo-200 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${partnerProgressPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 text-base transition-all duration-300 select-none"
                style={{ left: `clamp(4px, calc(${partnerProgressPct}% - 12px), calc(100% - 28px))` }}
              >
                🐾
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">🏁</div>
            </div>
            <span className="w-10 text-right font-mono text-xs font-black text-indigo-700">{partnerProgressPct}%</span>
          </div>
        </div>
      )}

      {/* Live Stats Display Dashboard */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Скорость WPM</div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 font-mono">
              {wpm} <span className="text-xs font-semibold text-slate-400">слов/мин</span>
            </div>
          </div>
          <div className="p-2 bg-blue-50 text-blue-500 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Символов CPM</div>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 font-mono">
              {cpm} <span className="text-xs font-semibold text-slate-400">зн/мин</span>
            </div>
          </div>
          <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Точность</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
              {accuracy}%
            </div>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Время</div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 font-mono">
              {Math.floor(elapsedSeconds / 60)}:
              {(elapsedSeconds % 60).toString().padStart(2, '0')}
            </div>
          </div>
          <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
            <Play className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Text Presentation Box */}
      <div 
        ref={textContainerRef}
        translate="no"
        onClick={() => {
          if (isMobileMode && racePhase === 'racing') {
            tabletInputRef.current?.focus({ preventScroll: true });
          }
        }}
        className="notranslate w-full bg-white rounded-3xl p-5 sm:p-7 shadow-md border-2 border-slate-200/90 min-h-[170px] relative font-sans text-lg sm:text-xl leading-relaxed select-none overflow-y-auto max-h-[300px]"
      >
        {!isFinished && racePhase === 'ready' && (
          <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700">
              <Zap className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {isCoopRoomActive && !isCoopHost
                  ? 'Приготовь пальцы! Ожидаем старт (3, 2, 1) от создателя комнаты или нажми Старт:'
                  : 'Приготовь пальцы на клавиатуре! Нажми «Старт» для отсчёта 3, 2, 1:'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleStartRace}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
              }}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm shadow-md active:scale-95 transition flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Старт (3, 2, 1)</span>
            </button>
          </div>
        )}

        {!isFinished && racePhase === 'countdown' && (
          <div className="mb-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg flex items-center justify-center gap-4 animate-pulse">
            <span className="text-3xl sm:text-4xl font-black font-mono bg-white text-orange-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-md">
              {countdownValue}
            </span>
            <div className="text-left">
              <div className="text-sm sm:text-base font-black uppercase tracking-wide">
                Приготовься! Старт через {countdownValue}...
              </div>
              <div className="text-xs text-amber-100 font-semibold">
                Поставь пальцы на стартовую позицию!
              </div>
            </div>
          </div>
        )}

        {!isFinished && racePhase === 'racing' && typedText.length === 0 && (
          <div className="mb-2 flex items-center justify-end">
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-black animate-bounce">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              🏁 СТАРТ! Печатай текст!
            </div>
          </div>
        )}

        <div translate="no" className="notranslate tracking-wide whitespace-pre-wrap break-words">
          {targetText.split('').map((char, idx) => {
            let className = "notranslate transition-colors duration-150 ";
            if (idx < typedText.length) {
              className += "text-emerald-600 font-semibold bg-emerald-50/60 rounded ";
            } else if (idx === typedText.length) {
              className += "text-blue-900 bg-blue-200/80 rounded px-0.5 border-b-4 border-blue-600 font-bold animate-pulse ";
            } else {
              className += "text-slate-400 ";
            }

            return (
              <span key={idx} translate="no" className={className}>
                {char}
              </span>
            );
          })}
        </div>
      </div>

      {/* Completion Modal / Banner (includes Co-op Winner & Partner Stats Comparison) */}
      {(isFinished || (isCoopRoomActive && coopPartner?.isFinished)) && (
        <div className="w-full bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl flex flex-col gap-4 animate-fade-in-up">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">🏆</span>
                <h3 className="text-2xl font-black">
                  {isCoopRoomActive && coopPartner
                    ? coopWinner === 'self'
                      ? 'Ты победил в гонке текста!'
                      : coopWinner === 'partner'
                      ? `Победил ${coopPartner.name}!`
                      : 'Дружеская ничья!'
                    : 'Поздравляем! Текст завершён!'}
                </h3>
              </div>
              <p className="text-emerald-100 text-sm">
                Твой результат: <b className="text-white text-base">{wpm} WPM</b> ({cpm} зн/мин), точность{' '}
                <b className="text-white text-base">{accuracy}%</b>, время {elapsedSeconds} сек.
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
                  className={`px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition ${
                    hasSaved
                      ? 'bg-emerald-700/80 text-white cursor-default'
                      : 'bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95'
                  }`}
                >
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span>{hasSaved ? 'Рекорд в Топ-50!' : 'Сохранить в рекорд'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  resetTest(targetText, isCoopHost, selectedStoryId);
                }}
                className="px-4 py-2.5 bg-emerald-800/60 hover:bg-emerald-800 text-white rounded-2xl font-bold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ещё раз</span>
              </button>
            </div>
          </div>

          {/* Side-by-side Co-op Statistics Comparison */}
          {isCoopRoomActive && coopPartner && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/20">
              <div className="bg-white/15 rounded-2xl p-3.5 border border-white/20">
                <div className="text-xs font-black uppercase text-amber-300 mb-1 flex items-center justify-between">
                  <span>🐱 Твоя статистика</span>
                  {coopWinner === 'self' && <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px]">🥇 1 место</span>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center mt-2">
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">WPM</div>
                    <div className="text-base font-mono font-black">{wpm}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">CPM</div>
                    <div className="text-base font-mono font-black">{cpm}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Точность</div>
                    <div className="text-base font-mono font-black">{accuracy}%</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Прогресс</div>
                    <div className="text-base font-mono font-black">{myProgressPct}%</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/15 rounded-2xl p-3.5 border border-white/20">
                <div className="text-xs font-black uppercase text-sky-200 mb-1 flex items-center justify-between">
                  <span>🐾 Партнёр: {coopPartner.name}</span>
                  {coopWinner === 'partner' && <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px]">🥇 1 место</span>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center mt-2">
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">WPM</div>
                    <div className="text-base font-mono font-black">{coopPartner.wpm}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">CPM</div>
                    <div className="text-base font-mono font-black">{coopPartner.cpm}</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Точность</div>
                    <div className="text-base font-mono font-black">{coopPartner.accuracy}%</div>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2">
                    <div className="text-[10px] text-white/70">Прогресс</div>
                    <div className="text-base font-mono font-black">{coopPartner.progressPercent}%</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Virtual Keyboard */}
      <VirtualKeyboard
        currentExpectedChar={currentChar}
        hintKey={null}
        onKeyPress={handleCharInput}
        isMobileMode={isMobileMode}
        onToggleMobileMode={onToggleMobileMode}
        kbScale={kbScale}
        onSetKbScale={onSetKbScale}
        disabled={isFinished || racePhase !== 'racing'}
      />

      {/* Custom Text Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Загрузить или ввести свой текст
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Вставь любимую сказку или нажми «Загрузить .txt», чтобы тренировать печать на своих материалах!
            </p>

            <textarea
              rows={5}
              value={customTextDraft}
              onChange={(e) => setCustomTextDraft(e.target.value)}
              placeholder="Вставь сюда текст на русском языке..."
              className="w-full border-2 border-slate-300 rounded-2xl p-3 text-sm focus:border-emerald-500 focus:outline-none mb-3 font-sans"
            />

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Upload className="w-4 h-4" />
                <span>Файл .txt</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (customTextDraft.trim().length > 0) {
                      const sanitized = sanitizeTypingText(customTextDraft);
                      if (sanitized) {
                        setSelectedStoryId('custom');
                        resetTest(sanitized, true, 'custom');
                        setShowCustomModal(false);
                        setCustomTextDraft('');
                      }
                    }
                  }}
                  disabled={!customTextDraft.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  Применить текст
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
