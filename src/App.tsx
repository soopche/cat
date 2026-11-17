import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  CatChatMode,
  CoopChatMessageItem
} from './components/CatChatMode';
import {
  CoopBar
} from './components/CoopBar';
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
  QuestProgressCounters 
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
  playCorrectBeep,
  playSuccessFanfare, 
  launchBigCelebration,
  speakRussianText
} from './utils/soundAndEffects';
import {
  getCatLevelFromXp,
  getTodayLocalDateString,
  createInitialQuestCounters,
  evaluateAllQuests,
  CAT_STAGE_THRESHOLDS,
  parseLearnedAlphabetLetters,
  addLearnedAlphabetLetter,
  mergeLearnedAlphabetLetters
} from './data/quests';
import {
  MqttCoopRoomManager,
  CoopPlayerState,
  CoopGameConfig,
  CoopRoomEvent,
  CoopActiveMode,
  generateTwoDigitRoomCode,
  getOrCreateSessionPlayerId,
  findOrCreateRandomRoom
} from './utils/mqttCoopRoom';
import { Play, Pause, StopCircle } from 'lucide-react';

const LOCAL_SAVE_KEY = 'typecat_save_v32';

const EMPTY_PET_STATS: PetStats = {
  hunger: 0,
  sleep: 0,
  clean: 0,
  happiness: 0,
  intelligence: 0
};

function clampDisplayLevelToUnlocked(desired: CatLevel | string | undefined, xp: number, fallback: CatLevel): CatLevel {
  if (!desired) return fallback;
  const stageObj = CAT_STAGE_THRESHOLDS.find(s => s.level === desired);
  if (!stageObj) return fallback;
  return xp >= stageObj.requiredXp ? stageObj.level : fallback;
}

interface InitialLocalSave {
  stats: PetStats;
  statsDate: string;
  xp: number;
  level: CatLevel;
  displayLevel: CatLevel;
  hasUnlockedAllAges: boolean;
  wordsTypedCount: number;
  streakDays: number;
  lastActiveDate: string;
  soundEnabled: boolean;
  kbScale: number;
  rewardSeconds: number;
  claimedQuestIds: string[];
  unlockedQuestIds: string[];
  questCounters: QuestProgressCounters;
  localRecords: ScoreRecord[];
  playerName: string;
}

function loadInitialLocalSave(): InitialLocalSave {
  const todayStr = getTodayLocalDateString();
  const defaults: InitialLocalSave = {
    stats: { ...EMPTY_PET_STATS },
    statsDate: todayStr,
    xp: 0,
    level: 'baby',
    displayLevel: 'baby',
    hasUnlockedAllAges: false,
    wordsTypedCount: 0,
    streakDays: 1,
    lastActiveDate: todayStr,
    soundEnabled: true,
    kbScale: 1,
    rewardSeconds: 0,
    claimedQuestIds: [],
    unlockedQuestIds: [],
    questCounters: createInitialQuestCounters(todayStr),
    localRecords: [],
    playerName: ''
  };

  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);

    const xp = typeof parsed.xp === 'number' ? parsed.xp : defaults.xp;
    const computedLevel = getCatLevelFromXp(xp);
    // Only unlock all ages when reaching the true maximum 7th stage (12000 XP)
    const hasUnlockedAllAges = computedLevel === 'cosmic';
    const displayLevel: CatLevel = clampDisplayLevelToUnlocked(parsed.displayLevel, xp, computedLevel);

    // Migrate legacy achievements array if present
    const legacyClaimed: string[] = [];
    const legacyUnlocked: string[] = [];
    if (Array.isArray(parsed.achievements)) {
      for (const a of parsed.achievements) {
        if (a && a.id) {
          if (a.isUnlocked) legacyUnlocked.push(a.id);
          if (a.isClaimed) legacyClaimed.push(a.id);
        }
      }
    }

    const claimedQuestIds = Array.from(
      new Set([...(Array.isArray(parsed.claimedQuestIds) ? parsed.claimedQuestIds : []), ...legacyClaimed])
    );
    const unlockedQuestIds = Array.from(
      new Set([...(Array.isArray(parsed.unlockedQuestIds) ? parsed.unlockedQuestIds : []), ...legacyUnlocked])
    );

    const savedCounters = parsed.questCounters || {};
    const isSameCounterDay = savedCounters.dailyDate === todayStr;
    const wordsTypedCount = typeof parsed.wordsTypedCount === 'number' ? parsed.wordsTypedCount : 0;

    const questCounters: QuestProgressCounters = {
      dailyDate: todayStr,
      dailyWords: isSameCounterDay ? Number(savedCounters.dailyWords || 0) : 0,
      dailyFeedings: isSameCounterDay ? Number(savedCounters.dailyFeedings || 0) : 0,
      dailyCareActions: isSameCounterDay ? Number(savedCounters.dailyCareActions || 0) : 0,
      dailyRiddlesMathSport: isSameCounterDay ? Number(savedCounters.dailyRiddlesMathSport || 0) : 0,
      dailyMarathons: isSameCounterDay ? Number(savedCounters.dailyMarathons || 0) : 0,
      dailySpeedTexts: isSameCounterDay ? Number(savedCounters.dailySpeedTexts || 0) : 0,
      dailySprintLetters: isSameCounterDay ? Number(savedCounters.dailySprintLetters || 0) : 0,
      dailyChatMessages: isSameCounterDay ? Number(savedCounters.dailyChatMessages || 0) : 0,
      totalWords: Math.max(wordsTypedCount, Number(savedCounters.totalWords || 0)),
      totalMarathons: Number(savedCounters.totalMarathons || 0),
      totalSpeedTexts: Number(savedCounters.totalSpeedTexts || 0),
      totalSprintLetters: Number(savedCounters.totalSprintLetters || 0),
      totalRiddles: Number(savedCounters.totalRiddles || 0),
      totalMath: Number(savedCounters.totalMath || 0),
      totalSport: Number(savedCounters.totalSport || 0),
      totalFeedings: Number(savedCounters.totalFeedings || 0),
      totalWashings: Number(savedCounters.totalWashings || 0),
      totalSleeps: Number(savedCounters.totalSleeps || 0),
      totalPlays: Number(savedCounters.totalPlays || 0),
      totalChats: Number(savedCounters.totalChats || 0),
      maxWpm: Number(savedCounters.maxWpm || 0),
      highAccuracyTexts: Number(savedCounters.highAccuracyTexts || 0),
      recordsSaved: Number(savedCounters.recordsSaved || (Array.isArray(parsed.localRecords) ? parsed.localRecords.length : 0)),
      learnedAlphabetLetters: typeof savedCounters.learnedAlphabetLetters === 'string' ? savedCounters.learnedAlphabetLetters : '',
    };

    // Check if user entered today or on a different day:
    // Same day (e.g., 7 AM and 9 PM today): keep exact scales from exit!
    // Different day: all scales start at 0% (empty)!
    const savedStatsDate = parsed.statsDate || parsed.lastActiveDate || savedCounters.dailyDate;
    const isSameStatsDay = savedStatsDate === todayStr;
    const stats: PetStats = isSameStatsDay && parsed.stats
      ? {
          hunger: Number(parsed.stats.hunger ?? 0),
          sleep: Number(parsed.stats.sleep ?? 0),
          clean: Number(parsed.stats.clean ?? 0),
          happiness: Number(parsed.stats.happiness ?? 0),
          intelligence: Number(parsed.stats.intelligence ?? 0),
        }
      : { ...EMPTY_PET_STATS };

    // Update streak if user returns on a new day
    let streakDays = typeof parsed.streakDays === 'number' ? parsed.streakDays : 1;
    const lastActiveDate = parsed.lastActiveDate || todayStr;
    if (lastActiveDate !== todayStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getTodayLocalDateString(yesterday);
      if (lastActiveDate === yesterdayStr) {
        streakDays += 1;
      }
    }

    return {
      stats,
      statsDate: todayStr,
      xp,
      level: computedLevel,
      displayLevel,
      hasUnlockedAllAges,
      wordsTypedCount,
      streakDays,
      lastActiveDate: todayStr,
      soundEnabled: parsed.soundEnabled !== undefined ? Boolean(parsed.soundEnabled) : true,
      kbScale: typeof parsed.kbScale === 'number' ? parsed.kbScale : 1,
      rewardSeconds: typeof parsed.rewardSeconds === 'number' ? parsed.rewardSeconds : 0,
      claimedQuestIds,
      unlockedQuestIds,
      questCounters,
      localRecords: Array.isArray(parsed.localRecords) ? parsed.localRecords : [],
      playerName: typeof parsed.playerName === 'string' ? parsed.playerName : ''
    };
  } catch (e) {
    console.error('Local save load error:', e);
    return defaults;
  }
}

export default function App() {
  const initialSave = useMemo(() => loadInitialLocalSave(), []);

  const [currentMode, setCurrentMode] = useState<AppMode>('classic_pet');
  const [user, setUser] = useState<User | null>(null);
  const [playerName, setPlayerName] = useState<string>(initialSave.playerName);

  const [stats, setStats] = useState<PetStats>(initialSave.stats);
  const [statsDate, setStatsDate] = useState<string>(initialSave.statsDate);
  const [xp, setXp] = useState<number>(initialSave.xp);
  const [level, setLevel] = useState<CatLevel>(initialSave.level);
  const [displayLevel, setDisplayLevel] = useState<CatLevel>(initialSave.displayLevel);
  const [hasUnlockedAllAges, setHasUnlockedAllAges] = useState<boolean>(initialSave.hasUnlockedAllAges);

  const [wordsTypedCount, setWordsTypedCount] = useState<number>(initialSave.wordsTypedCount);
  const [streakDays, setStreakDays] = useState<number>(initialSave.streakDays);
  const [claimedQuestIds, setClaimedQuestIds] = useState<string[]>(initialSave.claimedQuestIds);
  const [unlockedQuestIds, setUnlockedQuestIds] = useState<string[]>(initialSave.unlockedQuestIds);
  const [questCounters, setQuestCounters] = useState<QuestProgressCounters>(initialSave.questCounters);
  const [localRecords, setLocalRecords] = useState<ScoreRecord[]>(initialSave.localRecords);

  // Sound and Virtual Keyboard settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(initialSave.soundEnabled);
  const [kbScale, setKbScale] = useState<number>(initialSave.kbScale);
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);

  // Reward Workout Mode
  const [isRewardMode, setIsRewardMode] = useState<boolean>(false);
  const [rewardSeconds, setRewardSeconds] = useState<number>(initialSave.rewardSeconds);
  const [sessionWordCount, setSessionWordCount] = useState<number>(0);
  const [isRewardTimerActive, setIsRewardTimerActive] = useState<boolean>(false);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Lazy MQTT Co-op Multiplayer State (100% idle until user clicks "Кооператив")
  const selfPlayerId = useMemo(() => getOrCreateSessionPlayerId(), []);
  const [isCoopOpen, setIsCoopOpen] = useState<boolean>(false);
  const [coopRoomCode, setCoopRoomCode] = useState<string | null>(null);
  const [isCoopHost, setIsCoopHost] = useState<boolean>(false);
  const [coopConnectionStatus, setCoopConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [isMatchmaking, setIsMatchmaking] = useState<boolean>(false);
  const [coopPlayers, setCoopPlayers] = useState<CoopPlayerState[]>([]);
  const [coopSharedConfig, setCoopSharedConfig] = useState<CoopGameConfig | null>(null);
  const [coopRoundTrigger, setCoopRoundTrigger] = useState<number>(0);
  const [coopChatMessages, setCoopChatMessages] = useState<CoopChatMessageItem[]>([]);
  const [coopSessionWords, setCoopSessionWords] = useState<number>(0);
  const [coopSessionRewardSec, setCoopSessionRewardSec] = useState<number>(0);

  const roomManagerRef = useRef<MqttCoopRoomManager | null>(null);
  const matchmakingCleanupRef = useRef<(() => void) | null>(null);
  const isCoopHostRef = useRef<boolean>(false);
  isCoopHostRef.current = isCoopHost;
  const coopSharedConfigRef = useRef<CoopGameConfig | null>(null);
  coopSharedConfigRef.current = coopSharedConfig;
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Modals
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showQuestsModal, setShowQuestsModal] = useState<boolean>(false);
  const [showGrowthWardrobe, setShowGrowthWardrobe] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showLevelUpNotice, setShowLevelUpNotice] = useState<boolean>(false);

  // Quest completion announcement state
  const [questAnnounceMessage, setQuestAnnounceMessage] = useState<string | null>(null);

  // Guard so cloud auto-save NEVER overwrites Firestore before loadUserProfile completes
  const isCloudHydratedRef = useRef<boolean>(false);
  // Track whether user actively typed in this session before cloud profile finished loading
  const typedInCurrentSessionRef = useRef<boolean>(false);

  const stateSnapshotRef = useRef({
    stats,
    statsDate,
    xp,
    level,
    displayLevel,
    hasUnlockedAllAges,
    wordsTypedCount,
    streakDays,
    rewardSeconds,
    claimedQuestIds,
    unlockedQuestIds,
    questCounters,
    playerName
  });
  stateSnapshotRef.current = {
    stats,
    statsDate,
    xp,
    level,
    displayLevel,
    hasUnlockedAllAges,
    wordsTypedCount,
    streakDays,
    rewardSeconds,
    claimedQuestIds,
    unlockedQuestIds,
    questCounters,
    playerName
  };

  // Test Firebase on startup
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Auth State & Perform Safe Cross-Device Cloud Merge (Account-authoritative for same-day vs new-day scales)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        isCloudHydratedRef.current = false;
        setUser(null);
        return;
      }

      isCloudHydratedRef.current = false;
      setUser(currentUser);
      if (currentUser.displayName && !stateSnapshotRef.current.playerName) {
        setPlayerName(currentUser.displayName);
      }

      try {
        const cloudData = await loadUserProfile(currentUser.uid);
        const snap = stateSnapshotRef.current;
        const todayStr = getTodayLocalDateString();

        if (cloudData) {
          const cloudXp = typeof cloudData.xp === 'number' ? cloudData.xp : 0;
          const mergedXp = Math.max(snap.xp, cloudXp);
          const mergedLevel = getCatLevelFromXp(mergedXp);
          // True maximum is 'cosmic' at 12000 XP; do not unlock cosmic early on 7300 XP accounts!
          const mergedUnlockedAll = mergedLevel === 'cosmic';

          const preferredDisplay =
            cloudData.displayLevel && (cloudXp >= snap.xp || snap.displayLevel === 'baby')
              ? cloudData.displayLevel
              : snap.displayLevel;
          const mergedDisplayLevel: CatLevel = clampDisplayLevelToUnlocked(
            preferredDisplay,
            mergedXp,
            mergedLevel
          );

          const mergedWords = Math.max(snap.wordsTypedCount, cloudData.wordsTypedCount || 0);
          const mergedStreak = Math.max(snap.streakDays, cloudData.streakDays || 1);
          const mergedReward = Math.max(snap.rewardSeconds, cloudData.rewardSeconds || 0);

          const cc = (cloudData.questCounters || {}) as Record<string, number | string>;
          const cloudStatsDate = cloudData.statsDate || cloudData.lastActiveDate || String(cc.dailyDate || '');
          const isCloudFromToday = cloudStatsDate === todayStr;

          // Daily scales logic from account:
          // - If account was saved TODAY (e.g. entered at 7 AM, exited, came back at 9 PM): restore account scales!
          // - If account was last saved on ANOTHER day: scales are empty (0%), unless user already typed words right now in this session.
          let mergedStats: PetStats;
          if (isCloudFromToday && cloudData.stats) {
            if (typedInCurrentSessionRef.current) {
              mergedStats = {
                hunger: Math.max(snap.stats.hunger, Number(cloudData.stats.hunger ?? 0)),
                sleep: Math.max(snap.stats.sleep, Number(cloudData.stats.sleep ?? 0)),
                clean: Math.max(snap.stats.clean, Number(cloudData.stats.clean ?? 0)),
                happiness: Math.max(snap.stats.happiness, Number(cloudData.stats.happiness ?? 0)),
                intelligence: Math.max(snap.stats.intelligence, Number(cloudData.stats.intelligence ?? 0)),
              };
            } else {
              mergedStats = {
                hunger: Number(cloudData.stats.hunger ?? 0),
                sleep: Number(cloudData.stats.sleep ?? 0),
                clean: Number(cloudData.stats.clean ?? 0),
                happiness: Number(cloudData.stats.happiness ?? 0),
                intelligence: Number(cloudData.stats.intelligence ?? 0),
              };
            }
          } else {
            mergedStats = typedInCurrentSessionRef.current ? snap.stats : { ...EMPTY_PET_STATS };
          }

          const mergedClaimed = Array.from(
            new Set([
              ...snap.claimedQuestIds,
              ...(Array.isArray(cloudData.claimedQuestIds) ? cloudData.claimedQuestIds : []),
              ...(Array.isArray(cloudData.dailyAchievements) ? cloudData.dailyAchievements : []),
            ])
          );

          const mergedUnlocked = Array.from(
            new Set([
              ...snap.unlockedQuestIds,
              ...(Array.isArray(cloudData.unlockedQuestIds) ? cloudData.unlockedQuestIds : []),
              ...mergedClaimed,
            ])
          );

          const cloudSameDay = cc.dailyDate === todayStr;

          const mergedCounters: QuestProgressCounters = {
            dailyDate: todayStr,
            dailyWords: Math.max(snap.questCounters.dailyWords, cloudSameDay ? Number(cc.dailyWords || 0) : 0),
            dailyFeedings: Math.max(snap.questCounters.dailyFeedings, cloudSameDay ? Number(cc.dailyFeedings || 0) : 0),
            dailyCareActions: Math.max(snap.questCounters.dailyCareActions, cloudSameDay ? Number(cc.dailyCareActions || 0) : 0),
            dailyRiddlesMathSport: Math.max(snap.questCounters.dailyRiddlesMathSport, cloudSameDay ? Number(cc.dailyRiddlesMathSport || 0) : 0),
            dailyMarathons: Math.max(snap.questCounters.dailyMarathons, cloudSameDay ? Number(cc.dailyMarathons || 0) : 0),
            dailySpeedTexts: Math.max(snap.questCounters.dailySpeedTexts, cloudSameDay ? Number(cc.dailySpeedTexts || 0) : 0),
            dailySprintLetters: Math.max(snap.questCounters.dailySprintLetters, cloudSameDay ? Number(cc.dailySprintLetters || 0) : 0),
            dailyChatMessages: Math.max(snap.questCounters.dailyChatMessages, cloudSameDay ? Number(cc.dailyChatMessages || 0) : 0),
            totalWords: Math.max(mergedWords, snap.questCounters.totalWords, Number(cc.totalWords || 0)),
            totalMarathons: Math.max(snap.questCounters.totalMarathons, Number(cc.totalMarathons || 0)),
            totalSpeedTexts: Math.max(snap.questCounters.totalSpeedTexts, Number(cc.totalSpeedTexts || 0)),
            totalSprintLetters: Math.max(snap.questCounters.totalSprintLetters, Number(cc.totalSprintLetters || 0)),
            totalRiddles: Math.max(snap.questCounters.totalRiddles, Number(cc.totalRiddles || 0)),
            totalMath: Math.max(snap.questCounters.totalMath, Number(cc.totalMath || 0)),
            totalSport: Math.max(snap.questCounters.totalSport, Number(cc.totalSport || 0)),
            totalFeedings: Math.max(snap.questCounters.totalFeedings, Number(cc.totalFeedings || 0)),
            totalWashings: Math.max(snap.questCounters.totalWashings, Number(cc.totalWashings || 0)),
            totalSleeps: Math.max(snap.questCounters.totalSleeps, Number(cc.totalSleeps || 0)),
            totalPlays: Math.max(snap.questCounters.totalPlays, Number(cc.totalPlays || 0)),
            totalChats: Math.max(snap.questCounters.totalChats, Number(cc.totalChats || 0)),
            maxWpm: Math.max(snap.questCounters.maxWpm, Number(cc.maxWpm || 0)),
            highAccuracyTexts: Math.max(snap.questCounters.highAccuracyTexts, Number(cc.highAccuracyTexts || 0)),
            recordsSaved: Math.max(snap.questCounters.recordsSaved, Number(cc.recordsSaved || 0)),
            learnedAlphabetLetters: mergeLearnedAlphabetLetters(
              snap.questCounters.learnedAlphabetLetters,
              typeof cc.learnedAlphabetLetters === 'string' ? cc.learnedAlphabetLetters : ''
            ),
          };

          setXp(mergedXp);
          setLevel(mergedLevel);
          setDisplayLevel(mergedDisplayLevel);
          setHasUnlockedAllAges(mergedUnlockedAll);
          setWordsTypedCount(mergedWords);
          setStreakDays(mergedStreak);
          setRewardSeconds(mergedReward);
          setStats(mergedStats);
          setStatsDate(todayStr);
          setClaimedQuestIds(mergedClaimed);
          setUnlockedQuestIds(mergedUnlocked);
          setQuestCounters(mergedCounters);

          isCloudHydratedRef.current = true;

          await saveUserProfile({
            uid: currentUser.uid,
            displayName: currentUser.displayName || snap.playerName || 'Юный игрок',
            photoURL: currentUser.photoURL || undefined,
            xp: mergedXp,
            level: mergedLevel,
            displayLevel: mergedDisplayLevel,
            hasUnlockedAllAges: mergedUnlockedAll,
            wordsTypedCount: mergedWords,
            rewardSeconds: mergedReward,
            stats: mergedStats,
            statsDate: todayStr,
            claimedQuestIds: mergedClaimed,
            unlockedQuestIds: mergedUnlocked,
            questCounters: mergedCounters as unknown as Record<string, number | string>,
            streakDays: mergedStreak,
            lastActiveDate: todayStr,
            updatedAt: new Date().toISOString()
          });
        } else {
          // First time this Google account logs in: upload current local progress to cloud
          isCloudHydratedRef.current = true;
          await saveUserProfile({
            uid: currentUser.uid,
            displayName: currentUser.displayName || snap.playerName || 'Юный игрок',
            photoURL: currentUser.photoURL || undefined,
            xp: snap.xp,
            level: snap.level,
            displayLevel: snap.displayLevel,
            hasUnlockedAllAges: snap.hasUnlockedAllAges,
            wordsTypedCount: snap.wordsTypedCount,
            rewardSeconds: snap.rewardSeconds,
            stats: snap.stats,
            statsDate: todayStr,
            claimedQuestIds: snap.claimedQuestIds,
            unlockedQuestIds: snap.unlockedQuestIds,
            questCounters: snap.questCounters as unknown as Record<string, number | string>,
            streakDays: snap.streakDays,
            lastActiveDate: todayStr,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('Cloud profile sync warning:', err);
        isCloudHydratedRef.current = true;
      }
    });

    return () => unsubscribe();
  }, []);

  // Evaluate all 36 quests (6 daily + 30 long-term)
  const achievements = useMemo(() => {
    return evaluateAllQuests({
      counters: questCounters,
      stats,
      xp,
      streakDays,
      hasUnlockedAllAges,
      claimedIds: claimedQuestIds,
      previouslyUnlockedIds: unlockedQuestIds
    });
  }, [questCounters, stats, xp, streakDays, hasUnlockedAllAges, claimedQuestIds, unlockedQuestIds]);

  // Detect newly unlocked quests to announce with cat voice & blinking green badge
  const knownUnlockedRef = useRef<Set<string>>(
    new Set(
      evaluateAllQuests({
        counters: initialSave.questCounters,
        stats: initialSave.stats,
        xp: initialSave.xp,
        streakDays: initialSave.streakDays,
        hasUnlockedAllAges: initialSave.hasUnlockedAllAges,
        claimedIds: initialSave.claimedQuestIds,
        previouslyUnlockedIds: initialSave.unlockedQuestIds
      })
        .filter(a => a.isUnlocked)
        .map(a => a.id)
    )
  );

  useEffect(() => {
    let foundNew = false;
    const newlyUnlockedIds: string[] = [];

    for (const ach of achievements) {
      if (ach.isUnlocked && !knownUnlockedRef.current.has(ach.id)) {
        knownUnlockedRef.current.add(ach.id);
        newlyUnlockedIds.push(ach.id);
        if (!ach.isClaimed) {
          foundNew = true;
        }
      }
    }

    if (newlyUnlockedIds.length > 0) {
      setUnlockedQuestIds(prev => Array.from(new Set([...prev, ...newlyUnlockedIds])));
    }

    if (foundNew) {
      if (soundEnabled) {
        playSuccessFanfare();
        speakRussianText("Ты выполнил квест! Забери награду!");
      }
      setQuestAnnounceMessage("Ты выполнил квест, забери награду! 🎯");
    }
  }, [achievements, soundEnabled]);

  // Auto save to localStorage (always, including Guest mode) & Firestore (when logged in and hydrated)
  useEffect(() => {
    const todayStr = getTodayLocalDateString();
    const payload: InitialLocalSave = {
      stats,
      statsDate: todayStr,
      xp,
      level,
      displayLevel,
      hasUnlockedAllAges,
      wordsTypedCount,
      streakDays,
      lastActiveDate: todayStr,
      soundEnabled,
      kbScale,
      rewardSeconds,
      claimedQuestIds,
      unlockedQuestIds,
      questCounters,
      localRecords,
      playerName
    };
    localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(payload));

    if (user && isCloudHydratedRef.current) {
      saveUserProfile({
        uid: user.uid,
        displayName: user.displayName || playerName || 'Юный игрок',
        photoURL: user.photoURL || undefined,
        xp,
        level,
        displayLevel,
        hasUnlockedAllAges,
        wordsTypedCount,
        rewardSeconds,
        stats,
        statsDate: todayStr,
        claimedQuestIds,
        unlockedQuestIds,
        questCounters: questCounters as unknown as Record<string, number | string>,
        streakDays,
        lastActiveDate: todayStr,
        updatedAt: new Date().toISOString()
      });
    }
  }, [
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
    claimedQuestIds,
    unlockedQuestIds,
    questCounters,
    localRecords,
    playerName,
    user
  ]);

  // Save on tab hide / exit and reset scales if calendar day changes
  useEffect(() => {
    const handleVisibilityOrUnload = () => {
      const todayStr = getTodayLocalDateString();
      const snap = stateSnapshotRef.current;

      // If the user reopens an already-open tab on a new calendar day, reset all scales to 0%
      if (document.visibilityState === 'visible' && snap.statsDate !== todayStr) {
        setStats({ ...EMPTY_PET_STATS });
        setStatsDate(todayStr);
        return;
      }

      if (user && isCloudHydratedRef.current) {
        saveUserProfile({
          uid: user.uid,
          displayName: user.displayName || snap.playerName || 'Юный игрок',
          photoURL: user.photoURL || undefined,
          xp: snap.xp,
          level: snap.level,
          displayLevel: snap.displayLevel,
          hasUnlockedAllAges: snap.hasUnlockedAllAges,
          wordsTypedCount: snap.wordsTypedCount,
          rewardSeconds: snap.rewardSeconds,
          stats: snap.stats,
          statsDate: todayStr,
          claimedQuestIds: snap.claimedQuestIds,
          unlockedQuestIds: snap.unlockedQuestIds,
          questCounters: snap.questCounters as unknown as Record<string, number | string>,
          streakDays: snap.streakDays,
          lastActiveDate: todayStr,
          updatedAt: new Date().toISOString()
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('beforeunload', handleVisibilityOrUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('beforeunload', handleVisibilityOrUnload);
    };
  }, [user]);

  // Legacy unlockAchievement callback compatibility
  const unlockAchievement = useCallback((id: string) => {
    setUnlockedQuestIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const handleAddXp = useCallback((amount: number) => {
    typedInCurrentSessionRef.current = true;
    setXp(prev => prev + amount);
  }, []);

  // Claim quest reward by ID
  const handleClaimQuest = useCallback((id: string) => {
    const target = achievements.find(a => a.id === id);
    if (!target || target.isClaimed) return;
    handleAddXp(target.xpReward);
    setClaimedQuestIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    if (soundEnabled) playSuccessFanfare();
    launchBigCelebration();
  }, [achievements, handleAddXp, soundEnabled]);

  // Level calculations including the 7th stage ('cosmic' at 12,000 XP)
  useEffect(() => {
    const nextLevel = getCatLevelFromXp(xp);

    if (nextLevel === 'cosmic') {
      setHasUnlockedAllAges(true);
    } else if (hasUnlockedAllAges && xp < 12000) {
      setHasUnlockedAllAges(false);
    }

    // Ensure displayLevel never stays on 'cosmic' if xp < 12000
    const validDisplay = clampDisplayLevelToUnlocked(displayLevel, xp, nextLevel);
    if (validDisplay !== displayLevel) {
      setDisplayLevel(validDisplay);
    }

    if (nextLevel !== level) {
      setLevel(nextLevel);
      setDisplayLevel(nextLevel);
      setShowLevelUpNotice(true);
      if (soundEnabled) playSuccessFanfare();
      launchBigCelebration();
      setTimeout(() => setShowLevelUpNotice(false), 3500);
    }
  }, [xp, level, displayLevel, soundEnabled, hasUnlockedAllAges]);

  // Reset progress (cat growth)
  const handleResetProgress = () => {
    setXp(0);
    setLevel('baby');
    setDisplayLevel('baby');
    setHasUnlockedAllAges(false);
    setStats({ ...EMPTY_PET_STATS });
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

  // Save record callback (saves both locally AND to global Top-50 Firestore leaderboard for all players!)
  const handleSaveScoreRecord = async (record: ScoreRecord) => {
    setLocalRecords(prev => [record, ...prev].slice(0, 50));

    setQuestCounters(prev => ({
      ...prev,
      maxWpm: Math.max(prev.maxWpm, record.wpm),
      highAccuracyTexts: record.accuracy > 92 ? prev.highAccuracyTexts + 1 : prev.highAccuracyTexts,
      recordsSaved: prev.recordsSaved + 1
    }));

    try {
      await saveScoreRecord(record);
    } catch (err) {
      console.warn("Cloud record save error:", err);
    }
  };

  // Stat decay while actively playing: every minute all indicators decrease by 2% of maximum (2.0 points per 60 seconds)
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
  const handleWordCompletedInAnyMode = useCallback((
    wordsCount: number = 1,
    charLength?: number,
    meta?: { category?: string; activityType?: string }
  ) => {
    typedInCurrentSessionRef.current = true;
    const todayStr = getTodayLocalDateString();
    setWordsTypedCount(c => c + wordsCount);
    setStatsDate(todayStr);

    setQuestCounters(prev => {
      const sameDay = prev.dailyDate === todayStr;
      const cat = meta?.category || '';
      const act = meta?.activityType || 'standard';

      const isFeed = cat === 'HUNGER';
      const isClean = cat === 'CLEAN';
      const isSleep = cat === 'SLEEP';
      const isPlay = cat === 'HAPPINESS' || cat === 'LOVE' || cat === 'COMMANDS';
      const isCare = isFeed || isClean || isSleep || isPlay;
      const isRiddle = act === 'riddle' || cat === 'RIDDLE';
      const isMath = act === 'math' || cat === 'MATH';
      const isSport = act === 'sport' || cat === 'SPORT';
      const isBrainOrSport = isRiddle || isMath || isSport;

      return {
        ...prev,
        dailyDate: todayStr,
        dailyWords: (sameDay ? prev.dailyWords : 0) + wordsCount,
        dailyFeedings: (sameDay ? prev.dailyFeedings : 0) + (isFeed ? 1 : 0),
        dailyCareActions: (sameDay ? prev.dailyCareActions : 0) + (isCare ? 1 : 0),
        dailyRiddlesMathSport: (sameDay ? prev.dailyRiddlesMathSport : 0) + (isBrainOrSport ? 1 : 0),
        dailyMarathons: sameDay ? prev.dailyMarathons : 0,
        dailySpeedTexts: sameDay ? prev.dailySpeedTexts : 0,
        dailySprintLetters: sameDay ? prev.dailySprintLetters : 0,
        dailyChatMessages: sameDay ? prev.dailyChatMessages : 0,
        totalWords: prev.totalWords + wordsCount,
        totalRiddles: prev.totalRiddles + (isRiddle ? 1 : 0),
        totalMath: prev.totalMath + (isMath ? 1 : 0),
        totalSport: prev.totalSport + (isSport ? 1 : 0),
        totalFeedings: prev.totalFeedings + (isFeed ? 1 : 0),
        totalWashings: prev.totalWashings + (isClean ? 1 : 0),
        totalSleeps: prev.totalSleeps + (isSleep ? 1 : 0),
        totalPlays: prev.totalPlays + (isPlay ? 1 : 0),
      };
    });

    const secPerWord = (charLength && charLength >= 6) ? 15 : 12;
    const earnedSeconds = secPerWord * wordsCount;

    if (isRewardMode) {
      setSessionWordCount(c => c + wordsCount);
      setRewardSeconds(s => s + earnedSeconds);
    }

    // Also update Co-op session counters & publish to partner if in an active room
    setCoopSessionWords(prevWords => {
      const nextWords = prevWords + wordsCount;
      setCoopSessionRewardSec(prevSec => {
        const nextSec = prevSec + earnedSeconds;
        if (roomManagerRef.current) {
          roomManagerRef.current.updateSelfState({
            sessionWordsTotal: nextWords,
            rewardSecondsTotal: nextSec,
          });
        }
        return nextSec;
      });
      return nextWords;
    });
  }, [isRewardMode]);

  // Clean up Co-op room on component unmount
  useEffect(() => {
    return () => {
      if (matchmakingCleanupRef.current) {
        matchmakingCleanupRef.current();
        matchmakingCleanupRef.current = null;
      }
      if (roomManagerRef.current) {
        roomManagerRef.current.publishLeaveAndDisconnect();
        roomManagerRef.current = null;
      }
    };
  }, []);

  // Keep player display name synced into active Co-op room
  useEffect(() => {
    if (roomManagerRef.current) {
      const effectiveName =
        playerName.trim() || user?.displayName || (isCoopHost ? 'Хост-Котик' : 'Друг-Котик');
      roomManagerRef.current.updateSelfState({ name: effectiveName });
    }
  }, [playerName, user, isCoopHost]);

  const handleLeaveCoopRoom = useCallback(() => {
    if (matchmakingCleanupRef.current) {
      matchmakingCleanupRef.current();
      matchmakingCleanupRef.current = null;
    }
    if (roomManagerRef.current) {
      roomManagerRef.current.publishLeaveAndDisconnect();
      roomManagerRef.current = null;
    }
    setIsMatchmaking(false);
    setCoopRoomCode(null);
    setIsCoopHost(false);
    setCoopConnectionStatus('idle');
    setCoopPlayers([]);
    setCoopSharedConfig(null);
  }, []);

  const joinOrCreateCoopRoom = useCallback((code: string, asHost: boolean) => {
    if (matchmakingCleanupRef.current) {
      matchmakingCleanupRef.current();
      matchmakingCleanupRef.current = null;
    }
    if (roomManagerRef.current) {
      roomManagerRef.current.publishLeaveAndDisconnect();
      roomManagerRef.current = null;
    }

    setIsMatchmaking(false);
    setCoopRoomCode(code);
    setIsCoopHost(asHost);
    isCoopHostRef.current = asHost;
    setCoopConnectionStatus('connecting');
    setCoopChatMessages([]);

    // Co-op works in all tabs except classic_pet; switch to speed_text if currently on classic_pet
    const activeCoopMode: CoopActiveMode =
      currentMode === 'classic_pet' ? 'speed_text' : currentMode;
    if (currentMode === 'classic_pet') {
      setCurrentMode('speed_text');
    }

    const effectiveName =
      playerName.trim() || user?.displayName || (asHost ? 'Хост-Котик' : 'Друг-Котик');

    const initialSelfState: CoopPlayerState = {
      playerId: selfPlayerId,
      name: effectiveName,
      isHost: asHost,
      color: asHost ? 'orange' : 'blue',
      mode: activeCoopMode,
      progressPercent: 0,
      wordsCompleted: 0,
      lettersMastered: 0,
      wpm: 0,
      cpm: 0,
      accuracy: 100,
      elapsedSeconds: 0,
      isFinished: false,
      sessionWordsTotal: coopSessionWords,
      rewardSecondsTotal: isRewardMode ? rewardSeconds : coopSessionRewardSec,
      updatedAt: Date.now(),
    };

    setCoopPlayers([initialSelfState]);

    const manager = new MqttCoopRoomManager(code, initialSelfState, {
      onPlayersChange: (playersList) => {
        setCoopPlayers(playersList);
      },
      onConnectionChange: (status) => {
        setCoopConnectionStatus(status);
      },
      onEvent: (ev: CoopRoomEvent) => {
        if (ev.type === 'sync_config' || ev.type === 'start_round') {
          setCoopSharedConfig(ev.config);
          coopSharedConfigRef.current = ev.config;
          if (ev.config.mode) {
            setCurrentMode(ev.config.mode);
            manager.updateSelfState({ mode: ev.config.mode });
          }
          if (ev.type === 'start_round') {
            setCoopRoundTrigger(t => t + 1);
          }
        } else if (ev.type === 'request_config') {
          if (isCoopHostRef.current && coopSharedConfigRef.current) {
            manager.publishEvent({
              type: 'sync_config',
              senderId: selfPlayerId,
              config: coopSharedConfigRef.current,
              timestamp: Date.now(),
            });
          }
        } else if (ev.type === 'chat_message') {
          setCoopChatMessages(prev => {
            if (prev.some(m => m.id === ev.messageId)) return prev;
            return [
              ...prev,
              {
                id: ev.messageId,
                senderId: ev.senderId,
                senderName: ev.senderName,
                text: ev.text,
                timestamp: ev.timestamp,
              },
            ];
          });
          if (soundEnabledRef.current) {
            playCorrectBeep();
          }
        }
      },
    });

    roomManagerRef.current = manager;
    manager.start();
  }, [
    currentMode,
    playerName,
    user,
    selfPlayerId,
    coopSessionWords,
    isRewardMode,
    rewardSeconds,
    coopSessionRewardSec,
  ]);

  const handleCreateCoopRoom = useCallback(() => {
    const newCode = generateTwoDigitRoomCode();
    joinOrCreateCoopRoom(newCode, true);
  }, [joinOrCreateCoopRoom]);

  const handleJoinCoopRoom = useCallback((code: string) => {
    joinOrCreateCoopRoom(code.trim(), false);
  }, [joinOrCreateCoopRoom]);

  const handleFindRandomCoopPlayer = useCallback(() => {
    if (isMatchmaking) return;
    setIsMatchmaking(true);
    const effectiveName = playerName.trim() || user?.displayName || 'Котик-Игрок';
    const cleanup = findOrCreateRandomRoom(selfPlayerId, effectiveName, (matchedCode, asHost) => {
      matchmakingCleanupRef.current = null;
      joinOrCreateCoopRoom(matchedCode, asHost);
    });
    matchmakingCleanupRef.current = cleanup;
  }, [isMatchmaking, playerName, user, selfPlayerId, joinOrCreateCoopRoom]);

  const handlePublishCoopConfig = useCallback(
    (partialConfig: Partial<CoopGameConfig>, startRound: boolean = false) => {
      if (!roomManagerRef.current || !isCoopHostRef.current) return;
      const baseMode: CoopActiveMode =
        partialConfig.mode ||
        coopSharedConfigRef.current?.mode ||
        (currentMode === 'classic_pet' ? 'speed_text' : currentMode);

      const nextConfig: CoopGameConfig = {
        ...(coopSharedConfigRef.current || {}),
        ...partialConfig,
        ...(startRound
          ? {}
          : { sprintStartedAt: undefined, sprintSequence: undefined }),
        configId: partialConfig.configId || `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mode: baseMode,
      };

      setCoopSharedConfig(nextConfig);
      coopSharedConfigRef.current = nextConfig;

      roomManagerRef.current.publishEvent({
        type: startRound ? 'start_round' : 'sync_config',
        senderId: selfPlayerId,
        config: nextConfig,
        timestamp: Date.now(),
      });
    },
    [currentMode, selfPlayerId]
  );

  const handleStartCoopRoundFromBar = useCallback(() => {
    if (!roomManagerRef.current || !isCoopHostRef.current) return;
    setCoopRoundTrigger(t => t + 1);
  }, []);

  const handleUpdateCoopSelfProgress = useCallback((patch: Partial<CoopPlayerState>) => {
    if (!roomManagerRef.current) return;
    roomManagerRef.current.updateSelfState(patch);
  }, []);

  const handleSendCoopChatMessage = useCallback(
    (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      const effectiveName =
        playerName.trim() || user?.displayName || (isCoopHost ? 'Хост-Котик' : 'Друг-Котик');
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = Date.now();

      setCoopChatMessages(prev => [
        ...prev,
        {
          id: messageId,
          senderId: selfPlayerId,
          senderName: effectiveName,
          text: cleaned,
          timestamp,
        },
      ]);

      if (roomManagerRef.current) {
        roomManagerRef.current.publishEvent({
          type: 'chat_message',
          senderId: selfPlayerId,
          senderName: effectiveName,
          messageId,
          text: cleaned,
          timestamp,
        });
      }
    },
    [playerName, user, isCoopHost, selfPlayerId]
  );

  const handleSelectMode = useCallback(
    (nextMode: AppMode) => {
      setCurrentMode(nextMode);
      if (roomManagerRef.current && nextMode !== 'classic_pet') {
        roomManagerRef.current.updateSelfState({
          mode: nextMode,
          progressPercent: 0,
          isFinished: false,
        });
        if (isCoopHostRef.current) {
          handlePublishCoopConfig({ mode: nextMode }, false);
        }
      }
    },
    [handlePublishCoopConfig]
  );

  const coopPartner = useMemo(
    () => coopPlayers.find(p => p.playerId !== selfPlayerId) || null,
    [coopPlayers, selfPlayerId]
  );
  const isCoopRoomActive = Boolean(coopRoomCode);

  const handleSpeedTextCompleted = useCallback((wpm: number, accuracy: number) => {
    const todayStr = getTodayLocalDateString();
    setQuestCounters(prev => ({
      ...prev,
      dailyDate: todayStr,
      dailySpeedTexts: (prev.dailyDate === todayStr ? prev.dailySpeedTexts : 0) + 1,
      totalSpeedTexts: prev.totalSpeedTexts + 1,
      maxWpm: Math.max(prev.maxWpm, wpm),
      highAccuracyTexts: accuracy > 92 ? prev.highAccuracyTexts + 1 : prev.highAccuracyTexts
    }));
  }, []);

  const handleMarathonCompleted = useCallback((wpm: number, accuracy: number) => {
    const todayStr = getTodayLocalDateString();
    setQuestCounters(prev => ({
      ...prev,
      dailyDate: todayStr,
      dailyMarathons: (prev.dailyDate === todayStr ? prev.dailyMarathons : 0) + 1,
      totalMarathons: prev.totalMarathons + 1,
      maxWpm: Math.max(prev.maxWpm, wpm),
      highAccuracyTexts: accuracy > 92 ? prev.highAccuracyTexts + 1 : prev.highAccuracyTexts
    }));
  }, []);

  const handleLetterMastered = useCallback((letter?: string) => {
    const todayStr = getTodayLocalDateString();
    setQuestCounters(prev => ({
      ...prev,
      dailyDate: todayStr,
      dailySprintLetters: (prev.dailyDate === todayStr ? prev.dailySprintLetters : 0) + 1,
      totalSprintLetters: prev.totalSprintLetters + 1,
      learnedAlphabetLetters: letter
        ? addLearnedAlphabetLetter(prev.learnedAlphabetLetters, letter)
        : prev.learnedAlphabetLetters
    }));
  }, []);

  const handleChatSent = useCallback(() => {
    const todayStr = getTodayLocalDateString();
    setQuestCounters(prev => ({
      ...prev,
      dailyDate: todayStr,
      dailyChatMessages: (prev.dailyDate === todayStr ? prev.dailyChatMessages : 0) + 1,
      totalChats: prev.totalChats + 1
    }));
  }, []);

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
    <div translate="no" className="notranslate min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50/40 to-amber-50/50 text-slate-800 flex flex-col items-center p-2 sm:p-4 font-sans select-none overflow-x-hidden">
      
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
            <p className="text-sm text-slate-300 mb-6">
              Ты заработал экранное время отличной печатью! Включи таймер на время мультиков или отдыха.
            </p>

            {/* Huge Clock */}
            <div className="text-7xl sm:text-8xl font-mono font-black mb-5 bg-slate-800/90 text-amber-300 px-8 py-5 rounded-3xl shadow-2xl border-4 border-amber-400/80 tracking-wider">
              {formatTimerClock(rewardSeconds)}
            </div>

            {isCoopRoomActive && coopPartner && (
              <div className="mb-5 bg-indigo-900/60 border border-indigo-400/40 rounded-2xl px-4 py-2.5 text-xs font-bold text-indigo-100 flex items-center justify-center gap-3 flex-wrap">
                <span>🐾 Друг <b>{coopPartner.name}</b>:</span>
                <span>Слов за сессию: <b className="text-amber-300">{coopPartner.sessionWordsTotal}</b></span>
                <span>•</span>
                <span>Заработал отдыха: <b className="text-emerald-300 font-mono">+{formatTimerClock(coopPartner.rewardSecondsTotal)}</b></span>
              </div>
            )}

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
        {/* Header Bar with Quests, Wardrobe, and Co-op triggers */}
        <HeaderBar
          currentMode={currentMode}
          onSelectMode={handleSelectMode}
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
          isCoopOpen={isCoopOpen}
          coopRoomCode={coopRoomCode}
          coopPlayersCount={Math.max(1, coopPlayers.length)}
          onToggleCoop={() => {
            if (isCoopOpen && !coopRoomCode) {
              setIsCoopOpen(false);
            } else {
              setIsCoopOpen(true);
            }
          }}
        />

        {/* Lazy Co-op Multiplayer Bar (MQTT over WebSockets - connects only when user creates/joins a room) */}
        <CoopBar
          isOpen={isCoopOpen}
          onCloseCoop={() => {
            handleLeaveCoopRoom();
            setIsCoopOpen(false);
          }}
          roomCode={coopRoomCode}
          isHost={isCoopHost}
          connectionStatus={coopConnectionStatus}
          isMatchmaking={isMatchmaking}
          players={coopPlayers}
          selfId={selfPlayerId}
          playerName={playerName}
          onChangePlayerName={setPlayerName}
          onCreateRoom={handleCreateCoopRoom}
          onJoinRoom={handleJoinCoopRoom}
          onFindRandomPlayer={handleFindRandomCoopPlayer}
          onLeaveRoom={handleLeaveCoopRoom}
          onStartCoopRound={handleStartCoopRoundFromBar}
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
              {isCoopRoomActive && coopPartner && (
                <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-xl border border-indigo-400 flex items-center gap-1.5 shadow-2xs">
                  <span>🐾 Друг ({coopPartner.name}): Слов <b>{coopPartner.sessionWordsTotal}</b></span>
                  <span>|</span>
                  <span className="font-mono text-amber-200">+{formatTimerClock(coopPartner.rewardSecondsTotal)}</span>
                </span>
              )}
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
              onUpdateStats={(updater) => {
                typedInCurrentSessionRef.current = true;
                setStatsDate(getTodayLocalDateString());
                setStats(updater);
              }}
              xp={xp}
              level={level}
              displayLevel={displayLevel}
              onAddXp={handleAddXp}
              wordsTypedCount={wordsTypedCount}
              onIncrementWordsCount={() => {}}
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
              playerName={playerName}
              onChangePlayerName={setPlayerName}
              soundEnabled={soundEnabled}
              onSaveRecord={handleSaveScoreRecord}
              onAddXp={handleAddXp}
              kbScale={kbScale}
              onSetKbScale={setKbScale}
              isMobileMode={isMobileMode}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              isRewardMode={isRewardMode}
              onWordCompleted={handleWordCompletedInAnyMode}
              onSpeedTextCompleted={handleSpeedTextCompleted}
              isCoopRoomActive={isCoopRoomActive}
              isCoopHost={isCoopHost}
              coopPartner={coopPartner}
              coopSharedConfig={coopSharedConfig}
              coopRoundTrigger={coopRoundTrigger}
              onPublishCoopConfig={handlePublishCoopConfig}
              onUpdateCoopSelfProgress={handleUpdateCoopSelfProgress}
            />
          )}

          {currentMode === 'word_goal' && (
            <WordGoalMode
              user={user}
              playerName={playerName}
              onChangePlayerName={setPlayerName}
              soundEnabled={soundEnabled}
              onSaveRecord={handleSaveScoreRecord}
              onAddXp={handleAddXp}
              kbScale={kbScale}
              onSetKbScale={setKbScale}
              isMobileMode={isMobileMode}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              isRewardMode={isRewardMode}
              onWordCompleted={handleWordCompletedInAnyMode}
              onMarathonCompleted={handleMarathonCompleted}
              isCoopRoomActive={isCoopRoomActive}
              isCoopHost={isCoopHost}
              coopPartner={coopPartner}
              coopSharedConfig={coopSharedConfig}
              coopRoundTrigger={coopRoundTrigger}
              onPublishCoopConfig={handlePublishCoopConfig}
              onUpdateCoopSelfProgress={handleUpdateCoopSelfProgress}
            />
          )}

          {currentMode === 'letter_sprint' && (
            <LetterSprintMode
              user={user}
              playerName={playerName}
              onChangePlayerName={setPlayerName}
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
              onLetterMastered={handleLetterMastered}
              learnedAlphabetLetters={parseLearnedAlphabetLetters(questCounters.learnedAlphabetLetters)}
              isCoopRoomActive={isCoopRoomActive}
              isCoopHost={isCoopHost}
              coopPartner={coopPartner}
              coopSharedConfig={coopSharedConfig}
              coopRoundTrigger={coopRoundTrigger}
              onPublishCoopConfig={handlePublishCoopConfig}
              onUpdateCoopSelfProgress={handleUpdateCoopSelfProgress}
            />
          )}

          {currentMode === 'cat_chat' && (
            <CatChatMode
              catLevel={displayLevel}
              soundEnabled={soundEnabled}
              onAddXp={handleAddXp}
              kbScale={kbScale}
              onSetKbScale={setKbScale}
              isMobileMode={isMobileMode}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              isRewardMode={isRewardMode}
              onWordCompleted={handleWordCompletedInAnyMode}
              onChatSent={handleChatSent}
              isCoopRoomActive={isCoopRoomActive}
              coopRoomCode={coopRoomCode}
              coopPartner={coopPartner}
              coopChatMessages={coopChatMessages}
              onSendCoopChatMessage={handleSendCoopChatMessage}
              onClearCoopChatMessages={() => setCoopChatMessages([])}
              selfPlayerId={selfPlayerId}
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

      {/* Dedicated Quests Modal (6 Daily 5-min Quests + 30 Long-term Quests) */}
      <DailyQuestsModal
        isOpen={showQuestsModal}
        onClose={() => setShowQuestsModal(false)}
        achievements={achievements}
        onClaimQuest={handleClaimQuest}
        streakDays={streakDays}
        wordsTypedCount={wordsTypedCount}
      />

      {/* Leaderboard Modal (1. Personal Self-Competition  2. Global Top-50) */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        localRecords={localRecords}
        currentUserId={user?.uid}
        playerName={playerName}
        onChangePlayerName={setPlayerName}
        streakDays={streakDays}
        wordsTypedCount={wordsTypedCount}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}
