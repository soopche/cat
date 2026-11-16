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
  FileText
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
  onSpeedTextCompleted
}) => {
  const [selectedStoryId, setSelectedStoryId] = useState<string>(PRESET_STORIES[0].id);
  const [targetText, setTargetText] = useState<string>(() => sanitizeTypingText(PRESET_STORIES[0].text));
  const [typedText, setTypedText] = useState<string>('');
  const [errorsCount, setErrorsCount] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customTextDraft, setCustomTextDraft] = useState<string>('');
  const [wpm, setWpm] = useState<number>(0);
  const [cpm, setCpm] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(100);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const tabletInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typedTextRef = useRef<string>('');
  const errorsCountRef = useRef<number>(0);
  const lastKeydownTimeRef = useRef<number>(0);

  typedTextRef.current = typedText;
  errorsCountRef.current = errorsCount;

  // Reset or switch text
  const resetTest = useCallback((newText?: string) => {
    const rawToUse = newText !== undefined ? newText : targetText;
    const textToUse = sanitizeTypingText(rawToUse) || sanitizeTypingText(PRESET_STORIES[0].text);
    setTypedText('');
    typedTextRef.current = '';
    setErrorsCount(0);
    errorsCountRef.current = 0;
    setStartTime(null);
    setElapsedSeconds(0);
    setIsFinished(false);
    setWpm(0);
    setCpm(0);
    setAccuracy(100);
    setHasSaved(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setTargetText(textToUse);
  }, [targetText]);

  // Handle timer without resetting interval on every typed letter
  useEffect(() => {
    if (startTime && !isFinished) {
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
      };

      updateLiveMetrics();
      timerRef.current = setInterval(updateLiveMetrics, 400);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, isFinished]);

  // Complete handling
  const completeTyping = useCallback((finalErrors: number) => {
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = startTime ? Math.max(1, Math.round((Date.now() - startTime) / 1000)) : 1;
    const words = targetText.trim().split(/\s+/).length;
    const finalWpm = Math.round((words / duration) * 60);
    const finalCpm = Math.round((targetText.length / duration) * 60);
    const totalAttempts = targetText.length + finalErrors;
    const finalAcc = totalAttempts > 0 ? Math.round((targetText.length / totalAttempts) * 100) : 100;

    setElapsedSeconds(duration);
    setWpm(finalWpm);
    setCpm(finalCpm);
    setAccuracy(finalAcc);

    if (soundEnabled) playSuccessFanfare();
    launchConfetti();

    const xpEarned = Math.round(words * 2 + finalWpm * 0.5);
    onAddXp(xpEarned);
    onSpeedTextCompleted?.(finalWpm, finalAcc);
  }, [startTime, targetText, soundEnabled, onAddXp, onSpeedTextCompleted]);

  // Handle key press
  const handleCharInput = useCallback((char: string) => {
    if (isFinished || !targetText) return;

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
      setCpm(Math.round((nextTyped.length / secs) * 60));
      setWpm(Math.round((wordsNow / secs) * 60));

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
      }
    } else {
      if (soundEnabled) playErrorTone();
      const nextErr = errorsCountRef.current + 1;
      errorsCountRef.current = nextErr;
      setErrorsCount(nextErr);
      const totalAttempts = currentTyped.length + nextErr;
      if (totalAttempts > 0) {
        setAccuracy(Math.round((currentTyped.length / totalAttempts) * 100));
      }
    }
  }, [isFinished, startTime, targetText, soundEnabled, completeTyping, onWordCompleted]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCustomModal) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'TEXTAREA' || (activeTag === 'INPUT' && document.activeElement !== tabletInputRef.current)) {
        return;
      }

      if (e.key === 'Escape') {
        resetTest();
        return;
      }

      // Prevent Enter from clicking any previously focused button
      if (e.key === 'Enter') {
        e.preventDefault();
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
  }, [handleCharInput, resetTest, showCustomModal]);

  // Tablet / Android Chrome IME fallback input handler (when keydown sends 'Unidentified' / keyCode 229)
  const handleTabletInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    e.target.value = '';
    if (!val || showCustomModal) return;
    // Skip if physical keydown already processed this keystroke within the last 25ms
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
          resetTest(sanitized);
          setSelectedStoryId('custom');
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
    resetTest(pick.text);
    setSelectedStoryId('generated');
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

  const currentChar = !isFinished && typedText.length < targetText.length
    ? targetText[typedText.length]
    : undefined;

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
              onClick={(e) => {
                e.currentTarget.blur();
                setSelectedStoryId(story.id);
                resetTest(story.text);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border ${
                selectedStoryId === story.id
                  ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {story.title}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
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

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              resetTest();
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
          if (isMobileMode) {
            tabletInputRef.current?.focus({ preventScroll: true });
          }
        }}
        className="notranslate w-full bg-white rounded-3xl p-5 sm:p-7 shadow-md border-2 border-slate-200/90 min-h-[170px] relative font-sans text-lg sm:text-xl leading-relaxed select-none overflow-y-auto max-h-[300px]"
      >
        {!startTime && typedText.length === 0 && (
          <div className="mb-2 flex items-center justify-end">
            <div className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-bold animate-pulse">
              <Zap className="w-3.5 h-3.5" />
              Начни печатать любой символ, чтобы запустить таймер!
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

      {/* Completion Modal / Banner */}
      {isFinished && (
        <div className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">🎉</span>
              <h3 className="text-2xl font-black">Поздравляем! Текст завершён!</h3>
            </div>
            <p className="text-emerald-100 text-sm">
              Ты напечатал весь рассказ со скоростью <b className="text-white text-base">{wpm} WPM</b> ({cpm} зн/мин) 
              и точностью <b className="text-white text-base">{accuracy}%</b> за {elapsedSeconds} сек!
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

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                resetTest();
              }}
              className="px-4 py-2.5 bg-emerald-800/60 hover:bg-emerald-800 text-white rounded-2xl font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Ещё раз</span>
            </button>
          </div>
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
        disabled={isFinished}
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
                        resetTest(sanitized);
                        setSelectedStoryId('custom');
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
