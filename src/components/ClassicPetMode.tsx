import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Heart, 
  BedDouble, 
  Dribbble, 
  ShowerHead, 
  Brain, 
  Fish, 
  Volume2, 
  ArrowRight, 
  Mic, 
  Square, 
  PenTool, 
  Dog, 
  Briefcase, 
  Smile, 
  Trees, 
  Home, 
  Eye, 
  Calculator,
  Mail,
  X,
  Sparkles,
  MessageSquareHeart,
  VolumeX,
  Dumbbell,
  RotateCcw
} from 'lucide-react';
import { 
  WORD_DATABASE, 
  CATEGORY_ORDER, 
  CABINET_CATEGORIES, 
  BRAIN_CATEGORIES, 
  generateMathProblem, 
  MOTIVATIONS, 
  formatSyllables,
  RIDDLES_DATA,
  RiddleItem,
  SPORT_EXERCISES,
  SportExercise,
  getSportExerciseGrammar,
  isYoungCat
} from '../data/words';
import { CatAvatar } from './CatAvatar';
import { VirtualKeyboard } from './VirtualKeyboard';
import { PetStats, CatLevel, CatAction, CatLetter } from '../types';
import { 
  playCorrectBeep, 
  playErrorTone, 
  playSuccessFanfare, 
  playMailChime,
  playCustomOrSpeech, 
  speakRussianText,
  saveAudioBlob 
} from '../utils/soundAndEffects';

interface ClassicPetModeProps {
  stats: PetStats;
  onUpdateStats: (updater: (prev: PetStats) => PetStats) => void;
  xp: number;
  level: CatLevel;
  displayLevel: CatLevel;
  onAddXp: (amount: number) => void;
  wordsTypedCount: number;
  onIncrementWordsCount: () => void;
  soundEnabled: boolean;
  kbScale: number;
  onSetKbScale: (s: number) => void;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
  isRewardMode: boolean;
  onAddRewardSeconds: (seconds: number) => void;
  rewardSeconds: number;
  sessionWordCount: number;
  onIncrementSessionWordCount: () => void;
  onWordCompleted?: (wordsCount?: number, charLength?: number, meta?: { category?: string; activityType?: string }) => void;
  questAnnounceMessage?: string | null;
  onClearQuestAnnounce?: () => void;
  onUnlockAchievement?: (id: string) => void;
}

export const ClassicPetMode: React.FC<ClassicPetModeProps> = ({
  stats,
  onUpdateStats,
  xp,
  level,
  displayLevel,
  onAddXp,
  wordsTypedCount,
  onIncrementWordsCount,
  soundEnabled,
  kbScale,
  onSetKbScale,
  isMobileMode,
  onToggleMobileMode,
  isRewardMode,
  onAddRewardSeconds,
  rewardSeconds,
  sessionWordCount,
  onIncrementSessionWordCount,
  onWordCompleted,
  questAnnounceMessage,
  onClearQuestAnnounce,
  onUnlockAchievement
}) => {
  const [currentWord, setCurrentWord] = useState<string>('');
  const [currentCategory, setCurrentCategory] = useState<string>('COMMANDS');
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState<number>(0);
  const [isRandomMode, setIsRandomMode] = useState<boolean>(true);
  const [randomWordCounter, setRandomWordCounter] = useState<number>(0);
  const [typedChars, setTypedChars] = useState<string>('');
  const [catAction, setCatAction] = useState<CatAction>('idle');
  const [hintKey, setHintKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("Напечатай слово, чтобы позаботиться о котике!");
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [customInputValue, setCustomInputValue] = useState<string>('');
  const [waitingForConfirmation, setWaitingForConfirmation] = useState<boolean>(false);
  const [isQuizMode, setIsQuizMode] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // New activities: Riddle, Math, Sport
  const [activityType, setActivityType] = useState<'standard' | 'riddle' | 'math' | 'sport'>('standard');
  const [isDoubleXp, setIsDoubleXp] = useState<boolean>(false);
  const [activeRiddle, setActiveRiddle] = useState<RiddleItem | null>(null);
  const [activeSportExercise, setActiveSportExercise] = useState<{
    name: string;
    count: number;
    text: string;
    exercise: SportExercise;
  } | null>(null);

  // Mailbox & Cat Letters: non-intrusive envelope by the cat, rate-limited to max once every 60s
  const [pendingLetter, setPendingLetter] = useState<CatLetter | null>(null);
  const [isMailboxOpen, setIsMailboxOpen] = useState<boolean>(false);
  const lastLetterTimeRef = useRef<number>(0);

  const wordStartTimeRef = useRef<number>(Date.now());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Pick word logic - filters word difficulty strictly by cat appearance (displayLevel)
  const pickWord = useCallback((category: string, customWord: string | null = null) => {
    let nextWord = '';
    if (customWord) {
      nextWord = customWord.toUpperCase().trim();
      setCurrentCategory('CUSTOM');
    } else {
      const allWords = WORD_DATABASE[category] || WORD_DATABASE['COMMANDS'];
      
      let filtered: string[] = [];

      if (displayLevel === 'baby') {
        // Малыш: строго 1 слово, БЕЗ пробелов!
        // В начале строго 3 буквы (допускается 2-3 буквы). Никаких фраз!
        const words3 = allWords.filter(w => !w.includes(' ') && w.length <= 3);
        if (words3.length >= 3) {
          filtered = words3;
        } else {
          filtered = allWords.filter(w => !w.includes(' ') && w.length <= 4);
        }
      } else if (displayLevel === 'kitten') {
        // Котёнок: строго 1 слово, БЕЗ пробелов, 4-5 букв
        const words45 = allWords.filter(w => !w.includes(' ') && w.length >= 4 && w.length <= 5);
        if (words45.length >= 3) {
          filtered = words45;
        } else {
          filtered = allWords.filter(w => !w.includes(' ') && w.length <= 6);
        }
      } else if (displayLevel === 'teen') {
        // Подросток: строго 1 слово, БЕЗ пробелов, 5-7 букв
        const words57 = allWords.filter(w => !w.includes(' ') && w.length >= 5 && w.length <= 7);
        if (words57.length >= 3) {
          filtered = words57;
        } else {
          filtered = allWords.filter(w => !w.includes(' ') && w.length >= 4 && w.length <= 8);
        }
      } else if (displayLevel === 'adult') {
        // Взрослый: строго 1 слово, БЕЗ пробелов, 7-10 букв
        const words710 = allWords.filter(w => !w.includes(' ') && w.length >= 7 && w.length <= 10);
        if (words710.length >= 3) {
          filtered = words710;
        } else {
          filtered = allWords.filter(w => !w.includes(' ') && w.length >= 6);
        }
      } else if (displayLevel === 'smart') {
        // Учёный: длинные слова (8+ букв) или простые короткие фразы из 2 слов
        const wordsSmart = allWords.filter(w => (!w.includes(' ') && w.length >= 8) || (w.includes(' ') && w.length <= 15));
        if (wordsSmart.length >= 3) {
          filtered = wordsSmart;
        } else {
          filtered = allWords.filter(w => w.length >= 6);
        }
      } else { // 'master'
        // Великий Магистр: только в самых последних фразы из 2 слов и сложные интересные фразы
        const wordsMaster = allWords.filter(w => w.includes(' '));
        if (wordsMaster.length >= 3) {
          filtered = wordsMaster;
        } else {
          filtered = allWords.filter(w => w.length >= 8);
        }
      }

      // Защита: для baby, kitten, teen, adult никогда не допускать пробелов
      if (filtered.length === 0) {
        if (displayLevel === 'baby' || displayLevel === 'kitten' || displayLevel === 'teen' || displayLevel === 'adult') {
          filtered = allWords.filter(w => !w.includes(' '));
        } else {
          filtered = allWords;
        }
      }

      nextWord = filtered[Math.floor(Math.random() * filtered.length)] || allWords[0];
      setCurrentCategory(category);
    }

    setActivityType('standard');
    setIsDoubleXp(false);
    setActiveRiddle(null);
    setActiveSportExercise(null);
    setCurrentWord(nextWord);
    setTypedChars('');
    setHintKey(null);
    wordStartTimeRef.current = Date.now();
    setCatAction('idle');
    setIsQuizMode(false);
    setWaitingForConfirmation(false);
    setMessage("Печатай слово!");
  }, [displayLevel]);

  // Смена облика/роста котика (включая ручной выбор в гардеробе): мгновенно адаптируем слово под выбранный возраст!
  const prevDisplayLevelRef = useRef(displayLevel);
  const prevLevelRef = useRef(level);
  useEffect(() => {
    if (prevDisplayLevelRef.current !== displayLevel || prevLevelRef.current !== level) {
      prevDisplayLevelRef.current = displayLevel;
      prevLevelRef.current = level;
      setRandomWordCounter(0);
      if (currentCategory && currentCategory !== 'CUSTOM') {
        pickWord(currentCategory);
      }
    }
  }, [displayLevel, level, currentCategory, pickWord]);

  // Dedicated selection helpers ensuring clean state and counter reset
  const selectRandomMode = useCallback(() => {
    setIsRandomMode(true);
    setRandomWordCounter(0);
    setActivityType('standard');
    setActiveRiddle(null);
    setActiveSportExercise(null);
    setIsDoubleXp(false);
    setIsQuizMode(false);
    setWaitingForConfirmation(false);
    const nextCat = CATEGORY_ORDER[Math.floor(Math.random() * CATEGORY_ORDER.length)];
    pickWord(nextCat);
  }, [pickWord]);

  const selectSingleCategory = useCallback((cat: string) => {
    setIsRandomMode(false);
    setRandomWordCounter(0);
    setActivityType('standard');
    setActiveRiddle(null);
    setActiveSportExercise(null);
    setIsDoubleXp(false);
    setIsQuizMode(false);
    setWaitingForConfirmation(false);
    pickWord(cat);
  }, [pickWord]);

  // Initial load
  useEffect(() => {
    if (!currentWord && !waitingForConfirmation) {
      pickWord('COMMANDS');
    }
  }, [currentWord, waitingForConfirmation, pickWord]);

  // Idle cat blink animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.15 && catAction === 'idle') {
        setCatAction('blink');
        setTimeout(() => setCatAction('idle'), 250);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [catAction]);

  // Check if a letter from the cat should arrive:
  // Arrives ONLY when a stat is very low (<= 12) AND strictly no more often than once per 60 seconds
  useEffect(() => {
    const now = Date.now();
    if (pendingLetter) return; // Already has an unread letter in the mailbox
    if (now - lastLetterTimeRef.current < 60000) return; // Cooldown 1 minute

    let newLetter: CatLetter | null = null;

    if (stats.hunger <= 12) {
      newLetter = {
        id: 'hunger_letter',
        statType: 'hunger',
        title: 'Хочу кушать! 🍖',
        text: 'Мяу! Мой животик громко урчит, я так проголодался! Пожалуйста, покорми меня вкусной рыбкой или молочком!',
        actionText: 'Покормить 🐟',
        categoryToOpen: 'HUNGER'
      };
    } else if (stats.clean <= 12) {
      newLetter = {
        id: 'clean_letter',
        statType: 'clean',
        title: 'Я испачкался! 🚿',
        text: 'Ой-ой! Мои лапки и шёрстка совсем запылились! Давай искупаемся с тёплой водичкой и ароматным мылом!',
        actionText: 'Помыть котика 🧼',
        categoryToOpen: 'CLEAN'
      };
    } else if (stats.happiness <= 12) {
      newLetter = {
        id: 'happiness_letter',
        statType: 'happiness',
        title: 'Может, поиграем? ⚽',
        text: 'Мурр... Мне немного грустно сидеть одному. Давай весело поиграем в мячик, догонялки или прятки!',
        actionText: 'Поиграть в мячик 🎾',
        categoryToOpen: 'HAPPINESS'
      };
    } else if (stats.sleep <= 12) {
      newLetter = {
        id: 'sleep_letter',
        statType: 'sleep',
        title: 'Хочу спать... 💤',
        text: 'Зееев... Глазки слипаются. Мне нужна мягкая подушечка и одеяло, чтобы сладко вздремнуть. Баю-бай!',
        actionText: 'Уложить спать 🛏️',
        categoryToOpen: 'SLEEP'
      };
    } else if (stats.intelligence <= 12) {
      newLetter = {
        id: 'intelligence_letter',
        statType: 'intelligence',
        title: 'Хочу учиться! 🧠',
        text: 'Мой кошачий ум хочет новых знаний! Давай попечатаем умные слова про природу и животных или решим задачку!',
        actionText: 'Развивать ум 🎓',
        categoryToOpen: 'ANIMALS'
      };
    }

    if (newLetter) {
      lastLetterTimeRef.current = now;
      setPendingLetter(newLetter);
      if (soundEnabled) {
        playMailChime(); // Gentle notification chime
      }
    }
  }, [stats, pendingLetter, soundEnabled]);

  const handleOpenMailbox = () => {
    setIsMailboxOpen(true);
  };

  const handleCloseMailbox = () => {
    setIsMailboxOpen(false);
  };

  const handleFulfillLetter = (letter: CatLetter) => {
    pickWord(letter.categoryToOpen);
    setPendingLetter(null);
    setIsMailboxOpen(false);
    if (soundEnabled) playSuccessFanfare();
  };

  // Key hint
  useEffect(() => {
    if (!currentWord || waitingForConfirmation) return;
    const nextChar = currentWord[typedChars.length];
    const hintTimer = setTimeout(() => {
      setHintKey(nextChar);
    }, 3200);
    return () => clearTimeout(hintTimer);
  }, [typedChars, currentWord, waitingForConfirmation]);

  // Quest announcement listener
  useEffect(() => {
    if (questAnnounceMessage) {
      setMessage(questAnnounceMessage);
      setCatAction('jump');
      const timer = setTimeout(() => {
        if (onClearQuestAnnounce) onClearQuestAnnounce();
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [questAnnounceMessage, onClearQuestAnnounce]);

  // Activity 1: Riddle (Загадки - каждое 6-е слово или по кнопке)
  const triggerRiddle = useCallback(() => {
    const riddle = RIDDLES_DATA[Math.floor(Math.random() * RIDDLES_DATA.length)];
    setActivityType('riddle');
    setActiveRiddle(riddle);
    setActiveSportExercise(null);
    setIsQuizMode(false);
    setIsDoubleXp(true);
    setCurrentWord(riddle.answer);
    const msg = `Загадка: ${riddle.question} (${riddle.hint})`;
    setMessage(msg);
    setCurrentCategory('RIDDLE');
    setTypedChars('');
    setHintKey(null);
    wordStartTimeRef.current = Date.now();
    setWaitingForConfirmation(false);
    setCatAction('smart');
    if (soundEnabled) {
      speakRussianText(`Загадка! ${riddle.question}`);
    }
  }, [soundEnabled]);

  // Activity 2: Math (Математика - каждое 8-е слово или по кнопке)
  const triggerMath = useCallback(() => {
    const isYoung = isYoungCat(displayLevel);
    const problem = generateMathProblem(displayLevel);
    setActivityType('math');
    setActiveRiddle(null);
    setActiveSportExercise(null);
    setIsQuizMode(true);
    setIsDoubleXp(true);
    setCurrentWord(problem.answer);
    
    // Вопрос без подсказки ответа (ребёнок решает и пишет ответ сам)
    const spokenEquation = problem.q.replace(/\+/g, 'плюс').replace(/-/g, 'минус');
    const msg = `Математика: сколько будет ${problem.q}?`;
    setMessage(msg);
    setCurrentCategory('QUIZ');
    setTypedChars('');
    setHintKey(null);
    wordStartTimeRef.current = Date.now();
    setWaitingForConfirmation(false);
    setCatAction('smart');
    if (soundEnabled) {
      speakRussianText(`Математика! Сколько будет ${spokenEquation}?`);
    }
  }, [displayLevel, soundEnabled]);

  // Activity 3: Sport (Спорт - каждое 10-е слово или по кнопке)
  // 5 упражнений: отжимания, приседания, подтягивания, прыжки на месте, кувырки
  const triggerSport = useCallback(() => {
    const exercise = SPORT_EXERCISES[Math.floor(Math.random() * SPORT_EXERCISES.length)];
    const isYoung = isYoungCat(displayLevel);
    const count = isYoung
      ? Math.floor(Math.random() * 6) + 5   // 5..10 раз
      : Math.floor(Math.random() * 8) + 8;  // 8..15 раз

    const sportPhrases = [
      `Давай сделаем ${count} ${exercise.genitiveSingular}, я засиделся!`,
      `Разминка! Сделай ${count} ${exercise.genitiveSingular} для бодрости!`,
      `Время спорта! Сделай ${count} ${exercise.genitiveSingular}!`
    ];
    const phrase = sportPhrases[Math.floor(Math.random() * sportPhrases.length)];

    // Целевой ответ для ребёнка:
    // До котика подростка: пишем только цифру: 10
    // Кот-путешественник и старше: пишем полностью: ПРИСЕДАНИЯ 10
    const sportTarget = isYoung ? String(count) : `${exercise.name.toUpperCase()} ${count}`;

    setActivityType('sport');
    setActiveRiddle(null);
    setActiveSportExercise({ name: exercise.name, count, text: phrase, exercise });
    setIsQuizMode(false);
    setIsDoubleXp(true);
    setCurrentWord(sportTarget);
    // Никакого лишнего текста "(напиши: прыжки 9)" — только сама фраза задания!
    setMessage(phrase);
    setCurrentCategory('SPORT');
    setTypedChars('');
    setHintKey(null);
    wordStartTimeRef.current = Date.now();
    setWaitingForConfirmation(false);
    setCatAction('jump');
    if (soundEnabled) {
      speakRussianText(phrase);
    }
  }, [displayLevel, soundEnabled]);

  const handleNextWord = useCallback(() => {
    if (!onWordCompleted) {
      onIncrementWordsCount();
    }

    // Automated periodic sports, math, and riddles are STRICTLY limited to Random mode (Случайный режим)
    if (isRandomMode) {
      const nextStep = randomWordCounter + 1;
      setRandomWordCounter(nextStep);

      // In Random mode:
      // Word 6: Riddle (Загадки)
      // Word 8: Math (Примеры)
      // Word 10: Sport (Спорт) and resets counter to start from 1 again
      if (nextStep === 6) {
        triggerRiddle();
        return;
      }
      if (nextStep === 8) {
        triggerMath();
        return;
      }
      if (nextStep === 10) {
        triggerSport();
        setRandomWordCounter(0);
        return;
      }

      let nextIndex = (currentCategoryIndex + 1) % CATEGORY_ORDER.length;
      setCurrentCategoryIndex(nextIndex);
      pickWord(CATEGORY_ORDER[nextIndex]);
    } else {
      // In single category mode (e.g. "Еда" / HUNGER), stay strictly within this category!
      // Do NOT trigger sport, math, or riddles.
      pickWord(currentCategory);
    }
  }, [
    onIncrementWordsCount, 
    onWordCompleted, 
    isRandomMode, 
    randomWordCounter,
    currentCategory, 
    currentCategoryIndex, 
    pickWord, 
    triggerSport, 
    triggerMath, 
    triggerRiddle
  ]);

  // Complete Word with increased XP reward and 2x XP for Riddles, Math, and Sport
  const completeWord = useCallback(() => {
    const duration = (Date.now() - wordStartTimeRef.current) / 1000;
    const lengthBonus = Math.max(0, (currentWord.length - 3) * 7);
    let baseBonus = 18 + lengthBonus;

    if (duration < 5 && !hintKey) {
      baseBonus += 7;
    }

    let gainedXp = isDoubleXp ? baseBonus * 2 : baseBonus;

    if (activityType === 'sport') {
      gainedXp = Math.max(gainedXp, 50);
      setMessage(`ОТЛИЧНАЯ РАЗМИНКА! +${gainedXp} XP 🏆 (2x ОПЫТ!)`);
      if (onUnlockAchievement) onUnlockAchievement('sport_hero');
    } else if (activityType === 'riddle') {
      gainedXp = Math.max(gainedXp, 45);
      setMessage(`ЗАГАДКА РАЗГАДАНА! +${gainedXp} XP 🌟 (2x ОПЫТ!)`);
      if (onUnlockAchievement) onUnlockAchievement('riddle_genius');
    } else if (activityType === 'math') {
      gainedXp = Math.max(gainedXp, 45);
      setMessage(`ВЕРНЫЙ РАСЧЁТ! +${gainedXp} XP 🧮 (2x ОПЫТ!)`);
    } else if (duration < 5 && !hintKey) {
      setMessage(`СУПЕР БЫСТРО! +${gainedXp} XP 🌟`);
    } else {
      setMessage(`МОЛОДЕЦ! +${gainedXp} XP ✨`);
    }

    if (soundEnabled) {
      playSuccessFanfare();
      if ((wordsTypedCount + 1) % 6 === 0 && activityType === 'standard') {
        const randMotiv = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
        setMessage(randMotiv);
        playCustomOrSpeech(randMotiv);
      }
    }

    // Notify word completion for reward timer and achievements
    if (onWordCompleted) {
      onWordCompleted(1, currentWord.length, { category: currentCategory, activityType });
    } else if (isRewardMode) {
      const rewardBonus = currentWord.length >= 6 ? 15 : 12;
      onAddRewardSeconds(rewardBonus);
      onIncrementSessionWordCount();
    }

    onAddXp(gainedXp);
    updateCatMoodAndState(currentCategory, currentWord);
    setWaitingForConfirmation(true);
  }, [
    currentWord, 
    hintKey, 
    soundEnabled, 
    wordsTypedCount, 
    isRewardMode, 
    onAddRewardSeconds, 
    onIncrementSessionWordCount, 
    onWordCompleted,
    onAddXp, 
    currentCategory,
    isDoubleXp,
    activityType,
    onUnlockAchievement
  ]);

  const updateCatMoodAndState = (category: string, word: string) => {
    let action: CatAction = 'dance';
    // Exactly 8 words to raise indicator from 0% to maximum 100% (100 / 8 = 12.5%)
    const STAT_PER_WORD = 100 / 8;

    if (category === 'SPORT') {
      action = 'jump';
      onUpdateStats(s => ({
        ...s,
        happiness: Math.min(100, Number((s.happiness + STAT_PER_WORD * 1.5).toFixed(1))),
        sleep: Math.min(100, Number((s.sleep + STAT_PER_WORD).toFixed(1))),
        hunger: Math.max(0, Number((s.hunger - 3).toFixed(1)))
      }));
    } else if (category === 'RIDDLE' || category === 'MATH') {
      action = 'smart';
      onUpdateStats(s => ({
        ...s,
        intelligence: Math.min(100, Number((s.intelligence + STAT_PER_WORD * 1.5).toFixed(1)))
      }));
    } else if (category === 'HUNGER') {
      action = 'eating';
      onUpdateStats(s => ({ ...s, hunger: Math.min(100, Number((s.hunger + STAT_PER_WORD).toFixed(1))) }));
    } else if (category === 'SLEEP') {
      action = 'sleeping';
      onUpdateStats(s => ({ ...s, sleep: Math.min(100, Number((s.sleep + STAT_PER_WORD).toFixed(1))) }));
    } else if (category === 'CLEAN' || category === 'HOUSE') {
      action = 'bow';
      onUpdateStats(s => ({ ...s, clean: Math.min(100, Number((s.clean + STAT_PER_WORD).toFixed(1))) }));
    } else if (category === 'LOVE' || category === 'COMMUNICATION' || category === 'EMOTIONS' || category === 'HAPPINESS') {
      action = 'love';
      onUpdateStats(s => ({ 
        ...s, 
        happiness: Math.min(100, Number((s.happiness + STAT_PER_WORD).toFixed(1)))
      }));
    } else if (BRAIN_CATEGORIES.includes(category) || category === 'QUIZ') {
      action = 'smart';
      onUpdateStats(s => ({ ...s, intelligence: Math.min(100, Number((s.intelligence + STAT_PER_WORD).toFixed(1))) }));
    } else if (category === 'COMMANDS') {
      if (word === 'СИДЕТЬ') action = 'idle';
      else if (word === 'ЛЕЖАТЬ') action = 'lying';
      else if (word === 'ТАНЕЦ') action = 'dance';
      else if (word === 'КУВЫРОК' || word === 'ОБОРОТ') action = 'spin';
      else if (word === 'РЯДОМ') action = 'sway';
      else action = 'jump';
      onUpdateStats(s => ({ ...s, happiness: Math.min(100, Number((s.happiness + STAT_PER_WORD).toFixed(1))) }));
    } else if (category === 'CUSTOM') {
      onUpdateStats(s => ({ 
        ...s, 
        happiness: Math.min(100, Number((s.happiness + STAT_PER_WORD).toFixed(1))),
        intelligence: Math.min(100, Number((s.intelligence + STAT_PER_WORD).toFixed(1)))
      }));
    }

    if (word === 'ТЫГЫДЫК') action = 'run';
    if (word === 'МЯУ') action = 'shake';

    setCatAction(action);
  };

  const handleCharInput = useCallback((char: string) => {
    if (waitingForConfirmation || !currentWord) return;

    const nextChar = currentWord[typedChars.length];
    const upper = char.toUpperCase();

    if (upper === nextChar || (nextChar === ' ' && char === ' ')) {
      if (soundEnabled) playCorrectBeep();
      setHintKey(null);
      const newTyped = typedChars + nextChar;
      setTypedChars(newTyped);

      if (newTyped === currentWord) {
        completeWord();
      }
    } else {
      if (soundEnabled) playErrorTone();
    }
  }, [waitingForConfirmation, currentWord, typedChars, soundEnabled, completeWord]);

  // Audio recording
  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        chunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          saveAudioBlob(currentWord, blob);
          if (soundEnabled) playCustomOrSpeech(currentWord);
          setMessage("Твой голос записан! Котик запомнил это слово!");
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setMessage("Идёт запись твоего голоса...");
      } catch (err) {
        console.warn("Microphone not available", err);
        setMessage("Разреши микрофон, чтобы записать голос!");
      }
    }
  }, [isRecording, currentWord, soundEnabled]);

  // Physical keyboard & Hotkeys (Alt+1..Alt+4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCustomInput || isMailboxOpen) return;

      // Global hotkeys with Alt
      if (e.altKey) {
        if (e.key === '1' || e.code === 'Digit1') {
          e.preventDefault();
          if (currentWord) playCustomOrSpeech(currentWord);
          return;
        }
        if (e.key === '2' || e.code === 'Digit2') {
          e.preventDefault();
          if (message) playCustomOrSpeech(message);
          return;
        }
        if (e.key === '3' || e.code === 'Digit3') {
          e.preventDefault();
          handleRecordToggle();
          return;
        }
        if (e.key === '4' || e.code === 'Digit4') {
          e.preventDefault();
          setTypedChars('');
          setHintKey(null);
          setWaitingForConfirmation(false);
          return;
        }
      }

      if (waitingForConfirmation && e.key === 'Enter') {
        handleNextWord();
        return;
      }
      if (e.key === 'Escape') {
        setTypedChars('');
        setHintKey(null);
        setWaitingForConfirmation(false);
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
  }, [
    showCustomInput, 
    isMailboxOpen, 
    waitingForConfirmation, 
    handleNextWord, 
    handleCharInput, 
    currentWord, 
    typedChars, 
    message, 
    handleRecordToggle
  ]);

  const getStatColor = (val: number) => {
    if (val > 60) return 'bg-emerald-500';
    if (val > 25) return 'bg-amber-400';
    return 'bg-rose-500';
  };

  const expectedChar = !waitingForConfirmation && currentWord ? currentWord[typedChars.length] : undefined;

  return (
    <div translate="no" className="notranslate w-full max-w-6xl flex flex-col lg:flex-row gap-3 relative">
      
      {/* Mailbox Drawer / Popup (Opens ONLY when child clicks the envelope) */}
      {isMailboxOpen && pendingLetter && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={handleCloseMailbox}
        >
          <div 
            className="bg-gradient-to-br from-amber-50 via-white to-orange-50 rounded-3xl p-6 max-w-md w-full shadow-2xl border-4 border-amber-300 relative text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseMailbox}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-amber-400 text-white rounded-2xl flex items-center justify-center text-2xl shadow-md">
                💌
              </div>
              <div>
                <h3 className="text-base font-black text-amber-950">
                  {pendingLetter.title}
                </h3>
                <span className="text-[11px] text-amber-700 font-bold">
                  Почта от твоего котика
                </span>
              </div>
            </div>

            <div className="bg-white/90 p-4 rounded-2xl border border-amber-100 mb-4 shadow-inner relative">
              <p className="text-sm text-slate-700 leading-relaxed font-medium pr-8">
                {pendingLetter.text}
              </p>
              {soundEnabled && (
                <button
                  type="button"
                  onClick={() => speakRussianText(pendingLetter.text)}
                  className="absolute top-3 right-3 p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl transition"
                  title="Прослушать письмо"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseMailbox}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
              >
                Позже
              </button>
              <button
                type="button"
                onClick={() => handleFulfillLetter(pendingLetter)}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-black shadow-lg shadow-orange-200 transition transform hover:scale-105 active:scale-95"
              >
                {pendingLetter.actionText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar: Cabinet with vocabulary themes */}
      <div className="hidden lg:flex flex-col gap-2 w-36 min-w-[140px]">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2.5 flex flex-col items-center gap-1.5">
          <span 
            className="font-bold uppercase tracking-wide"
            style={{ color: '#000000', fontSize: '14px' }}
          >
            Шкафчик тем
          </span>

          {CABINET_CATEGORIES.map(cat => {
            const isSelected = !isRandomMode && currentCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => selectSingleCategory(cat)}
                className={`w-full py-2 px-1 rounded-xl font-bold flex flex-col items-center text-xs transition border ${
                  isSelected
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat === 'ANIMALS' && <Dog className="w-5 h-5 mb-0.5 text-amber-600" />}
                {cat === 'PROFESSIONS' && <Briefcase className="w-5 h-5 mb-0.5 text-blue-600" />}
                {cat === 'EMOTIONS' && <Smile className="w-5 h-5 mb-0.5 text-yellow-600" />}
                {cat === 'NATURE' && <Trees className="w-5 h-5 mb-0.5 text-emerald-600" />}
                {cat === 'HOUSE' && <Home className="w-5 h-5 mb-0.5 text-indigo-600" />}
                {cat === 'BODY' && <Eye className="w-5 h-5 mb-0.5 text-rose-600" />}
                {cat === 'COMMUNICATION' && <MessageSquareHeart className="w-5 h-5 mb-0.5 text-pink-600" />}
                <span>
                  {cat === 'ANIMALS' ? 'Животные' :
                   cat === 'PROFESSIONS' ? 'Профессии' :
                   cat === 'EMOTIONS' ? 'Эмоции' :
                   cat === 'NATURE' ? 'Природа' :
                   cat === 'HOUSE' ? 'Дом' :
                   cat === 'BODY' ? 'Тело' : 'Общение'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Pet Playfield */}
      <div className="flex-1 flex flex-col items-center gap-3">
        {/* Meters Bar */}
        <div className="w-full bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex items-center justify-around gap-2 flex-wrap">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Fish className="w-4 h-4 text-orange-500" /> Сытость
            </span>
            <div className="w-16 sm:w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getStatColor(stats.hunger)}`}
                style={{ width: `${stats.hunger}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Heart className="w-4 h-4 text-rose-500" /> Радость
            </span>
            <div className="w-16 sm:w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getStatColor(stats.happiness)}`}
                style={{ width: `${stats.happiness}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
              <BedDouble className="w-4 h-4 text-blue-500" /> Бодрость
            </span>
            <div className="w-16 sm:w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getStatColor(stats.sleep)}`}
                style={{ width: `${stats.sleep}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
              <ShowerHead className="w-4 h-4 text-cyan-500" /> Чистота
            </span>
            <div className="w-16 sm:w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getStatColor(stats.clean)}`}
                style={{ width: `${stats.clean}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
              <Brain className="w-4 h-4 text-purple-500" /> Ум
            </span>
            <div className="w-16 sm:w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getStatColor(stats.intelligence)}`}
                style={{ width: `${stats.intelligence}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Cat + Speech Bubble + Cute Envelope in the Corner */}
        <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6 my-1 relative">
          
          {/* Cat Avatar with adjacent Mailbox Envelope */}
          <div className="relative flex items-center justify-center">
            <CatAvatar
              mood={stats.happiness > 50 ? 'happy' : 'sad'}
              action={catAction}
              stage={displayLevel}
              currentWord={currentWord}
              category={currentCategory}
            />

            {/* Cute Mailbox Envelope beside the cat */}
            <div className="absolute -top-1 -right-2 sm:-right-4 z-20">
              <button
                type="button"
                onClick={handleOpenMailbox}
                className={`relative p-2.5 rounded-2xl transition transform active:scale-95 shadow-md flex items-center justify-center ${
                  pendingLetter
                    ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 ring-4 ring-amber-200 animate-bounce'
                    : 'bg-white/80 hover:bg-white text-slate-400 border border-slate-200'
                }`}
                title={pendingLetter ? 'Есть новое письмо от котика! Нажми прочитать' : 'Почта пуста'}
              >
                <span className="text-2xl leading-none">
                  {pendingLetter ? '💌' : '✉️'}
                </span>

                {pendingLetter && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                    1
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Speech bubble & 3 Quick Action Buttons: Sport, Math, Riddles */}
          <div className="flex items-center gap-2.5">
            <div className="bg-white rounded-3xl p-5 shadow-lg border-2 border-orange-100 max-w-xs relative flex flex-col justify-between min-h-[90px]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-extrabold uppercase text-orange-500 flex items-center gap-1">
                    {activityType === 'sport' ? '🏃 Спорт!' : activityType === 'riddle' ? '🧩 Загадка!' : activityType === 'math' || isQuizMode ? '🧮 Математика!' : 'Мяу!'}
                  </span>
                  {isDoubleXp && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-2 py-0.5 rounded-full animate-bounce">
                      2x ОПЫТ!
                    </span>
                  )}
                </div>
                {soundEnabled && (
                  <button
                    type="button"
                    onClick={() => playCustomOrSpeech(message)}
                    className="p-1 text-slate-400 hover:text-orange-600 rounded-lg transition ml-auto"
                    title="Озвучить котика (Alt + 2)"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-slate-700 text-sm font-medium leading-snug">
                {message}
              </p>
            </div>

            {/* 3 Quick Action Buttons (clean icon-only with tooltips: спорт, математика, загадки) */}
            <div className="flex flex-col gap-2 self-center">
              <button
                type="button"
                onClick={triggerSport}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white flex items-center justify-center text-lg shadow-sm border border-emerald-300 transition-all transform hover:scale-110 active:scale-95"
                title="спорт"
              >
                <span>🏃</span>
              </button>

              <button
                type="button"
                onClick={triggerMath}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white flex items-center justify-center text-lg shadow-sm border border-purple-300 transition-all transform hover:scale-110 active:scale-95"
                title="математика"
              >
                <span>🧮</span>
              </button>

              <button
                type="button"
                onClick={triggerRiddle}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white flex items-center justify-center text-lg shadow-sm border border-amber-300 transition-all transform hover:scale-110 active:scale-95"
                title="загадки"
              >
                <span>🧩</span>
              </button>
            </div>
          </div>
        </div>

        {/* Word Input Arena */}
        <div className="w-full bg-white rounded-3xl p-5 sm:p-7 shadow-md border-2 border-slate-200 flex flex-col items-center justify-center relative min-h-[160px]">
          {/* Activity Badge for 2x XP */}
          {isDoubleXp && (
            <div className="mb-2 px-3 py-1 bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 rounded-full text-xs font-black text-amber-900 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {activityType === 'sport' ? 'Спортивное задание' : activityType === 'riddle' ? 'Загадка от котика' : 'Математический пример'} — 2x ОПЫТ!
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-center">
            
            {/* Audio Voice recording (Alt+3) */}
            <button
              type="button"
              onClick={handleRecordToggle}
              className={`p-2.5 rounded-full transition border ${
                isRecording
                  ? 'bg-rose-100 text-rose-600 border-rose-300 animate-pulse'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
              title={isRecording ? 'Остановить запись (Alt + 3)' : 'Записать свой голос (Alt + 3)'}
            >
              {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Restart Word from beginning (Alt+4) */}
            <button
              type="button"
              onClick={() => {
                setTypedChars('');
                setHintKey(null);
                setWaitingForConfirmation(false);
              }}
              className="p-2.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition"
              title="Написать слово сначала (Alt + 4)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Word Display */}
            <div translate="no" className="notranslate text-4xl sm:text-6xl font-mono font-black tracking-widest text-center select-none">
              {waitingForConfirmation ? (
                <span translate="no" className="notranslate text-emerald-500 animate-fade-in-up tracking-wider">
                  {formatSyllables(currentWord)}
                </span>
              ) : (
                currentWord.split('').map((char, index) => {
                  let colorClass = "text-slate-300";
                  if (index < typedChars.length) colorClass = "text-emerald-500";
                  else if (index === typedChars.length) colorClass = "text-slate-900 border-b-4 border-orange-400 animate-pulse";
                  return (
                    <span key={index} translate="no" className={`notranslate inline-block px-[1px] ${colorClass} transition-colors duration-150`}>
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  );
                })
              )}
            </div>

            {/* Listen / Next Button */}
            {waitingForConfirmation ? (
              <button
                type="button"
                onClick={handleNextWord}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black p-3.5 rounded-2xl shadow-lg transition transform hover:scale-110 active:scale-95 animate-bounce"
                title="Следующее слово (Enter)"
              >
                <ArrowRight className="w-7 h-7" />
              </button>
            ) : (
              soundEnabled && (
                <button
                  type="button"
                  onClick={() => playCustomOrSpeech(currentWord)}
                  className="p-3 text-blue-500 hover:bg-blue-50 rounded-2xl transition"
                  title="Озвучить слово (Alt + 1)"
                >
                  <Volume2 className="w-6 h-6" />
                </button>
              )
            )}
          </div>

          {/* Quick finish button for physical sport exercises */}
          {activityType === 'sport' && !waitingForConfirmation && (
            <button
              type="button"
              onClick={() => {
                setTypedChars(currentWord);
                completeWord();
              }}
              className="mt-3 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-200 transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
              title="Нажми, когда выполнишь упражнение"
            >
              <Dumbbell className="w-4 h-4" />
              <span>Выполнил упражнение! (+2x XP) 💪</span>
            </button>
          )}

          {/* Quick theme buttons below input: Random mode button strictly placed next to Food */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center mt-4">
            <button
              type="button"
              onClick={selectRandomMode}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
                isRandomMode
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-700 shadow-sm'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200'
              }`}
              title="Случайный режим: чередование тем (6: загадка, 8: пример, 10: спорт)"
            >
              <span>🎲</span> Случайный
            </button>
            <button
              type="button"
              onClick={() => selectSingleCategory('HUNGER')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                !isRandomMode && currentCategory === 'HUNGER'
                  ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200'
              }`}
            >
              🍖 Еда
            </button>
            <button
              type="button"
              onClick={() => selectSingleCategory('LOVE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                !isRandomMode && currentCategory === 'LOVE'
                  ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
              }`}
            >
              ❤️ Любовь
            </button>
            <button
              type="button"
              onClick={() => selectSingleCategory('SLEEP')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                !isRandomMode && currentCategory === 'SLEEP'
                  ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
              }`}
            >
              💤 Сон
            </button>
            <button
              type="button"
              onClick={() => selectSingleCategory('CLEAN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                !isRandomMode && currentCategory === 'CLEAN'
                  ? 'bg-cyan-500 text-white border-cyan-600 shadow-sm'
                  : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border-cyan-200'
              }`}
            >
              🚿 Мыть
            </button>
            <button
              type="button"
              onClick={() => selectSingleCategory('HAPPINESS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                !isRandomMode && currentCategory === 'HAPPINESS'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
              }`}
            >
              ⚽ Игра
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRandomMode(false);
                setRandomWordCounter(0);
                setActivityType('standard');
                setActiveRiddle(null);
                setActiveSportExercise(null);
                setIsDoubleXp(false);
                setIsQuizMode(false);
                setShowCustomInput(true);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                !isRandomMode && currentCategory === 'CUSTOM'
                  ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200'
              }`}
            >
              ✍️ Своё
            </button>
          </div>
        </div>

        {/* Custom Word Modal */}
        {showCustomInput && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <PenTool className="w-5 h-5 text-purple-600" />
                Введи своё слово или фразу
              </h3>
              <input
                type="text"
                autoFocus
                value={customInputValue}
                onChange={(e) => setCustomInputValue(e.target.value)}
                placeholder="СЛОВО ИЛИ ФРАЗА"
                className="w-full border-2 border-purple-300 rounded-2xl px-4 py-2.5 text-lg font-mono uppercase focus:border-purple-600 focus:outline-none mb-3"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customInputValue.trim()) {
                      pickWord('CUSTOM', customInputValue.trim());
                      setShowCustomInput(false);
                      setCustomInputValue('');
                    }
                  }}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Готово
                </button>
              </div>
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
          disabled={waitingForConfirmation}
        />
      </div>
    </div>
  );
};
