import React, { useEffect, useState, useMemo } from 'react';
import { 
  Trophy, 
  X, 
  Medal, 
  Zap, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  Flame, 
  User as UserIcon, 
  Globe, 
  TrendingUp, 
  Award,
  Edit3
} from 'lucide-react';
import { fetchLeaderboard, ScoreRecord } from '../firebase';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  localRecords: ScoreRecord[];
  currentUserId?: string;
  playerName?: string;
  onChangePlayerName?: (name: string) => void;
  streakDays: number;
  wordsTypedCount: number;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  localRecords,
  currentUserId,
  playerName = '',
  onChangePlayerName,
  streakDays,
  wordsTypedCount
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'global'>('personal');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [cloudRecords, setCloudRecords] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadScores = async () => {
    setLoading(true);
    try {
      const records = await fetchLeaderboard(filterMode);
      setCloudRecords(records);
    } catch (err) {
      console.warn("Could not load cloud leaderboard, using local fallback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadScores();
    }
  }, [isOpen, filterMode]);

  // Combine cloud + local records for Global Top-50
  const globalTop50 = useMemo(() => {
    const map = new Map<string, ScoreRecord>();
    localRecords.forEach(r => {
      if (filterMode === 'all' || r.mode === filterMode) {
        map.set(r.id, r);
      }
    });
    cloudRecords.forEach(r => {
      if (filterMode === 'all' || r.mode === filterMode) {
        map.set(r.id, r);
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy)
      .slice(0, 50);
  }, [localRecords, cloudRecords, filterMode]);

  // Personal records (from local device + cloud records belonging to currentUserId)
  const personalRecords = useMemo(() => {
    const map = new Map<string, ScoreRecord>();
    localRecords.forEach(r => {
      if (filterMode === 'all' || r.mode === filterMode) {
        map.set(r.id, r);
      }
    });
    if (currentUserId) {
      cloudRecords.forEach(r => {
        if (r.userId === currentUserId && (filterMode === 'all' || r.mode === filterMode)) {
          map.set(r.id, r);
        }
      });
    }
    return Array.from(map.values()).sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy);
  }, [localRecords, cloudRecords, currentUserId, filterMode]);

  // Self-competition metrics (compare personal best and recent progress)
  const personalStats = useMemo(() => {
    if (personalRecords.length === 0) {
      return {
        bestWpm: 0,
        bestAccuracy: 0,
        avgWpm: 0,
        improvementDelta: 0,
        totalRuns: 0
      };
    }
    const bestWpm = Math.max(...personalRecords.map(r => r.wpm));
    const bestAccuracy = Math.max(...personalRecords.map(r => r.accuracy));
    const avgWpm = Math.round(
      personalRecords.reduce((sum, r) => sum + r.wpm, 0) / personalRecords.length
    );
    const byDate = [...personalRecords].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const firstWpm = byDate[0]?.wpm || 0;
    const latestWpm = byDate[byDate.length - 1]?.wpm || 0;
    const improvementDelta = byDate.length >= 2 ? latestWpm - firstWpm : 0;

    return {
      bestWpm,
      bestAccuracy,
      avgWpm,
      improvementDelta,
      totalRuns: personalRecords.length
    };
  }, [personalRecords]);

  if (!isOpen) return null;

  const getModeName = (mode: string) => {
    switch (mode) {
      case 'speed_text': return 'Скорость текста';
      case 'word_goal': return 'Марафон слов';
      case 'letter_sprint': return 'Буквенный спринт';
      default: return 'Питомец';
    }
  };

  return (
    <div translate="no" className="notranslate fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Top Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-orange-50/40 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-slate-950 rounded-2xl shadow-md shadow-amber-200">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800">
                Зал Славы и Таблица Рекордов
              </h2>
              <p className="text-xs text-slate-500">
                Побеждай свои прошлые рекорды и попадай в мировой Топ-50 игроков!
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

        {/* Two Main Tabs: 1. Соревнование с собой  2. Мировой Топ-50 */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-3 sm:px-5 pt-2.5 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`flex-1 py-2.5 px-3 rounded-t-2xl font-black text-xs sm:text-sm border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'personal'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserIcon className="w-4 h-4 text-emerald-600" />
            <span>1. Соревнование с собой</span>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {personalRecords.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2.5 px-3 rounded-t-2xl font-black text-xs sm:text-sm border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'global'
                ? 'border-amber-500 text-amber-700 bg-white shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Globe className="w-4 h-4 text-amber-500" />
            <span>2. Мировой Топ-50 игроков</span>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-800 font-bold">
              ТОП-50
            </span>
          </button>
        </div>

        {/* Mode Filter & Player Name Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'Все режимы' },
              { id: 'speed_text', label: 'Скорость текста' },
              { id: 'word_goal', label: 'Марафон слов' },
              { id: 'letter_sprint', label: 'Буквенный спринт' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                  filterMode === tab.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {onChangePlayerName && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => onChangePlayerName(e.target.value)}
                  placeholder="Твой ник в Топ-50..."
                  maxLength={24}
                  className="bg-transparent text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none w-28 sm:w-36"
                />
              </div>
            )}

            <button
              type="button"
              onClick={loadScores}
              className="p-1.5 text-slate-500 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition flex items-center gap-1 text-xs font-bold"
              title="Обновить Топ-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'personal' ? (
            <div className="flex flex-col gap-4">
              {/* Self-Competition Hero Banner */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-4 text-white shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-emerald-100 text-xs font-bold uppercase tracking-wider">
                      <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
                      Твой личный вызов самому себе • Серия: {streakDays} дн.
                    </div>
                    <h3 className="text-lg font-black mt-0.5">
                      {personalStats.bestWpm > 0
                        ? `Твой рекорд: ${personalStats.bestWpm} слов/мин! Попробуй побить его сегодня!`
                        : 'Пройди любой режим до конца и нажми «Сохранить рекорд»!'}
                    </h3>
                    <p className="text-xs text-emerald-100 mt-0.5">
                      Всего напечатано слов с котиком: <b>{wordsTypedCount}</b>
                    </p>
                  </div>
                  <div className="text-4xl select-none">🚀</div>
                </div>

                {/* 4 Personal Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 border border-white/20">
                    <div className="text-[10px] text-emerald-100 font-bold uppercase">Лучшая скорость</div>
                    <div className="text-xl font-black font-mono mt-0.5">
                      {personalStats.bestWpm} <span className="text-xs font-normal">WPM</span>
                    </div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 border border-white/20">
                    <div className="text-[10px] text-emerald-100 font-bold uppercase">Средняя скорость</div>
                    <div className="text-xl font-black font-mono mt-0.5">
                      {personalStats.avgWpm} <span className="text-xs font-normal">WPM</span>
                    </div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 border border-white/20">
                    <div className="text-[10px] text-emerald-100 font-bold uppercase">Лучшая точность</div>
                    <div className="text-xl font-black font-mono mt-0.5">
                      {personalStats.bestAccuracy}%
                    </div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 border border-white/20">
                    <div className="text-[10px] text-emerald-100 font-bold uppercase flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Рост скорости
                    </div>
                    <div className="text-xl font-black font-mono mt-0.5">
                      {personalStats.improvementDelta >= 0
                        ? `+${personalStats.improvementDelta}`
                        : personalStats.improvementDelta}{' '}
                      <span className="text-xs font-normal">WPM</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Records List */}
              {personalRecords.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center gap-2">
                  <Award className="w-12 h-12 text-slate-300" />
                  <p className="text-slate-600 font-bold text-sm">
                    У тебя пока нет сохранённых личных рекордов в этом режиме.
                  </p>
                  <p className="text-xs text-slate-400 max-w-md">
                    Заверши рассказ в «Скорости текста», «Марафоне слов» или «Буквенном спринте» и нажми кнопку «Сохранить рекорд»!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {personalRecords.map((rec, index) => {
                    const isPersonalBest = index === 0;
                    return (
                      <div
                        key={rec.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                          isPersonalBest
                            ? 'bg-emerald-50/80 border-emerald-300 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                              isPersonalBest
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isPersonalBest ? '👑' : `#${index + 1}`}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 text-sm truncate">
                                {rec.userName}
                              </span>
                              {isPersonalBest && (
                                <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                                  ЛИЧНЫЙ РЕКОРД!
                                </span>
                              )}
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                {getModeName(rec.mode)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {rec.details}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-sm sm:text-base font-black text-emerald-600 font-mono flex items-center gap-1 justify-end">
                              <Zap className="w-3.5 h-3.5 fill-emerald-500" />
                              {rec.wpm} <span className="text-[10px] font-normal text-slate-400">WPM</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {rec.cpm} зн/мин
                            </div>
                          </div>

                          <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              {rec.accuracy}%
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {rec.timeSeconds}с
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Global Top-50 Leaderboard */
            <div className="flex flex-col gap-4">
              {/* Top-3 Podium Cards if available */}
              {globalTop50.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {globalTop50.slice(0, 3).map((rec, idx) => {
                    const medals = ['🥇 1 МЕСТО', '🥈 2 МЕСТО', '🥉 3 МЕСТО'];
                    const cardStyles = [
                      'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-amber-300 ring-2 ring-amber-200/60',
                      'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300',
                      'bg-gradient-to-br from-orange-50/70 to-amber-50/50 border-orange-200'
                    ];
                    return (
                      <div
                        key={rec.id}
                        className={`p-3.5 rounded-2xl border shadow-sm flex flex-col justify-between ${cardStyles[idx]}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-amber-900">
                            {medals[idx]}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-slate-600 border border-slate-200/60">
                            {getModeName(rec.mode)}
                          </span>
                        </div>
                        <div className="font-black text-slate-800 text-base truncate mt-1.5">
                          {rec.userName}
                        </div>
                        <div className="flex items-baseline justify-between mt-2">
                          <span className="text-xl font-black text-blue-600 font-mono">
                            {rec.wpm} <span className="text-xs font-bold text-slate-400">WPM</span>
                          </span>
                          <span className="text-xs font-bold text-emerald-600 font-mono">
                            {rec.accuracy}% • {rec.timeSeconds}с
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Global Top-50 List */}
              {globalTop50.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center gap-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Trophy className="w-12 h-12 text-slate-300" />
                  <p className="text-slate-600 font-bold text-sm">
                    В мировом Топ-50 пока пусто. Стань первым чемпионом!
                  </p>
                  <p className="text-xs text-slate-400">
                    Любой игрок, нажавший «Сохранить рекорд», попадает в этот рейтинг!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {globalTop50.map((rec, index) => {
                    const isTop3 = index < 3;
                    const rankColors = [
                      'bg-amber-400 text-slate-950 shadow-amber-200',
                      'bg-slate-300 text-slate-900 shadow-slate-200',
                      'bg-amber-600 text-white shadow-amber-100'
                    ];

                    return (
                      <div
                        key={rec.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                          isTop3
                            ? 'bg-amber-50/40 border-amber-200 shadow-sm'
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                              isTop3
                                ? `${rankColors[index]} shadow-sm`
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isTop3 ? <Medal className="w-4 h-4" /> : index + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 text-sm truncate">
                                {rec.userName}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">
                                {getModeName(rec.mode)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {rec.details}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-sm sm:text-base font-black text-blue-600 font-mono flex items-center gap-1 justify-end">
                              <Zap className="w-3.5 h-3.5 fill-blue-500" />
                              {rec.wpm} <span className="text-[10px] font-normal text-slate-400">WPM</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {rec.cpm} зн/мин
                            </div>
                          </div>

                          <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-emerald-600 font-mono flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {rec.accuracy}%
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {rec.timeSeconds}с
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-5 text-xs text-slate-400">
          <span>Каждый, кто нажмёт «Сохранить рекорд», попадает в мировой Топ-50!</span>
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
