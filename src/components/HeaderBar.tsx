import React from 'react';
import { 
  Trophy, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Gift, 
  LogOut, 
  Sparkles,
  Zap,
  Target,
  Cat,
  Flame,
  CheckCircle2,
  BookmarkCheck,
  MessageCircle,
  Shirt
} from 'lucide-react';
import { AppMode, CatLevel } from '../types';
import { getCatXpProgressInfo } from '../data/quests';
import { User } from 'firebase/auth';

interface HeaderBarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  xp: number;
  level: CatLevel;
  displayLevel: CatLevel;
  onOpenGrowthWardrobe: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenLeaderboard: () => void;
  onOpenQuests: () => void;
  unclaimedQuestsCount: number;
  onOpenHelp: () => void;
  onToggleReward: () => void;
  isRewardMode: boolean;
  rewardSeconds?: number;
  sessionWordCount?: number;
  streakDays: number;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentMode,
  onSelectMode,
  user,
  onLogin,
  onLogout,
  xp,
  level,
  displayLevel,
  onOpenGrowthWardrobe,
  soundEnabled,
  onToggleSound,
  onOpenLeaderboard,
  onOpenQuests,
  unclaimedQuestsCount,
  onOpenHelp,
  onToggleReward,
  isRewardMode,
  rewardSeconds = 0,
  sessionWordCount = 0,
  streakDays
}) => {
  const formatTimerClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
  const getLevelLabel = (lvl: CatLevel) => {
    switch (lvl) {
      case 'baby': return '👶 Малыш';
      case 'kitten': return '🐱 Котёнок';
      case 'teen': return '😼 Подросток';
      case 'adult': return '🦁 Взрослый';
      case 'smart': return '🎩 Учёный';
      case 'master': return '👑 Магистр';
      case 'cosmic': return '🌌 Космический';
    }
  };

  const getNextLevelXp = (lvl: CatLevel) => {
    switch (lvl) {
      case 'baby': return 250;
      case 'kitten': return 700;
      case 'teen': return 1500;
      case 'adult': return 3000;
      case 'smart': return 6000;
      case 'master': return 12000;
      case 'cosmic': return 12000;
    }
  };

  const getStageMeta = (lvl: CatLevel) => {
    switch (lvl) {
      case 'baby':
        return {
          title: 'МАЛЫШ',
          subTitle: 'Возраст: 1 месяц',
          emoji: '🍼',
          gradient: 'from-amber-400 to-orange-400',
          shadow: 'shadow-amber-200'
        };
      case 'kitten':
        return {
          title: 'КОТЁНОК',
          subTitle: 'Возраст: 3 месяца',
          emoji: '🐱',
          gradient: 'from-orange-400 to-amber-500',
          shadow: 'shadow-orange-200'
        };
      case 'teen':
        return {
          title: 'ПОДРОСТОК',
          subTitle: 'Возраст: 7 месяцев',
          emoji: '🛹',
          gradient: 'from-sky-400 to-blue-500',
          shadow: 'shadow-sky-200'
        };
      case 'adult':
        return {
          title: 'ВЗРОСЛЫЙ',
          subTitle: 'Возраст: 1.5 года',
          emoji: '🦁',
          gradient: 'from-emerald-400 to-teal-500',
          shadow: 'shadow-emerald-200'
        };
      case 'smart':
        return {
          title: 'УЧЁНЫЙ',
          subTitle: 'Возраст: 3 года',
          emoji: '🎓',
          gradient: 'from-purple-500 to-indigo-600',
          shadow: 'shadow-purple-200'
        };
      case 'master':
        return {
          title: 'МУДРЕЦ',
          subTitle: 'Возраст: 5+ лет',
          emoji: '👑',
          gradient: 'from-amber-400 to-rose-500',
          shadow: 'shadow-rose-200'
        };
      case 'cosmic':
        return {
          title: 'ИМПЕРАТОР',
          subTitle: 'Возраст: Космический',
          emoji: '🌌',
          gradient: 'from-indigo-600 via-purple-600 to-amber-400',
          shadow: 'shadow-purple-300'
        };
    }
  };

  const stageMeta = getStageMeta(displayLevel);
  const nextThreshold = getNextLevelXp(level);
  const xpInfo = getCatXpProgressInfo(xp);

  return (
    <header className="w-full max-w-7xl bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/80 p-2 sm:p-3 mb-2 flex flex-col gap-2">
      {/* Top Row: Age Badge, Level Info, Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        
        {/* Cat Age & Growth Stage - Large and Prominent */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr ${stageMeta.gradient} flex items-center justify-center text-2xl sm:text-3xl text-white shadow-md ${stageMeta.shadow} flex-shrink-0 transition-all transform hover:scale-105 select-none`}>
            {stageMeta.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xl sm:text-2xl text-slate-800 tracking-wider uppercase leading-none">
                {stageMeta.title}
              </span>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {stageMeta.subTitle}
              </span>
            </div>

            {/* Level & XP Info with clean Wardrobe Button */}
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap mt-1">
              <div className="flex flex-col gap-1 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg min-w-[115px]">
                <span className="flex items-center gap-1 text-purple-700 font-extrabold leading-none">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {xp} / {level === 'cosmic' ? 'МАКСИМУМ' : `${nextThreshold} XP`}
                </span>
                <div className="w-full h-1.5 bg-purple-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-purple-600 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${xpInfo.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Clean Growth & Wardrobe Modal trigger */}
              <button
                type="button"
                onClick={onOpenGrowthWardrobe}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-200 transition shadow-sm active:scale-95"
                title="Открыть окно роста, выбора облика и сброса"
              >
                <Shirt className="w-3 h-3 text-purple-600" />
                <span>Рост и облик</span>
              </button>

              {streakDays > 0 && (
                <span className="hidden lg:flex items-center gap-1 text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  {streakDays} дн.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* User Auth & Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Daily Quests button right next to Leaderboard */}
          <button
            type="button"
            onClick={onOpenQuests}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition shadow-sm relative active:scale-95"
            title="Ежедневные квесты и задания"
          >
            <Target className="w-4 h-4 text-purple-600" />
            <span>Квесты</span>
            {unclaimedQuestsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
              </span>
            )}
          </button>

          {/* Leaderboard button */}
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition shadow-sm active:scale-95"
            title="Таблица рекордов"
          >
            <Trophy className="w-4 h-4 text-indigo-600" />
            <span>Рекорды</span>
          </button>

          {/* Reward trainer button */}
          <button
            type="button"
            onClick={onToggleReward}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm border active:scale-95 ${
              isRewardMode
                ? 'bg-amber-500 text-white border-amber-600 animate-pulse ring-2 ring-amber-300'
                : rewardSeconds > 0
                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
            title={
              isRewardMode
                ? 'Режим награды включен! Идёт накопление времени отдыха за каждое слово во всех режимах. Нажми, чтобы использовать отдых или завершить.'
                : rewardSeconds > 0
                ? `Накоплено ${formatTimerClock(rewardSeconds)} отдыха! Нажми, чтобы начать тренировку или использовать отдых.`
                : 'Тренировка за награду: включи, чтобы каждое слово во всех режимах копило минуты отдыха!'
            }
          >
            <Gift className={`w-4 h-4 ${isRewardMode ? 'text-white' : 'text-amber-600'}`} />
            <span>
              Награда
              {rewardSeconds > 0 ? `: ${formatTimerClock(rewardSeconds)}` : ''}
            </span>
          </button>

          {/* Sound toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            className={`p-1.5 rounded-xl border transition ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
            }`}
            title={soundEnabled ? 'Звук включен' : 'Звук выключен'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Help button */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="p-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition"
            title="Справка и подсказки"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Google Auth */}
          {user ? (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 pr-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Пользователь'}
                  className="w-7 h-7 rounded-full border border-purple-300"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center text-xs">
                  {user.displayName ? user.displayName[0] : 'U'}
                </div>
              )}
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-[11px] font-bold text-slate-700 truncate max-w-[100px]">
                  {user.displayName?.split(' ')[0] || 'Игрок'}
                </span>
                <span className="text-[9px] text-emerald-600 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> В облаке
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                title="Выйти из аккаунта"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="flex items-center gap-1.5 bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition active:scale-95"
              title="Войти через Google для синхронизации рекордов"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Войти через Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Navigation Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl overflow-x-auto select-none">
        
        <button
          type="button"
          onClick={() => onSelectMode('classic_pet')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            currentMode === 'classic_pet'
              ? 'bg-white text-orange-700 shadow-sm border border-orange-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Cat className="w-4 h-4 text-orange-500" />
          <span>Питомец-Котик</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('speed_text')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            currentMode === 'speed_text'
              ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Zap className="w-4 h-4 text-blue-500" />
          <span>Скорость текста</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('word_goal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            currentMode === 'word_goal'
              ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Target className="w-4 h-4 text-emerald-500" />
          <span>Марафон слов</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('letter_sprint')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            currentMode === 'letter_sprint'
              ? 'bg-white text-purple-700 shadow-sm border border-purple-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <BookmarkCheck className="w-4 h-4 text-purple-500" />
          <span>Буквенный спринт</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('cat_chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            currentMode === 'cat_chat'
              ? 'bg-white text-pink-700 shadow-sm border border-pink-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-pink-500" />
          <span>Диалог с котиком</span>
        </button>
      </div>
    </header>
  );
};
