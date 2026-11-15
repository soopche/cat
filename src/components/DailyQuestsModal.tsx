import React from 'react';
import { 
  Flame, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Trophy,
  Target
} from 'lucide-react';
import { AchievementItem } from '../types';

interface DailyQuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: AchievementItem[];
  onClaimAchievement: (id: string, reward: number) => void;
  streakDays: number;
}

export const DailyQuestsModal: React.FC<DailyQuestsModalProps> = ({
  isOpen,
  onClose,
  achievements,
  onClaimAchievement,
  streakDays
}) => {
  if (!isOpen) return null;

  const completedCount = achievements.filter(a => a.isUnlocked).length;
  const totalCount = achievements.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50/50 to-pink-50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <span>Ежедневные квесты</span>
                <span className="text-xs font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                  {completedCount} / {totalCount}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Выполняй задания каждый день и получай горы опыта для роста котика!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white/80 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3">
          
          {/* Streak Banner */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
                🔥
              </div>
              <div>
                <span className="text-sm font-black block">
                  Серия тренировок: {streakDays} {streakDays === 1 ? 'день' : 'дня'} подряд!
                </span>
                <span className="text-xs text-orange-100">
                  Заходи каждый день тренировать пальчики и получай супер-бонусы!
                </span>
              </div>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
              <span>Прогресс достижений:</span>
              <span className="text-purple-600 font-mono">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Quests List */}
          <div className="flex flex-col gap-2 mt-1">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                  ach.isUnlocked
                    ? 'bg-emerald-50/70 border-emerald-200 shadow-sm'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl sm:text-3xl flex-shrink-0">
                    {ach.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-800 text-xs sm:text-sm">
                        {ach.title}
                      </span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                        +{ach.xpReward} XP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {ach.description}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {ach.isClaimed ? (
                    <div className="flex items-center gap-1 text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl font-bold text-xs border border-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Забрано</span>
                    </div>
                  ) : ach.isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => onClaimAchievement(ach.id, ach.xpReward)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-200 transition transform hover:scale-105 active:scale-95 animate-pulse"
                      title="Забрать опыт за выполненное задание"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Забрать +{ach.xpReward} XP</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-bold bg-slate-100 px-3 py-1.5 rounded-xl block text-center">
                      В процессе
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
