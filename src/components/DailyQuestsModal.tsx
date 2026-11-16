import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Sparkles, 
  Gift, 
  Flame, 
  Trophy, 
  CalendarClock, 
  Crown 
} from 'lucide-react';
import { AchievementItem } from '../types';

interface DailyQuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: AchievementItem[];
  onClaimQuest: (id: string) => void;
  streakDays: number;
  wordsTypedCount: number;
}

export const DailyQuestsModal: React.FC<DailyQuestsModalProps> = ({
  isOpen,
  onClose,
  achievements,
  onClaimQuest,
  streakDays,
  wordsTypedCount
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'longterm'>('daily');

  if (!isOpen) return null;

  const dailyQuests = achievements.filter(a => a.category !== 'longterm');
  const longTermQuests = achievements.filter(a => a.category === 'longterm');

  const dailyReadyToClaim = dailyQuests.filter(a => a.isUnlocked && !a.isClaimed).length;
  const longTermReadyToClaim = longTermQuests.filter(a => a.isUnlocked && !a.isClaimed).length;

  const dailyClaimedCount = dailyQuests.filter(a => a.isClaimed).length;
  const longTermClaimedCount = longTermQuests.filter(a => a.isClaimed).length;

  const activeList = activeTab === 'daily' ? dailyQuests : longTermQuests;

  // Sort: ready-to-claim first, then in-progress, then already claimed
  const sortedQuests = [...activeList].sort((a, b) => {
    const aReady = a.isUnlocked && !a.isClaimed ? 0 : a.isClaimed ? 2 : 1;
    const bReady = b.isUnlocked && !b.isClaimed ? 0 : b.isClaimed ? 2 : 1;
    return aReady - bReady;
  });

  const renderQuestCard = (ach: AchievementItem) => {
    const isReadyToClaim = ach.isUnlocked && !ach.isClaimed;
    const isClaimed = Boolean(ach.isClaimed);
    const currentVal = ach.currentProgress ?? (ach.isUnlocked ? 1 : 0);
    const targetVal = ach.targetProgress ?? 1;
    const pct = Math.min(100, Math.round((currentVal / Math.max(1, targetVal)) * 100));

    return (
      <div
        key={ach.id}
        className={`p-3.5 sm:p-4 rounded-2xl border flex items-center gap-3.5 transition-all ${
          isReadyToClaim
            ? 'bg-gradient-to-r from-emerald-50 via-teal-50/70 to-amber-50 border-emerald-400 shadow-md ring-2 ring-emerald-200/70'
            : isClaimed
            ? 'bg-slate-50/90 border-slate-200 opacity-80'
            : 'bg-white border-slate-200 hover:border-purple-200 shadow-sm'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
            isReadyToClaim
              ? 'bg-emerald-500 text-white shadow-sm animate-bounce'
              : isClaimed
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-purple-50 text-purple-600'
          }`}
        >
          {ach.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className={`font-black text-sm ${isClaimed ? 'text-slate-600' : 'text-slate-800'}`}>
              {ach.title}
            </h4>
            <span
              className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                isReadyToClaim
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : isClaimed
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-purple-100 text-purple-700'
              }`}
            >
              <Sparkles className="w-3 h-3" />+{ach.xpReward} XP
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-0.5 leading-snug">
            {ach.description}
          </p>

          {/* Progress Bar */}
          {!isClaimed && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isReadyToClaim
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-500 whitespace-nowrap">
                {currentVal} / {targetVal}
              </span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {isReadyToClaim ? (
            <button
              type="button"
              onClick={() => onClaimQuest(ach.id)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-200 transition transform hover:scale-105 active:scale-95 flex items-center gap-1.5"
            >
              <Gift className="w-4 h-4" />
              <span>Забрать!</span>
            </button>
          ) : isClaimed ? (
            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Получено</span>
            </div>
          ) : (
            <div className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-xl">
              {pct}%
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div translate="no" className="notranslate fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50/40 to-amber-50/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500 text-white rounded-2xl shadow-md shadow-purple-200">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Квесты и испытания котика
              </h2>
              <p className="text-xs text-slate-500">
                Выполняй быстрые задания на 5 минут каждый день и проходи 30 великих испытаний!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs: Daily 5-min Quests vs 30 Challenging Quests */}
        <div className="px-4 sm:px-5 pt-3 pb-2 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 border ${
                activeTab === 'daily'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-700 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              <span>На сегодня ({dailyClaimedCount}/{dailyQuests.length})</span>
              {dailyReadyToClaim > 0 && (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-400 text-slate-950 font-black animate-pulse">
                  +{dailyReadyToClaim}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('longterm')}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 border ${
                activeTab === 'longterm'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-orange-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>30 испытаний ({longTermClaimedCount}/{longTermQuests.length})</span>
              {longTermReadyToClaim > 0 && (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-400 text-slate-950 font-black animate-pulse">
                  +{longTermReadyToClaim}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3">
          {/* Summary Banner */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-3.5 text-white flex items-center justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-1.5 text-amber-200 font-bold text-xs uppercase tracking-wider">
                <Flame className="w-4 h-4 fill-amber-300 text-amber-300" />
                {activeTab === 'daily'
                  ? `Ежедневная серия: ${streakDays} дн. (обновляются каждый день)`
                  : 'Путь к Космическому Императору (12 000 XP)'}
              </div>
              <h3 className="text-base font-black mt-0.5">
                {activeTab === 'daily'
                  ? `Быстрые задания на 5 минут: ${dailyClaimedCount} из ${dailyQuests.length}`
                  : `Великие испытания пройдено: ${longTermClaimedCount} из ${longTermQuests.length}`}
              </h3>
              <p className="text-[11px] text-purple-100 mt-0.5">
                Всего напечатано слов: <b>{wordsTypedCount}</b>
              </p>
            </div>
            <div className="text-4xl select-none">
              {activeTab === 'daily' ? '🎁' : '🌌'}
            </div>
          </div>

          {/* Quest Cards */}
          <div className="flex flex-col gap-2.5">
            {sortedQuests.map(renderQuestCard)}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-5 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            Нажми «Забрать!», чтобы получить опыт и вырастить котика!
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
