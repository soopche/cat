import React, { useState, useEffect, useCallback } from 'react';
import { 
  HeaderBar 
} from './components/HeaderBar';
import { 
  ClassicPetMode 
} from './components/ClassicPetMode';
import { 
  SpeedTextMode 
} from './components/SpeedTextMode';
import { 
  WordGoalMode 
} from './components/WordGoalMode';
import { 
  LetterSprintMode 
} from './components/LetterSprintMode';
import { 
  CatChatMode 
} from './components/CatChatMode';
import { 
  LeaderboardModal 
} from './components/LeaderboardModal';
import { 
  DailyQuestsModal 
} from './components/DailyQuestsModal';
import { 
  GrowthWardrobeModal 
} from './components/GrowthWardrobeModal';
import { 
  HelpModal 
} from './components/HelpModal';
import { 
  AppMode, 
  CatLevel, 
  PetStats, 
  AchievementItem 
} from './types';
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  saveScoreRecord, 
  saveUserProfile, 
  loadUserProfile, 
  testConnection, 
  ScoreRecord 
} from './firebase';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  playAlarmBeep, 
  playSuccessFanfare, 
  launchBigCelebration,
  speakRussianText
} from './utils/soundAndEffects';
import { Play, Pause, StopCircle } from 'lucide-react';

const INITIAL_ACHIEVEMENTS: AchievementItem[] = [
  {
    id: 'first_word',
    title: 'Первая лапка',
    description: 'Напечатай своё первое слово',
    icon: '🐾',
    xpReward: 10,
    isUnlocked: false
  },
  {
    id: 'speed_demon',
    title: 'Реактивный котёнок',
    description: 'Достигни скорости более 25 WPM',
    icon: '⚡',
    xpReward: 25,
    isUnlocked: false
  },
  {
    id: 'marathon_runner',
    title: 'Марафонец',
    description: 'Заверши марафон слов',
    icon: '🏃',
    xpReward: 35,
    isUnlocked: false
  },
  {
    id: 'letter_hunter',
    title: 'Буквенный следопыт',
    description: 'Освой 10 букв за день в буквенном спринте',
    icon: '🔤',
    xpReward: 50,
    isUnlocked: false
  },
  {
    id: 'chat_friend',
    title: 'Лучший собеседник',
    description: 'Поговори с котиком в режиме диалога',
    icon: '💬',
    xpReward: 25,
    isUnlocked: false
  },
  {
    id: 'keyboard_sniper',
    title: 'Снайпер клавиатуры',
    description: 'Напечатай текст с точностью более 92%',
    icon: '🎯',
    xpReward: 100,
    isUnlocked: false
  },
  {
    id: 'careful_master',
    title: 'Заботливый хозяин',
    description: 'Накорми, помой и поиграй — подними все шкалы выше 70%',
    icon: '🥣',
    xpReward: 50,
    isUnlocked: false
  },
  {
    id: 'happy_cat',
    title: 'Счастливый питомец',
    description: 'Подними шкалу радости котика до 100%',
    icon: '💖',
    xpReward: 20,
    isUnlocked: false
  },
  {
    id: 'riddle_genius',
    title: 'Юный эрудит',
    description: 'Разгадай загадку от котика',
    icon: '🧩',
    xpReward: 35,
    isUnlocked: false
  },
  {
    id: 'sport_hero',
    title: 'Спортивный котик',
    description: 'Сделай спортивную разминку с котиком',
    icon: '🏅',
    xpReward: 40,
    isUnlocked: false
  },
  {
    id: 'grand_master',
    title: 'Великий Магистр-Кот',
    description: 'Вырасти котика до наивысшего возраста',
    icon: '👑',
    xpReward: 100,
    isUnlocked: false
  }
];

export default function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('classic_pet');
  const [user, setUser] = useState<User | null>(null);

  // Stats start at minimum (15-20%) as requested
  const [stats, setStats] = useState<PetStats>({
    hunger: 18,
    sleep: 20,
    clean: 15,
    happiness: 22,
    intelligence: 16
  });

  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<CatLevel>('baby');
  const [displayLevel, setDisplayLevel] = useState<CatLevel>('baby');
  const [hasUnlockedAllAges, setHasUnlockedAllAges] = useState<boolean>(false);

  const [wordsTypedCount, setWordsTypedCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(1);
  const [achievements, setAchievements] = useState<AchievementItem[]>(INITIAL_ACHIEVEMENTS);
  const [localRecords, setLocalRecords] = useState<ScoreRecord[]>([]);

  // Sound and Virtual Keyboard settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [kbScale, setKbScale] = useState<number>(1);
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);

  // Reward Workout Mode
  const [isRewardMode, setIsRewardMode] = useState<boolean>(false);
  const [rewardSeconds, setRewardSeconds] = useState<number>(0);
  const [sessionWordCount, setSessionWordCount] = useState<number>(0);
  const [isRewardTimerActive, setIsRewardTimerActive] = useState<boolean>(false);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Modals
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showQuestsModal, setShowQuestsModal] = useState<boolean>(false);
  const [showGrowthWardrobe, setShowGrowthWardrobe] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showLevelUpNotice, setShowLevelUpNotice] = useState<boolean>(false);

  // Test Firebase on startup
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Load cloud progress
        const cloudData = await loadUserProfile(currentUser.uid);
        if (cloudData) {
          if (cloudData.xp !== undefined) setXp(prev => Math.max(prev, cloudData.xp));
          if (cloudData.wordsTypedCount) setWordsTypedCount(prev => Math.max(prev, cloudData.wordsTypedCount));
          if (cloudData.stats) setStats(cloudData.stats);
          if (cloudData.streakDays) setStreakDays(cloudData.streakDays);
        } else {
          saveUserProfile({
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Юный игрок',
            photoURL: currentUser.photoURL || undefined,
            xp,
            level,
            wordsTypedCount,
            stats,
            streakDays,
            updatedAt: new Date().toISOString()
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Load local state from localStorage on boot
  useEffect(() => {
    const saved = localStorage.getItem('typecat_save_v32');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.stats) setStats(parsed.stats);
        if (parsed.xp !== undefined) setXp(parsed.xp);
        if (parsed.level) setLevel(parsed.level);
        if (parsed.displayLevel) setDisplayLevel(parsed.displayLevel);
        if (parsed.hasUnlockedAllAges) setHasUnlockedAllAges(parsed.hasUnlockedAllAges);
        if (parsed.wordsTypedCount) setWordsTypedCount(parsed.wordsTypedCount);
        if (parsed.streakDays) setStreakDays(parsed.streakDays);
        if (parsed.soundEnabled !== undefined) setSoundEnabled(parsed.soundEnabled);
        if (parsed.kbScale) setKbScale(parsed.kbScale);
        if (parsed.rewardSeconds) setRewardSeconds(parsed.rewardSeconds);
        if (parsed.achievements && Array.isArray(parsed.achievements)) {
          setAchievements(INITIAL_ACHIEVEMENTS.map(initial => {
            const existing = parsed.achievements.find((a: AchievementItem) => a.id === initial.id);
            if (existing) {
              return {
                ...initial,
                isUnlocked: Boolean(existing.isUnlocked),
                unlockedAt: existing.unlockedAt,
                isClaimed: Boolean(existing.isClaimed)
              };
            }
            return initial;
          }));
        }
        if (parsed.localRecords) setLocalRecords(parsed.localRecords);
      } catch (e) {
        console.error("Local save load error:", e);
      }
    }
  }, []);

  // Auto save to localStorage & Firestore
  useEffect(() => {
    const payload = {
      stats,
      xp,
      level,
      displayLevel,
      hasUnlockedAllAges,
      wordsTypedCount,
      streakDays,
      soundEnabled,
      kbScale,
      rewardSeconds,
      achievements,
      localRecords
    };
    localStorage.setItem('typecat_save_v32', JSON.stringify(payload));

    if (user) {
      saveUserProfile({
        uid: user.uid,
        displayName: user.displayName || 'Юный игрок',
        photoURL: user.photoURL || undefined,
        xp,
        level,
        wordsTypedCount,
        stats,
        streakDays,
        updatedAt: new Date().toISOString()
      });
    }
  }, [stats, xp, level, displayLevel, hasUnlockedAllAges, wordsTypedCount, streakDays, soundEnabled, kbScale, rewardSeconds, achievements, localRecords, user]);

  // Quest completion announcement state
  const [questAnnounceMessage, setQuestAnnounceMessage] = useState<string | null>(null);

  // Unlock achievement helper
  const unlockAchievement = useCallback((id: string) => {
    setAchievements(prev => {
      let newlyUnlocked = false;
      const updated = prev.map(item => {
        if (item.id === id && !item.isUnlocked) {
          newlyUnlocked = true;
          return { ...item, isUnlocked: true, isClaimed: false };
        }
        return item;
      });

      if (newlyUnlocked) {
        if (soundEnabled) {
          playSuccessFanfare();
          speakRussianText("Ты выполнил квест! Забери награду!");
        }
        setQuestAnnounceMessage("Ты выполнил квест, забери награду! 🎯");
      }
      return updated;
    });
  }, [soundEnabled]);

  // Claim achievement reward
  const handleClaimAchievement = useCallback((id: string, reward: number) => {
    handleAddXp(reward);
    setAchievements(prev =>
      prev.map(item => (item.id === id ? { ...item, isClaimed: true } : item))
    );
    if (soundEnabled) playSuccessFanfare();
  }, [soundEnabled]);

  // Level calculations (Extended 2x-3x longer progression)
  useEffect(() => {
    let nextLevel: CatLevel = 'baby';
    if (xp >= 6000) nextLevel = 'master';
    else if (xp >= 3800) nextLevel = 'smart';
    else if (xp >= 2000) nextLevel = 'adult';
    else if (xp >= 900) nextLevel = 'teen';
    else if (xp >= 300) nextLevel = 'kitten';

    if (nextLevel === 'master') {
      setHasUnlockedAllAges(true);
    }

    if (nextLevel !== level) {
      setLevel(nextLevel);
      if (!hasUnlockedAllAges) {
        setDisplayLevel(nextLevel);
      }
      setShowLevelUpNotice(true);
      if (soundEnabled) playSuccessFanfare();
      launchBigCelebration();
      setTimeout(() => setShowLevelUpNotice(false), 3500);

      if (nextLevel === 'master') {
        unlockAchievement('grand_master');
      }
    }
  }, [xp, level, soundEnabled, hasUnlockedAllAges, unlockAchievement]);

  // Check achievements on stat changes
  useEffect(() => {
    if (wordsTypedCount >= 1) unlockAchievement('first_word');
    if (stats.happiness >= 99) unlockAchievement('happy_cat');
    if (stats.hunger >= 70 && stats.sleep >= 70 && stats.clean >= 70 && stats.happiness >= 70 && stats.intelligence >= 70) {
      unlockAchievement('careful_master');
    }
  }, [wordsTypedCount, stats, unlockAchievement]);

  const handleAddXp = useCallback((amount: number) => {
    setXp(prev => prev + amount);
  }, []);

  // Reset progress (cat growth)
  const handleResetProgress = () => {
    setXp(0);
    setLevel('baby');
    setDisplayLevel('baby');
    setStats({
      hunger: 18,
      sleep: 20,
      clean: 15,
      happiness: 22,
      intelligence: 16
    });
    if (soundEnabled) playSuccessFanfare();
  };

  // Google Sign-In
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      if (soundEnabled) playSuccessFanfare();
    } catch (err) {
      console.warn("Sign-in cancelled or failed:", err);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error(err);
    }
  };

  // Save record callback
  const handleSaveScoreRecord = async (record: ScoreRecord) => {
    setLocalRecords(prev => [record, ...prev].slice(0, 50));

    // Achievement checks
    if (record.wpm >= 25) unlockAchievement('speed_demon');
    if (record.mode === 'word_goal') unlockAchievement('marathon_runner');
    if (record.accuracy >= 92 && (record.mode === 'speed_text' || record.mode === 'word_goal' || record.mode === 'letter_sprint')) {
      unlockAchievement('keyboard_sniper');
    }
    if (record.mode === 'letter_sprint') {
      try {
        const todayKey = 'typecat_letters_daily_' + new Date().toISOString().slice(0, 10);
        const stored = localStorage.getItem(todayKey);
        const count = stored ? JSON.parse(stored).length : 0;
        if (count >= 10) unlockAchievement('letter_hunter');
      } catch (e) {}
    }

    if (user) {
      try {
        await saveScoreRecord(record);
      } catch (err) {
        console.warn("Cloud record save error:", err);
      }
    }
  };

  // Stat decay: every minute all indicators decrease by 2% of maximum (100 max -> 2.0 points per 60 seconds)
  // We run an interval every 6 seconds with -0.2 points (10 ticks * 0.2 = 2.0% per 60s)
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        hunger: Math.max(0, Number((prev.hunger - 0.2).toFixed(1))),
        sleep: Math.max(0, Number((prev.sleep - 0.2).toFixed(1))),
        clean: Math.max(0, Number((prev.clean - 0.2).toFixed(1))),
        happiness: Math.max(0, Number((prev.happiness - 0.2).toFixed(1))),
        intelligence: Math.max(0, Number((prev.intelligence - 0.2).toFixed(1)))
      }));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Central word completion callback for all modes
  const handleWordCompletedInAnyMode = useCallback((wordsCount: number = 1, charLength?: number) => {
    setWordsTypedCount(c => c + wordsCount);

    if (isRewardMode) {
      setSessionWordCount(c => c + wordsCount);
      // Award 12 seconds per word (or 15s if longer word >= 6 letters)
      const secPerWord = (charLength && charLength >= 6) ? 15 : 12;
      const earnedSeconds = secPerWord * wordsCount;
      setRewardSeconds(s => s + earnedSeconds);
    }
  }, [isRewardMode]);

  // Reward Workout Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning && rewardSeconds > 0) {
      interval = setInterval(() => {
        setRewardSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (soundEnabled) playAlarmBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, rewardSeconds, soundEnabled]);

  const handleToggleRewardWorkout = () => {
    if (isRewardMode) {
      setIsRewardMode(false);
      if (rewardSeconds > 0) {
        setIsRewardTimerActive(true);
      }
    } else {
      setIsRewardMode(true);
      setIsRewardTimerActive(false);
      if (soundEnabled) playSuccessFanfare();
    }
  };

  const formatTimerClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const unclaimedQuestsCount = achievements.filter(a => a.isUnlocked && !a.isClaimed).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50/40 to-amber-50/50 text-slate-800 flex flex-col items-center p-2 sm:p-4 font-sans select-none overflow-x-hidden">
      
      {/* Level Up Notification Banner */}
      {showLevelUpNotice && (
        <div className="fixed top-6 z-50 animate-bounce pointer-events-none">
          <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-white font-black px-8 py-3 rounded-full shadow-2xl text-lg sm:text-xl border-2 border-white flex items-center gap-2">
            <span>🌟</span>
            <span>НОВЫЙ УРОВЕНЬ КОТИКА!</span>
            <span>🐱</span>
          </div>
        </div>
      )}

      {/* Screen Time Reward Overlay */}
      {isRewardTimerActive && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white p-6 animate-fade-in">
          <div className="text-center max-w-md">
            <span className="text-6xl block mb-2 animate-bounce">🎁</span>
            <h2 className="text-3xl sm:text-4xl font-black mb-2 text-amber-400 tracking-tight">
              ВРЕМЯ НАГРАДЫ!
            </h2>
            <p className="text-sm text-slate-300 mb-8">
              Ты заработал экранное время отличной печатью! Включи таймер на время мультиков или отдыха.
            </p>

            {/* Huge Clock */}
            <div className="text-7xl sm:text-8xl font-mono font-black mb-6 bg-slate-800/90 text-amber-300 px-8 py-5 rounded-3xl shadow-2xl border-4 border-amber-400/80 tracking-wider">
              {formatTimerClock(rewardSeconds)}
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center gap-4 mb-6">
              {!isTimerRunning ? (
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(true)}
                  disabled={rewardSeconds <= 0}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 p-5 rounded-full transition transform hover:scale-110 shadow-lg shadow-emerald-900"
                  title="Запустить таймер отдыха"
                >
                  <Play className="w-8 h-8 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(false)}
                  className="bg-amber-500 hover:bg-amber-600 p-5 rounded-full transition transform hover:scale-110 shadow-lg shadow-amber-900"
                  title="Пауза"
                >
                  <Pause className="w-8 h-8 fill-current" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsTimerRunning(false);
                  setIsRewardTimerActive(false);
                }}
                className="bg-rose-500 hover:bg-rose-600 p-5 rounded-full transition transform hover:scale-110 shadow-lg shadow-rose-900"
                title="Закрыть"
              >
                <StopCircle className="w-8 h-8" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setIsTimerRunning(false);
                  setIsRewardTimerActive(false);
                  setIsRewardMode(true);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold border border-amber-400/30 transition shadow"
              >
                ✏️ Копить ещё (в игру)
              </button>
              {rewardSeconds > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsTimerRunning(false);
                    setRewardSeconds(0);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-xl text-xs font-bold border border-rose-400/30 transition shadow"
                >
                  🔄 Сбросить время
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main App Layout */}
      <div className="w-full max-w-7xl flex flex-col items-center">
        {/* Header Bar with Quests and Wardrobe triggers */}
        <HeaderBar
          currentMode={currentMode}
          onSelectMode={setCurrentMode}
          user={user}
          onLogin={handleGoogleLogin}
          onLogout={handleGoogleLogout}
          xp={xp}
          level={level}
          displayLevel={displayLevel}
          onOpenGrowthWardrobe={() => setShowGrowthWardrobe(true)}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onOpenQuests={() => setShowQuestsModal(true)}
          unclaimedQuestsCount={unclaimedQuestsCount}
          onOpenHelp={() => setShowHelp(true)}
          onToggleReward={handleToggleRewardWorkout}
          isRewardMode={isRewardMode}
          rewardSeconds={rewardSeconds}
          sessionWordCount={sessionWordCount}
          streakDays={streakDays}
        />

        {/* Reward Training Notification Banner */}
        {isRewardMode && (
          <div className="w-full max-w-4xl bg-gradient-to-r from-amber-100 via-amber-50 to-orange-100 border-2 border-amber-300 text-amber-950 px-4 py-2.5 rounded-2xl mb-2 flex items-center justify-between text-xs font-bold animate-fade-in shadow-sm flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <span className="text-xl">🎁</span>
              <span>
                Режим награды активен: печатай в <b>любом режиме</b> (марафон, тексты, буквы, диалог, питомец) — каждое слово увеличивает отдых!
              </span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-white/80 px-2.5 py-1 rounded-xl text-amber-900 border border-amber-200">
                Слов: <b>{sessionWordCount}</b>
              </span>
              <span className="bg-amber-200 px-3 py-1 rounded-xl text-amber-950 font-mono text-sm font-black border border-amber-300">
                +{formatTimerClock(rewardSeconds)}
              </span>
              <button
                type="button"
                onClick={() => setIsRewardTimerActive(true)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm transition active:scale-95"
                title="Перейти к экрану отдыха с таймером"
              >
                Отдыхать 🍿
              </button>
              <button
                type="button"
                onClick={handleToggleRewardWorkout}
                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition"
                title="Выключить режим награды"
              >
                Выкл
              </button>
            </div>
          </div>
        )}

        {/* Content View Based on Active Mode */}
        <main className="w-full flex flex-col items-center mt-1">
          {currentMode === 'classic_pet' && (
            <ClassicPetMode
              stats={stats}
              onUpdateStats={setStats}
              xp={xp}
              level={level}
              displayLevel={displayLevel}
              onAddXp={handleAddXp}
              wordsTypedCount={wordsTypedCount}
              onIncrementWordsCount={() => setWordsTypedCount(c => c + 1)}
              soundEnabled={soundEnabled}
              kbScale={kbScale}
              onSetKbScale={setKbScale}
              isMobileMode={isMobileMode}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              isRewardMode={isRewardMode}
              onAddRewardSeconds={(sec) => setRewardSeconds(s => s + sec)}
              rewardSeconds={rewardSeconds}
              sessionWordCount={sessionWordCount}
              onIncrementSessionWordCount={() => setSessionWordCount(c => c + 1)}
              onWordCompleted={handleWordCompletedInAnyMode}
              questAnnounceMessage={questAnnounceMessage}
              onClearQuestAnnounce={() => setQuestAnnounceMessage(null)}
              onUnlockAchievement={unlockAchievement}
            />
          )}

          {currentMode === 'speed_text' && (
            <SpeedTextMode
              user={user}
              soundEnabled={soundEnabled}
              onSaveRecord={handleSaveScoreRecord}
              onAddXp={handleAddXp}
              kbScale={kbScale}
              onSetKbScale={setKbScale}
              isMobileMode={isMobileMode}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              isRewardMode={isRewardMode}
              onWordCompleted={handleWordCompletedInAnyMode}
            />
          )}

          {currentMode === 'word_goal' && (
            <WordGoalMode
              user={user}
              soundEnabled={soundEnabled}
              onSaveRecord={handleSaveScoreRecord}
              onAddXp={handleAddXp}
              kbScale={kbScale}
              onSetKbScale={setKbScale}
              isMobileMode={isMobileMode}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              isRewardMode={isRewardMode}
              onWordCompleted={handleWordCompletedInAnyMode}
            />
          )}

          {currentMode === 'letter_sprint' && (
            <LetterSprintMode
              user={user}
              soundEnabled={soundEnabled}
              onSaveRecord={handleSaveScoreRecord}
              onAddXp={handleAddXp}
              kbScale={kbScale}
              onSetKbScale={setKbScale}
              isMobileMode={isMobileMode}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              isRewardMode={isRewardMode}
              onWordCompleted={handleWordCompletedInAnyMode}
              onUnlockAchievement={unlockAchievement}
            />
          )}

          {currentMode === 'cat_chat' && (
            <CatChatMode
              catLevel={displayLevel}
              soundEnabled={soundEnabled}
              onAddXp={(amount) => {
                handleAddXp(amount);
                unlockAchievement('chat_friend');
              }}
              kbScale={kbScale}
              onSetKbScale={setKbScale}
              isMobileMode={isMobileMode}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              isRewardMode={isRewardMode}
              onWordCompleted={handleWordCompletedInAnyMode}
            />
          )}
        </main>
      </div>

      {/* Growth, Wardrobe and Reset Modal */}
      <GrowthWardrobeModal
        isOpen={showGrowthWardrobe}
        onClose={() => setShowGrowthWardrobe(false)}
        xp={xp}
        level={level}
        displayLevel={displayLevel}
        onSelectDisplayLevel={setDisplayLevel}
        hasUnlockedAllAges={hasUnlockedAllAges}
        onResetProgress={handleResetProgress}
      />

      {/* Dedicated Daily Quests Modal */}
      <DailyQuestsModal
        isOpen={showQuestsModal}
        onClose={() => setShowQuestsModal(false)}
        achievements={achievements}
        onClaimAchievement={handleClaimAchievement}
        streakDays={streakDays}
      />

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        user={user}
        onLogin={handleGoogleLogin}
        achievements={achievements}
        onClaimAchievement={handleClaimAchievement}
        streakDays={streakDays}
        localRecords={localRecords}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}
