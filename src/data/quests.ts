import { AchievementItem, CatLevel, PetStats, QuestProgressCounters } from '../types';
import { RUSSIAN_ALPHABET } from './words';

export const CAT_STAGE_THRESHOLDS: { level: CatLevel; requiredXp: number; name: string; icon: string }[] = [
  { level: 'baby', requiredXp: 0, name: 'Малыш', icon: '🍼' },
  { level: 'kitten', requiredXp: 250, name: 'Котёнок', icon: '🐱' },
  { level: 'teen', requiredXp: 700, name: 'Подросток', icon: '🛹' },
  { level: 'adult', requiredXp: 1500, name: 'Взрослый', icon: '🦁' },
  { level: 'smart', requiredXp: 3000, name: 'Учёный', icon: '🎓' },
  { level: 'master', requiredXp: 6000, name: 'Великий Магистр', icon: '👑' },
  { level: 'cosmic', requiredXp: 12000, name: 'Космический Император', icon: '🌌' },
];

export function getTodayLocalDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCatLevelFromXp(xp: number): CatLevel {
  if (xp >= 12000) return 'cosmic';
  if (xp >= 6000) return 'master';
  if (xp >= 3000) return 'smart';
  if (xp >= 1500) return 'adult';
  if (xp >= 700) return 'teen';
  if (xp >= 250) return 'kitten';
  return 'baby';
}

export function getCatXpProgressInfo(xp: number) {
  const safeXp = Math.max(0, xp);
  let currentIdx = 0;
  for (let i = 0; i < CAT_STAGE_THRESHOLDS.length; i++) {
    if (safeXp >= CAT_STAGE_THRESHOLDS[i].requiredXp) {
      currentIdx = i;
    }
  }
  const currentStage = CAT_STAGE_THRESHOLDS[currentIdx];
  const nextStage = CAT_STAGE_THRESHOLDS[currentIdx + 1] || null;

  if (!nextStage) {
    return {
      currentStage,
      nextStage: null,
      progressPercent: 100,
      xpNeededForNext: 0,
      nextThreshold: currentStage.requiredXp,
      isMaxLevel: true,
    };
  }

  const stageSpan = Math.max(1, nextStage.requiredXp - currentStage.requiredXp);
  const xpIntoStage = safeXp - currentStage.requiredXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpIntoStage / stageSpan) * 100)));
  const xpNeededForNext = Math.max(0, nextStage.requiredXp - safeXp);

  return {
    currentStage,
    nextStage,
    progressPercent,
    xpNeededForNext,
    nextThreshold: nextStage.requiredXp,
    isMaxLevel: false,
  };
}

export function createInitialQuestCounters(todayStr: string): QuestProgressCounters {
  return {
    dailyDate: todayStr,
    dailyWords: 0,
    dailyFeedings: 0,
    dailyCareActions: 0,
    dailyRiddlesMathSport: 0,
    dailyMarathons: 0,
    dailySpeedTexts: 0,
    dailySprintLetters: 0,
    dailyChatMessages: 0,
    totalWords: 0,
    totalMarathons: 0,
    totalSpeedTexts: 0,
    totalSprintLetters: 0,
    totalRiddles: 0,
    totalMath: 0,
    totalSport: 0,
    totalFeedings: 0,
    totalWashings: 0,
    totalSleeps: 0,
    totalPlays: 0,
    totalChats: 0,
    maxWpm: 0,
    highAccuracyTexts: 0,
    recordsSaved: 0,
    learnedAlphabetLetters: '',
  };
}

export function parseLearnedAlphabetLetters(raw?: string): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const validSet = new Set(RUSSIAN_ALPHABET);
  return Array.from(
    new Set(
      raw
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(s => validSet.has(s))
    )
  );
}

export function addLearnedAlphabetLetter(raw: string | undefined, letter: string): string {
  const current = parseLearnedAlphabetLetters(raw);
  const upper = letter.trim().toUpperCase();
  if (!current.includes(upper) && RUSSIAN_ALPHABET.includes(upper)) {
    current.push(upper);
  }
  return current.join(',');
}

export function mergeLearnedAlphabetLetters(rawA?: string, rawB?: string): string {
  const listA = parseLearnedAlphabetLetters(rawA);
  const listB = parseLearnedAlphabetLetters(rawB);
  return Array.from(new Set([...listA, ...listB])).join(',');
}

export interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  category: 'daily' | 'longterm';
  targetProgress: number;
  getProgress: (ctx: {
    counters: QuestProgressCounters;
    stats: PetStats;
    xp: number;
    streakDays: number;
    hasUnlockedAllAges: boolean;
  }) => number;
}

// Pool of quick 5-minute daily quests (6 selected/active every day, refreshed by date)
export const DAILY_QUEST_POOL: QuestTemplate[] = [
  {
    id: 'daily_words_10',
    title: 'Разминка лапок',
    description: 'Напечатай 10 слов за сегодня в любом режиме',
    icon: '🐾',
    xpReward: 40,
    category: 'daily',
    targetProgress: 10,
    getProgress: ({ counters }) => Math.min(10, counters.dailyWords),
  },
  {
    id: 'daily_care_70',
    title: 'Заботливый хозяин',
    description: 'Подними все показатели котика выше 70%',
    icon: '💖',
    xpReward: 50,
    category: 'daily',
    targetProgress: 70,
    getProgress: ({ stats }) =>
      Math.min(
        70,
        Math.floor(Math.min(stats.hunger, stats.sleep, stats.clean, stats.happiness, stats.intelligence))
      ),
  },
  {
    id: 'daily_sprint_10',
    title: 'Буквенный следопыт',
    description: 'Освой 10 букв за день в режиме «Буквенный спринт»',
    icon: '🎯',
    xpReward: 50,
    category: 'daily',
    targetProgress: 10,
    getProgress: ({ counters }) => Math.min(10, counters.dailySprintLetters),
  },
  {
    id: 'daily_sniper_92',
    title: 'Снайпер клавиатуры',
    description: 'Напечатай текст с точностью более 92%',
    icon: '⚡',
    xpReward: 100,
    category: 'daily',
    targetProgress: 1,
    getProgress: ({ counters }) => Math.min(1, counters.highAccuracyTexts > 0 ? 1 : 0),
  },
  {
    id: 'daily_feed_3',
    title: 'Вкусный завтрак',
    description: 'Покорми котика или выполни 3 действия ухода за сегодня',
    icon: '🍲',
    xpReward: 40,
    category: 'daily',
    targetProgress: 3,
    getProgress: ({ counters }) => Math.min(3, counters.dailyCareActions),
  },
  {
    id: 'daily_marathon_1',
    title: 'Быстрый забег',
    description: 'Пройди 1 раз «Марафон слов» или «Скорость текста» за сегодня',
    icon: '🏁',
    xpReward: 60,
    category: 'daily',
    targetProgress: 1,
    getProgress: ({ counters }) => Math.min(1, counters.dailyMarathons + counters.dailySpeedTexts),
  },
  {
    id: 'daily_brain_1',
    title: 'Умная минутка',
    description: 'Отгадай 1 загадку, пример или сделай зарядку с котиком',
    icon: '🧩',
    xpReward: 50,
    category: 'daily',
    targetProgress: 1,
    getProgress: ({ counters }) => Math.min(1, counters.dailyRiddlesMathSport),
  },
  {
    id: 'daily_chat_2',
    title: 'Дружеская беседа',
    description: 'Напиши 2 сообщения в «Диалоге с котиком»',
    icon: '💬',
    xpReward: 45,
    category: 'daily',
    targetProgress: 2,
    getProgress: ({ counters }) => Math.min(2, counters.dailyChatMessages),
  },
  {
    id: 'daily_words_20',
    title: 'Весёлые пальчики',
    description: 'Напечатай 20 слов за сегодня для бодрости',
    icon: '⌨️',
    xpReward: 65,
    category: 'daily',
    targetProgress: 20,
    getProgress: ({ counters }) => Math.min(20, counters.dailyWords),
  },
];

// Deterministic selection of 6 daily quests for a given YYYY-MM-DD date string
// Always keeps the 4 core beloved daily quests + 2 rotating daily quests so it feels fresh every day!
export function getDailyQuestsForDate(dateStr: string): QuestTemplate[] {
  const coreFour = DAILY_QUEST_POOL.slice(0, 4); // Разминка лапок, Заботливый хозяин, Буквенный следопыт, Снайпер клавиатуры
  const rotatingPool = DAILY_QUEST_POOL.slice(4);
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const idx1 = hash % rotatingPool.length;
  const idx2 = (hash + 2) % rotatingPool.length === idx1
    ? (idx1 + 1) % rotatingPool.length
    : (hash + 2) % rotatingPool.length;

  return [...coreFour, rotatingPool[idx1], rotatingPool[idx2]];
}

// Long-term challenging quests (включая изучение 10 букв алфавита и всего алфавита)
export const LONG_TERM_QUEST_TEMPLATES: QuestTemplate[] = [
  {
    id: 'lt_alphabet_10',
    title: 'Выучи 10 букв по алфавиту',
    description: 'Освой 10 разных букв по алфавиту в режиме «Буквенный спринт»',
    icon: '🔤',
    xpReward: 200,
    category: 'longterm',
    targetProgress: 10,
    getProgress: ({ counters }) =>
      Math.min(
        10,
        Math.max(
          parseLearnedAlphabetLetters(counters.learnedAlphabetLetters).length,
          Math.min(10, counters.totalSprintLetters)
        )
      ),
  },
  {
    id: 'lt_alphabet_all',
    title: 'Выучи весь алфавит',
    description: `Освой все ${RUSSIAN_ALPHABET.length} буквы русского алфавита от А до Я в «Буквенном спринте»!`,
    icon: '📚',
    xpReward: 500,
    category: 'longterm',
    targetProgress: RUSSIAN_ALPHABET.length,
    getProgress: ({ counters }) =>
      Math.min(
        RUSSIAN_ALPHABET.length,
        parseLearnedAlphabetLetters(counters.learnedAlphabetLetters).length
      ),
  },
  {
    id: 'lt_words_50',
    title: '1. Первые полсотни слов',
    description: 'Напечатай всего 50 слов в любых режимах',
    icon: '🌱',
    xpReward: 100,
    category: 'longterm',
    targetProgress: 50,
    getProgress: ({ counters }) => Math.min(50, counters.totalWords),
  },
  {
    id: 'lt_words_150',
    title: '2. Юный писатель',
    description: 'Напечатай всего 150 слов',
    icon: '📝',
    xpReward: 150,
    category: 'longterm',
    targetProgress: 150,
    getProgress: ({ counters }) => Math.min(150, counters.totalWords),
  },
  {
    id: 'lt_words_300',
    title: '3. Мастер клавиатуры',
    description: 'Напечатай всего 300 слов без устали',
    icon: '⌨️',
    xpReward: 250,
    category: 'longterm',
    targetProgress: 300,
    getProgress: ({ counters }) => Math.min(300, counters.totalWords),
  },
  {
    id: 'lt_words_600',
    title: '4. Книжный хранитель',
    description: 'Напечатай всего 600 слов во всех режимах',
    icon: '📚',
    xpReward: 350,
    category: 'longterm',
    targetProgress: 600,
    getProgress: ({ counters }) => Math.min(600, counters.totalWords),
  },
  {
    id: 'lt_words_1000',
    title: '5. Тысяча золотых слов',
    description: 'Напечатай 1000 слов и стань гордостью котика!',
    icon: '👑',
    xpReward: 500,
    category: 'longterm',
    targetProgress: 1000,
    getProgress: ({ counters }) => Math.min(1000, counters.totalWords),
  },
  {
    id: 'lt_marathons_3',
    title: '6. Любитель марафонов',
    description: 'Заверши 3 забега в режиме «Марафон слов»',
    icon: '🏃',
    xpReward: 120,
    category: 'longterm',
    targetProgress: 3,
    getProgress: ({ counters }) => Math.min(3, counters.totalMarathons),
  },
  {
    id: 'lt_marathons_10',
    title: '7. Выносливый бегун',
    description: 'Заверши 10 забегов в режиме «Марафон слов»',
    icon: '🏅',
    xpReward: 250,
    category: 'longterm',
    targetProgress: 10,
    getProgress: ({ counters }) => Math.min(10, counters.totalMarathons),
  },
  {
    id: 'lt_marathons_25',
    title: '8. Чемпион марафона',
    description: 'Заверши 25 марафонов слов!',
    icon: '🏆',
    xpReward: 450,
    category: 'longterm',
    targetProgress: 25,
    getProgress: ({ counters }) => Math.min(25, counters.totalMarathons),
  },
  {
    id: 'lt_speed_3',
    title: '9. Чтец сказок',
    description: 'Напечатай 3 рассказа в режиме «Скорость текста»',
    icon: '📖',
    xpReward: 130,
    category: 'longterm',
    targetProgress: 3,
    getProgress: ({ counters }) => Math.min(3, counters.totalSpeedTexts),
  },
  {
    id: 'lt_speed_10',
    title: '10. Скоростной сказочник',
    description: 'Напечатай 10 рассказов в режиме «Скорость текста»',
    icon: '🚀',
    xpReward: 280,
    category: 'longterm',
    targetProgress: 10,
    getProgress: ({ counters }) => Math.min(10, counters.totalSpeedTexts),
  },
  {
    id: 'lt_speed_20',
    title: '11. Властелин историй',
    description: 'Напечатай 20 рассказов в режиме «Скорость текста»',
    icon: '🌟',
    xpReward: 450,
    category: 'longterm',
    targetProgress: 20,
    getProgress: ({ counters }) => Math.min(20, counters.totalSpeedTexts),
  },
  {
    id: 'lt_sprint_30',
    title: '12. Охотник за буквами',
    description: 'Поймай 30 букв в «Буквенном спринте»',
    icon: '🔤',
    xpReward: 120,
    category: 'longterm',
    targetProgress: 30,
    getProgress: ({ counters }) => Math.min(30, counters.totalSprintLetters),
  },
  {
    id: 'lt_sprint_100',
    title: '13. Мастер алфавита',
    description: 'Поймай 100 букв в «Буквенном спринте»',
    icon: '🎯',
    xpReward: 260,
    category: 'longterm',
    targetProgress: 100,
    getProgress: ({ counters }) => Math.min(100, counters.totalSprintLetters),
  },
  {
    id: 'lt_sprint_250',
    title: '14. Молниеносная реакция',
    description: 'Поймай 250 букв в «Буквенном спринте»',
    icon: '⚡',
    xpReward: 450,
    category: 'longterm',
    targetProgress: 250,
    getProgress: ({ counters }) => Math.min(250, counters.totalSprintLetters),
  },
  {
    id: 'lt_riddles_5',
    title: '15. Знаток загадок',
    description: 'Отгадай 5 загадок котика в случайном режиме',
    icon: '🦊',
    xpReward: 140,
    category: 'longterm',
    targetProgress: 5,
    getProgress: ({ counters }) => Math.min(5, counters.totalRiddles),
  },
  {
    id: 'lt_riddles_20',
    title: '16. Мудрый детектив',
    description: 'Отгадай 20 загадок котика',
    icon: '🦉',
    xpReward: 320,
    category: 'longterm',
    targetProgress: 20,
    getProgress: ({ counters }) => Math.min(20, counters.totalRiddles),
  },
  {
    id: 'lt_math_5',
    title: '17. Юный математик',
    description: 'Реши 5 математических примеров котика',
    icon: '🧮',
    xpReward: 140,
    category: 'longterm',
    targetProgress: 5,
    getProgress: ({ counters }) => Math.min(5, counters.totalMath),
  },
  {
    id: 'lt_math_20',
    title: '18. Профессор счёта',
    description: 'Реши 20 математических примеров котика',
    icon: '🎓',
    xpReward: 320,
    category: 'longterm',
    targetProgress: 20,
    getProgress: ({ counters }) => Math.min(20, counters.totalMath),
  },
  {
    id: 'lt_sport_5',
    title: '19. Физкульт-привет!',
    description: 'Выполни 5 спортивных разминок вместе с котиком',
    icon: '💪',
    xpReward: 150,
    category: 'longterm',
    targetProgress: 5,
    getProgress: ({ counters }) => Math.min(5, counters.totalSport),
  },
  {
    id: 'lt_sport_20',
    title: '20. Олимпийский котик',
    description: 'Выполни 20 спортивных упражнений вместе с котиком',
    icon: '🥇',
    xpReward: 350,
    category: 'longterm',
    targetProgress: 20,
    getProgress: ({ counters }) => Math.min(20, counters.totalSport),
  },
  {
    id: 'lt_feed_15',
    title: '21. Шеф-повар котика',
    description: 'Покорми котика 15 раз вкусными словами',
    icon: '🐟',
    xpReward: 150,
    category: 'longterm',
    targetProgress: 15,
    getProgress: ({ counters }) => Math.min(15, counters.totalFeedings),
  },
  {
    id: 'lt_clean_15',
    title: '22. Блестящие лапки',
    description: 'Помой и причеши котика 15 раз',
    icon: '🛁',
    xpReward: 150,
    category: 'longterm',
    targetProgress: 15,
    getProgress: ({ counters }) => Math.min(15, counters.totalWashings),
  },
  {
    id: 'lt_play_15',
    title: '23. Душа компании',
    description: 'Поиграй с котиком или подари любовь 15 раз',
    icon: '🧶',
    xpReward: 150,
    category: 'longterm',
    targetProgress: 15,
    getProgress: ({ counters }) => Math.min(15, counters.totalPlays),
  },
  {
    id: 'lt_chat_15',
    title: '24. Лучший собеседник',
    description: 'Отправь 15 сообщений в режиме «Диалог с котиком»',
    icon: '💌',
    xpReward: 180,
    category: 'longterm',
    targetProgress: 15,
    getProgress: ({ counters }) => Math.min(15, counters.totalChats),
  },
  {
    id: 'lt_wpm_25',
    title: '25. Быстрые лапки (25 слов/мин)',
    description: 'Достигни скорости печати 25 слов в минуту',
    icon: '💨',
    xpReward: 200,
    category: 'longterm',
    targetProgress: 25,
    getProgress: ({ counters }) => Math.min(25, counters.maxWpm),
  },
  {
    id: 'lt_wpm_45',
    title: '26. Сверхзвуковой кот (45 слов/мин)',
    description: 'Достигни скорости печати 45 слов в минуту',
    icon: '⚡',
    xpReward: 400,
    category: 'longterm',
    targetProgress: 45,
    getProgress: ({ counters }) => Math.min(45, counters.maxWpm),
  },
  {
    id: 'lt_records_3',
    title: '27. Покоритель турниров',
    description: 'Сохрани 3 своих результата в таблицу рекордов',
    icon: '🎖️',
    xpReward: 200,
    category: 'longterm',
    targetProgress: 3,
    getProgress: ({ counters }) => Math.min(3, counters.recordsSaved),
  },
  {
    id: 'lt_streak_3',
    title: '28. Верный друг (3 дня подряд)',
    description: 'Заходи к котику и тренируйся 3 дня подряд',
    icon: '🔥',
    xpReward: 250,
    category: 'longterm',
    targetProgress: 3,
    getProgress: ({ streakDays }) => Math.min(3, streakDays),
  },
  {
    id: 'lt_xp_6000',
    title: '29. Путь Великого Магистра',
    description: 'Набери 6000 опыта и открой Великого Магистра',
    icon: '🧙‍♂️',
    xpReward: 400,
    category: 'longterm',
    targetProgress: 6000,
    getProgress: ({ xp }) => Math.min(6000, xp),
  },
  {
    id: 'lt_xp_12000',
    title: '30. Космический Император',
    description: 'Набери 12000 опыта и открой 7-й легендарный облик котика!',
    icon: '🌌',
    xpReward: 500,
    category: 'longterm',
    targetProgress: 12000,
    getProgress: ({ xp }) => Math.min(12000, xp),
  },
];

export function evaluateAllQuests(params: {
  counters: QuestProgressCounters;
  stats: PetStats;
  xp: number;
  streakDays: number;
  hasUnlockedAllAges: boolean;
  claimedIds: string[];
  previouslyUnlockedIds?: string[];
}): AchievementItem[] {
  const { counters, stats, xp, streakDays, hasUnlockedAllAges, claimedIds, previouslyUnlockedIds = [] } = params;
  const dailyTemplates = getDailyQuestsForDate(counters.dailyDate);
  const allTemplates = [...dailyTemplates, ...LONG_TERM_QUEST_TEMPLATES];

  const claimedSet = new Set(claimedIds);
  const prevUnlockedSet = new Set(previouslyUnlockedIds);

  return allTemplates.map((tpl) => {
    // For daily quests, namespace claim ID by date so daily claims reset each new day
    const claimKey = tpl.category === 'daily' ? `${tpl.id}_${counters.dailyDate}` : tpl.id;
    const rawProgress = tpl.getProgress({ counters, stats, xp, streakDays, hasUnlockedAllAges });
    const isClaimed = claimedSet.has(claimKey) || claimedSet.has(tpl.id);
    const isUnlocked = isClaimed || prevUnlockedSet.has(claimKey) || rawProgress >= tpl.targetProgress;

    return {
      id: claimKey,
      title: tpl.title,
      description: tpl.description,
      icon: tpl.icon,
      xpReward: tpl.xpReward,
      category: tpl.category,
      currentProgress: isUnlocked ? tpl.targetProgress : rawProgress,
      targetProgress: tpl.targetProgress,
      isUnlocked,
      isClaimed,
    };
  });
}
