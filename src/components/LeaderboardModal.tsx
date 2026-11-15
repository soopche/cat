import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  X, 
  Flame, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Target, 
  BookmarkCheck, 
  Sparkles,
  Cloud,
  UserCheck
} from 'lucide-react';
import { ScoreRecord, fetchLeaderboard } from '../firebase';
import { User } from 'firebase/auth';
import { AchievementItem } from '../types';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onLogin: () => void;
  achievements: AchievementItem[];
  onClaimAchievement: (id: string, reward: number) => void;
  streakDays: number;
  localRecords: ScoreRecord[];
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogin,
  achievements,
  onClaimAchievement,
  streakDays,
  localRecords
}) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'achievements'>('leaderboard');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('all');
  const [cloudRecords, setCloudRecords] = useState<ScoreRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetchLeaderboard(selectedModeFilter)
      .then(records => {
        setCloudRecords(records);
      })
      .catch(err => {
        console.warn("Could not fetch remote leaderboard, using local records:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, selectedModeFilter]);

  if (!isOpen) return null;

  // Merge cloud records and local records
  const allRecords = [...cloudRecords];
  localRecords.forEach(local => {
    if (!allRecords.some(r => r.id === local.id)) {
      if (selectedModeFilter === 'all' || local.mode === selectedModeFilter) {
        allRecords.push(local);
      }
    }
  });

  // Sort descending by WPM
  allRecords.sort((a, b) => b.wpm - a.wpm);

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'speed_text':
        return <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Скорость</span>;
      case 'word_goal':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Марафон</span>;
      case 'letter_sprint':
        return <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Буквы</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Питомец</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Рекорды и Достижения
              </h2>
              <p className="text-xs text-slate-500">
                Отслеживай свой прогресс и соревнуйся с другими юными мастерами!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 px-4 pt-2 gap-2 bg-white">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeTab === 'leaderboard'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Таблица рекордов</span>
          </button>

          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeTab === 'achievements'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Ежедневные квесты</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'leaderboard' ? (
            <div className="flex flex-col gap-3">
              {/* Cloud Sync Status Banner */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-xs text-indigo-900 font-medium">
                    {user
                      ? `Синхронизировано с аккаунтом: ${user.displayName || user.email}`
                      : 'Войди через Google, чтобы твои рекорды были видны на всех устройствах!'}
                  </span>
                </div>
                {!user && (
                  <button
                    onClick={onLogin}
                    className="px-3 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 shadow-sm transition whitespace-nowrap"
                  >
                    Войти
                  </button>
                )}
              </div>

              {/* Mode Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">
                  Режим:
                </span>
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'speed_text', label: 'Скорость текста' },
                  { id: 'word_goal', label: 'Марафон 50 слов' },
                  { id: 'letter_sprint', label: 'Буквенный спринт' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedModeFilter(item.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition border ${
                      selectedModeFilter === item.id
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Leaderboard Table */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Загрузка рекордов...</span>
                </div>
              ) : allRecords.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <span className="text-4xl block mb-2">🐾</span>
                  <p className="text-sm font-semibold text-slate-600">Здесь пока нет рекордов!</p>
                  <p className="text-xs text-slate-400 mt-1">Пройди любой режим печати и сохрани свой лучший результат!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {allRecords.map((rec, index) => {
                    const isTop1 = index === 0;
                    const isTop2 = index === 1;
                    const isTop3 = index === 2;

                    return (
                      <div
                        key={rec.id || index}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                          isTop1
                            ? 'bg-amber-50/80 border-amber-200 shadow-sm'
                            : isTop2
                            ? 'bg-slate-50 border-slate-200'
                            : isTop3
                            ? 'bg-amber-50/40 border-amber-100'
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Rank badge */}
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm">
                            {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${index + 1}`}
                          </div>

                          {/* Avatar / Name */}
                          <div className="flex items-center gap-2">
                            {rec.userPhoto ? (
                              <img
                                src={rec.userPhoto}
                                alt={rec.userName}
                                className="w-7 h-7 rounded-full border border-indigo-200"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                                {rec.userName ? rec.userName[0].toUpperCase() : 'К'}
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                  {rec.userName}
                                </span>
                                {getModeBadge(rec.mode)}
                              </div>
                              <span className="text-[10px] text-slate-400 block">
                                {rec.details || 'Отличная печать'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Numbers */}
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-base sm:text-lg font-black font-mono text-indigo-600 block leading-tight">
                              {rec.wpm} <span className="text-[10px] font-semibold text-slate-400">WPM</span>
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold block">
                              {rec.accuracy}% точность
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Daily Achievements Tab */
            <div className="flex flex-col gap-3">
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <div>
                    <span className="text-xs font-bold text-orange-900 block">
                      Ударный режим: {streakDays} {streakDays === 1 ? 'день' : 'дня'} подряд!
                    </span>
                    <span className="text-[11px] text-orange-700">
                      Заходи каждый день тренировать пальчики и получай супер-бонусы!
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-1">
                {achievements.map(ach => (
                  <div
                    key={ach.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      ach.isUnlocked
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-white border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{ach.icon}</div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 text-xs sm:text-sm">
                            {ach.title}
                          </span>
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-bold">
                            +{ach.xpReward} XP
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{ach.description}</p>
                      </div>
                    </div>

                    <div>
                      {ach.isClaimed ? (
                        <div className="flex items-center gap-1 text-slate-500 font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-xl">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Забрано</span>
                        </div>
                      ) : ach.isUnlocked ? (
                        <button
                          type="button"
                          onClick={() => onClaimAchievement(ach.id, ach.xpReward)}
                          className="flex items-center gap-1 text-white font-bold text-xs bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1 rounded-xl shadow transition animate-pulse"
                          title="Забрать опыт"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Забрать +{ach.xpReward} XP</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded-xl">
                          В процессе
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
