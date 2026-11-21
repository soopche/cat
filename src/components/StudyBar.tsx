import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Mic,
  MicOff,
  Bell,
  Send,
  Volume2,
  Wifi,
  LogIn,
  LogOut,
  CheckCircle2,
  Zap,
  Eye,
  Award,
  MessageCircle,
  Play,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  BookOpen
} from 'lucide-react';
import {
  CoopPlayerState,
  CoopActiveMode,
  RoomParticipantRole,
  TeacherNotificationTone,
  isValidRoomCode
} from '../utils/mqttCoopRoom';
import { CoopChatMessageItem } from './CatChatMode';
import { speakRussianText } from '../utils/soundAndEffects';

export interface TeacherNotificationBannerItem {
  id: string;
  senderName: string;
  text: string;
  tone: TeacherNotificationTone;
  timestamp: number;
}

interface StudyBarProps {
  isOpen: boolean;
  onCloseStudy: () => void;
  roomCode: string | null;
  studyRole: RoomParticipantRole;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected';
  players: CoopPlayerState[];
  selfId: string;
  playerName: string;
  onChangePlayerName: (name: string) => void;
  onCreateTeacherRoom: () => void;
  onJoinStudentRoom: (code: string) => void;
  onLeaveStudyRoom: () => void;
  // Live voice (Alt + 3)
  isMicTalking: boolean;
  micError: string | null;
  onToggleMic: () => void;
  // Teacher actions
  onSendTeacherNotification: (text: string, tone: TeacherNotificationTone, speakAloud: boolean) => void;
  onSwitchStudentMode: (mode: CoopActiveMode) => void;
  onStartStudentRound: () => void;
  // Chat with student / teacher
  chatMessages: CoopChatMessageItem[];
  onSendChatMessage: (text: string) => void;
  // Incoming notification banner for student
  activeNotification: TeacherNotificationBannerItem | null;
  onDismissNotification: () => void;
}

const QUICK_TEACHER_NOTIFICATIONS: {
  label: string;
  text: string;
  tone: TeacherNotificationTone;
  emoji: string;
}[] = [
  {
    emoji: '⚡',
    label: 'Давай быстрей!',
    text: 'Давай быстрей! Не отвлекайся, у тебя отлично получается!',
    tone: 'hurry',
  },
  {
    emoji: '👀',
    label: 'Внимательнее к буквам!',
    text: 'Смотри внимательно на экран и проверяй каждую букву!',
    tone: 'attention',
  },
  {
    emoji: '🌟',
    label: 'Молодец! Так держать!',
    text: 'Молодец! Ты очень стараешься, так держать!',
    tone: 'praise',
  },
  {
    emoji: '👐',
    label: 'Следи за пальчиками!',
    text: 'Поставь пальчики ровно на клавиатуру и не спеши!',
    tone: 'attention',
  },
  {
    emoji: '🎯',
    label: 'Ещё 5 слов!',
    text: 'Давай напечатаем ещё пять слов до отличного результата!',
    tone: 'task',
  },
];

function getModeTitle(mode?: string): string {
  switch (mode) {
    case 'classic_pet':
      return '🐱 Питомец-Котик';
    case 'speed_text':
      return '⚡ Скорость текста';
    case 'word_goal':
      return '🎯 Марафон слов';
    case 'letter_sprint':
      return '🔤 Буквенный спринт';
    case 'cat_chat':
      return '💬 Диалог';
    default:
      return '🐱 Тренажёр';
  }
}

export const StudyBar: React.FC<StudyBarProps> = ({
  isOpen,
  onCloseStudy,
  roomCode,
  studyRole,
  connectionStatus,
  players,
  selfId,
  playerName,
  onChangePlayerName,
  onCreateTeacherRoom,
  onJoinStudentRoom,
  onLeaveStudyRoom,
  isMicTalking,
  micError,
  onToggleMic,
  onSendTeacherNotification,
  onSwitchStudentMode,
  onStartStudentRound,
  chatMessages,
  onSendChatMessage,
  activeNotification,
  onDismissNotification,
}) => {
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [customNotifyText, setCustomNotifyText] = useState<string>('');
  const [speakNotifyAloud, setSpeakNotifyAloud] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>('');
  const [isDashboardExpanded, setIsDashboardExpanded] = useState<boolean>(true);
  const [isStudentChatOpen, setIsStudentChatOpen] = useState<boolean>(false);
  const [sentNoticeFeedback, setSentNoticeFeedback] = useState<string | null>(null);

  const prevChatLenRef = useRef<number>(chatMessages.length);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Automatically open student chat drawer when a new message arrives from teacher
  useEffect(() => {
    if (chatMessages.length > prevChatLenRef.current) {
      const latest = chatMessages[chatMessages.length - 1];
      if (latest && latest.senderId !== selfId && studyRole === 'student') {
        setIsStudentChatOpen(true);
      }
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
    prevChatLenRef.current = chatMessages.length;
  }, [chatMessages, selfId, studyRole]);

  const partner = players.find((p) => p.playerId !== selfId) || null;
  const isTeacher = studyRole === 'teacher';
  const isStudent = studyRole === 'student';

  const formatClock = (seconds: number = 0) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCodeInput.trim();
    if (isValidRoomCode(cleaned)) {
      onJoinStudentRoom(cleaned);
    }
  };

  const handleTriggerNotification = (text: string, tone: TeacherNotificationTone) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    onSendTeacherNotification(cleaned, tone, speakNotifyAloud);
    setSentNoticeFeedback(`Отправлено: «${cleaned}»`);
    setTimeout(() => setSentNoticeFeedback(null), 2500);
  };

  const handleSendChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = chatInput.trim();
    if (!cleaned) return;
    onSendChatMessage(cleaned);
    setChatInput('');
  };

  if (!isOpen && !roomCode && !activeNotification) return null;

  return (
    <>
      {/* Prominent Floating Teacher Notification Popup for Student */}
      {activeNotification && (
        <div
          data-testid="teacher-notification-banner"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-xl animate-bounce"
        >
          <div
            className={`rounded-3xl p-4 sm:p-5 shadow-2xl border-2 text-white flex items-center justify-between gap-4 ${
              activeNotification.tone === 'hurry'
                ? 'bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 border-amber-200'
                : activeNotification.tone === 'praise'
                ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-700 border-emerald-200'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                {activeNotification.tone === 'hurry'
                  ? '⚡'
                  : activeNotification.tone === 'praise'
                  ? '🌟'
                  : '👩‍🏫'}
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-amber-200">
                  Уведомление от учителя ({activeNotification.senderName}):
                </div>
                <div className="text-base sm:text-xl font-black leading-snug">
                  {activeNotification.text}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => speakRussianText(activeNotification.text)}
                className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
                title="Озвучить уведомление учителя"
              >
                <Volume2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onDismissNotification}
                className="px-3.5 py-2 rounded-xl bg-white text-slate-900 font-black text-xs hover:bg-amber-50 transition shadow cursor-pointer"
              >
                Понятно!
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          translate="no"
          className="notranslate w-full max-w-7xl bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 text-white rounded-2xl shadow-md border border-emerald-400/50 px-3.5 py-3 mb-2 flex flex-col gap-3 animate-fade-in"
        >
          {!roomCode ? (
            /* Study Mode Lobby: Create Room as Teacher OR Join by 2-digit code as Student */
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 font-black text-xs sm:text-sm bg-white/15 px-3 py-1.5 rounded-xl">
                  <GraduationCap className="w-4 h-4 text-amber-300" />
                  <span>Режим «Учёба» (Учитель и Ученик)</span>
                </span>

                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => onChangePlayerName(e.target.value)}
                  placeholder="Твоё имя..."
                  maxLength={20}
                  aria-label="Имя учителя или ученика"
                  className="px-3 py-1.5 rounded-xl bg-white/95 text-slate-800 text-xs font-bold w-36 sm:w-40 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />

                <button
                  type="button"
                  onClick={onCreateTeacherRoom}
                  className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Создать комнату как Учитель</span>
                </button>

                <form onSubmit={handleJoinSubmit} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="Код (10-99)"
                    aria-label="Код урока из 2 цифр"
                    className="w-24 px-2.5 py-1.5 rounded-xl bg-white/95 text-slate-900 font-mono font-black text-xs text-center placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    type="submit"
                    disabled={!isValidRoomCode(joinCodeInput)}
                    className="px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Войти как Ученик</span>
                  </button>
                </form>
              </div>

              <button
                type="button"
                onClick={onCloseStudy}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white/90 hover:text-white transition flex items-center gap-1 text-xs font-bold cursor-pointer"
                title="Закрыть панель учёбы"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Закрыть</span>
              </button>
            </div>
          ) : (
            /* Active Study Room (Teacher or Student view) */
            <div className="flex flex-col gap-3">
              {/* Top Status & Live Phone Microphone Row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    data-testid="study-room-status"
                    className="bg-slate-950/40 border border-white/25 px-3 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-2 shadow-inner"
                  >
                    <Wifi
                      className={`w-3.5 h-3.5 ${
                        connectionStatus === 'connected'
                          ? 'text-emerald-400'
                          : 'text-amber-300 animate-pulse'
                      }`}
                    />
                    <span>
                      Код урока: {roomCode} | {isTeacher ? '👩‍🏫 Учитель' : '🎒 Ученик'}
                    </span>
                  </div>

                  {/* Partner connection status */}
                  {partner ? (
                    <span className="text-xs font-bold bg-emerald-500/30 border border-emerald-300/50 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>
                        {isTeacher ? `Ученик на связи: ${partner.name}` : `Учитель на связи: ${partner.name}`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-xl text-amber-200">
                      ⏳ Скажи ученику код <b className="font-mono text-white">{roomCode}</b> для входа в «Учёба»
                    </span>
                  )}

                  {/* Two-Way Live Voice Button (Alt + 3) for BOTH Teacher and Student */}
                  <button
                    type="button"
                    data-testid="study-mic-toggle"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onToggleMic();
                    }}
                    className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                      isMicTalking
                        ? 'bg-rose-500 hover:bg-rose-600 text-white ring-2 ring-amber-300 animate-pulse'
                        : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    }`}
                    title="Живая голосовая связь как по телефону (горячая клавиша Alt + 3)"
                  >
                    {isMicTalking ? (
                      <>
                        <Mic className="w-4 h-4 animate-bounce" />
                        <span>Микрофон ВКЛ — Говоришь в эфир (Alt + 3)</span>
                      </>
                    ) : (
                      <>
                        <MicOff className="w-4 h-4" />
                        <span>
                          {isTeacher
                            ? '🎙️ Говорить ученику (Alt + 3)'
                            : '🎙️ Ответить учителю голосом (Alt + 3)'}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Live indicator when the OTHER participant is talking on the microphone */}
                  {partner?.isVoiceTalking && (
                    <span className="px-3 py-1.5 rounded-xl bg-rose-500/90 border border-amber-200 text-white font-black text-xs flex items-center gap-1.5 animate-pulse shadow">
                      <Volume2 className="w-4 h-4" />
                      <span>
                        {isTeacher
                          ? `🔊 Ученик (${partner.name}) говорит в микрофон...`
                          : `🔊 Учитель (${partner.name}) говорит... Слушай!`}
                      </span>
                    </span>
                  )}

                  {micError && (
                    <span className="text-xs bg-rose-900/70 border border-rose-300/50 text-rose-100 px-2.5 py-1 rounded-xl font-bold">
                      ⚠️ {micError}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isStudent && (
                    <button
                      type="button"
                      onClick={() => setIsStudentChatOpen((v) => !v)}
                      className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 text-amber-300" />
                      <span>
                        Переписка с учителем ({chatMessages.length})
                      </span>
                    </button>
                  )}

                  {isTeacher && (
                    <button
                      type="button"
                      onClick={() => setIsDashboardExpanded((v) => !v)}
                      className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      {isDashboardExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          <span>Свернуть пульт</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          <span>Развернуть пульт учителя</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onLeaveStudyRoom}
                    className="px-3 py-1.5 bg-rose-500/80 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Выйти</span>
                  </button>
                </div>
              </div>

              {/* TEACHER LIVE DASHBOARD: Live screen monitoring, Quick Notifications, Completed Work Inspection & Chat */}
              {isTeacher && isDashboardExpanded && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-1">
                  {/* Column 1: Live Student Screen & Remote Mode Control */}
                  <div className="bg-slate-950/35 border border-white/20 rounded-2xl p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <Eye className="w-4 h-4" />
                          1. Что ученик делает сейчас
                        </span>
                        <span className="text-[11px] font-bold bg-white/15 px-2.5 py-0.5 rounded-full">
                          {partner ? getModeTitle(partner.mode) : 'Ожидание ученика'}
                        </span>
                      </div>

                      {partner ? (
                        <div className="flex flex-col gap-2.5">
                          {/* Live word / text being typed by student */}
                          <div className="bg-slate-900/75 border border-white/15 rounded-xl p-3">
                            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                              Текущее слово / текст на экране у ребёнка:
                            </div>
                            {partner.currentTargetWord ? (
                              <div className="font-mono text-lg sm:text-xl font-black tracking-wider break-words leading-snug">
                                {partner.currentTargetWord.slice(0, 100).split('').map((ch, idx) => {
                                  const typedLen = (partner.currentTypedText || '').length;
                                  const isDone = idx < typedLen;
                                  const isCurrent = idx === typedLen;
                                  return (
                                    <span
                                      key={idx}
                                      className={
                                        isDone
                                          ? 'text-emerald-400'
                                          : isCurrent
                                          ? 'text-amber-300 underline decoration-2'
                                          : 'text-slate-400'
                                      }
                                    >
                                      {ch}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-300 italic">
                                Ученик выбирает задание или готовится к старту...
                              </div>
                            )}
                          </div>

                          {/* Live Metrics Grid */}
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            <div className="bg-white/10 rounded-xl p-2">
                              <div className="text-[10px] text-white/70">Скорость</div>
                              <div className="text-sm font-mono font-black text-amber-300">
                                {partner.wpm} WPM
                              </div>
                            </div>
                            <div className="bg-white/10 rounded-xl p-2">
                              <div className="text-[10px] text-white/70">Точность</div>
                              <div className="text-sm font-mono font-black text-emerald-300">
                                {partner.accuracy}%
                              </div>
                            </div>
                            <div className="bg-white/10 rounded-xl p-2">
                              <div className="text-[10px] text-white/70">Прогресс</div>
                              <div className="text-sm font-mono font-black text-sky-300">
                                {partner.progressPercent}%
                              </div>
                            </div>
                            <div className="bg-white/10 rounded-xl p-2">
                              <div className="text-[10px] text-white/70">В текущем</div>
                              <div className="text-sm font-mono font-black text-white">
                                {partner.wordsCompleted} сл.
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-100/80 bg-white/5 rounded-xl p-4 text-center">
                          Когда ребёнок введёт код <b className="text-amber-300 font-mono">{roomCode}</b> в разделе «Учёба», здесь в реальном времени появится каждое слово и буква, которую он печатает!
                        </div>
                      )}
                    </div>

                    {/* Teacher Remote Mode Switcher for Student */}
                    <div className="pt-2 border-t border-white/15">
                      <div className="text-[10px] font-bold uppercase text-emerald-200 mb-1.5">
                        Переключить режим у ученика / запустить старт:
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(
                          [
                            { id: 'classic_pet', label: '🐱 Котик' },
                            { id: 'speed_text', label: '⚡ Текст' },
                            { id: 'word_goal', label: '🎯 Марафон' },
                            { id: 'letter_sprint', label: '🔤 Буквы' },
                          ] as { id: CoopActiveMode; label: string }[]
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onSwitchStudentMode(m.id)}
                            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            {m.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={onStartStudentRound}
                          className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black transition flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Старт раунда</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Check What Student Already Completed + Send Instant Notifications */}
                  <div className="bg-slate-950/35 border border-white/20 rounded-2xl p-3.5 flex flex-col justify-between gap-3">
                    {/* Inspection of student's completed work */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                          <Award className="w-4 h-4" />
                          2. Проверка: что ученик уже сделал
                        </span>
                        {partner?.xp !== undefined && (
                          <span className="text-[11px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30 px-2 py-0.5 rounded-full">
                            Котик: {partner.xp} XP
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
                        <div className="bg-white/10 rounded-xl p-2">
                          <div className="text-[10px] text-white/70">Слов за урок</div>
                          <div className="text-sm font-mono font-black text-emerald-300">
                            {partner?.sessionWordsTotal ?? 0}
                          </div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2">
                          <div className="text-[10px] text-white/70">Слов сегодня</div>
                          <div className="text-sm font-mono font-black text-amber-300">
                            {partner?.dailyWordsTyped ?? partner?.sessionWordsTotal ?? 0}
                          </div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2">
                          <div className="text-[10px] text-white/70">Выучено букв</div>
                          <div className="text-sm font-mono font-black text-sky-300">
                            {partner?.learnedLettersCount ?? partner?.lettersMastered ?? 0} / 33
                          </div>
                        </div>
                      </div>

                      {/* Learned letters & Recent completed words */}
                      <div className="bg-slate-900/60 border border-white/10 rounded-xl p-2.5 text-xs flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                            Изученные буквы:
                          </span>
                          <span className="font-mono font-bold text-amber-200 truncate max-w-[180px]">
                            {partner?.learnedLettersList || 'пока нет'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                            Квестов выполнено / Отдых:
                          </span>
                          <span className="font-mono font-bold text-emerald-200">
                            {partner?.completedQuestsCount ?? 0} кв. • +{formatClock(partner?.rewardSecondsTotal ?? 0)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 pt-1 border-t border-white/10">
                          <span className="block text-[10px] uppercase text-slate-400 mb-1">
                            Последние напечатанные слова ученика:
                          </span>
                          {partner?.recentCompletedWords && partner.recentCompletedWords.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {partner.recentCompletedWords.slice(-8).map((w, i) => (
                                <span
                                  key={`${w}-${i}`}
                                  className="px-2 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/40 text-emerald-100 font-mono font-bold text-[11px]"
                                >
                                  ✓ {w}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              Здесь появятся слова по мере печати ребёнка
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Teacher Notifications ("Давай быстрей!", etc.) */}
                    <div className="pt-2 border-t border-white/15">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black uppercase text-amber-300 flex items-center gap-1">
                          <Bell className="w-3.5 h-3.5" />
                          Уведомление на экран ребёнку:
                        </span>
                        <label className="flex items-center gap-1 text-[10px] font-bold text-emerald-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={speakNotifyAloud}
                            onChange={(e) => setSpeakNotifyAloud(e.target.checked)}
                            className="rounded accent-amber-400"
                          />
                          <span>Озвучить голосом</span>
                        </label>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap mb-2">
                        {QUICK_TEACHER_NOTIFICATIONS.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleTriggerNotification(item.text, item.tone)}
                            className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400 hover:text-slate-950 text-amber-100 border border-amber-300/40 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                          >
                            <span>{item.emoji}</span>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (customNotifyText.trim()) {
                            handleTriggerNotification(customNotifyText, 'hurry');
                            setCustomNotifyText('');
                          }
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="text"
                          value={customNotifyText}
                          onChange={(e) => setCustomNotifyText(e.target.value)}
                          placeholder="Своё уведомление (напр. Давай быстрей!)..."
                          className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-bold placeholder:text-slate-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!customNotifyText.trim()}
                          className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Послать</span>
                        </button>
                      </form>

                      {sentNoticeFeedback && (
                        <div className="mt-1 text-[11px] font-bold text-emerald-300">
                          ✓ {sentNoticeFeedback}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 3: Teacher-Student Live Chat so Child Reads & Replies */}
                  <div className="bg-slate-950/35 border border-white/20 rounded-2xl p-3.5 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4" />
                        3. Переписка с ребёнком
                      </span>
                      <span className="text-[10px] text-slate-300">
                        Появляется прямо на экране у ученика
                      </span>
                    </div>

                    <div className="bg-slate-900/70 border border-white/10 rounded-xl p-2.5 h-40 overflow-y-auto flex flex-col gap-1.5">
                      {chatMessages.length === 0 ? (
                        <div className="text-xs text-slate-400 italic m-auto text-center">
                          Напиши сообщение ребёнку — оно сразу откроется у него на экране для чтения!
                        </div>
                      ) : (
                        chatMessages.map((msg) => {
                          const isMine = msg.senderId === selfId;
                          return (
                            <div
                              key={msg.id}
                              className={`flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs ${
                                isMine
                                  ? 'bg-emerald-600/80 text-white self-end max-w-[90%]'
                                  : 'bg-white/15 text-amber-100 self-start max-w-[90%]'
                              }`}
                            >
                              <div className="break-words">
                                <b className="text-[10px] uppercase opacity-80 block">
                                  {isMine ? 'Учитель (Ты):' : `${msg.senderName}:`}
                                </b>
                                <span>{msg.text}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => speakRussianText(msg.text)}
                                className="p-1 rounded hover:bg-white/20 text-white/90 shrink-0 cursor-pointer"
                                title="Озвучить сообщение"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendChatSubmit} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Написать сообщение для чтения ребёнку..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-bold placeholder:text-slate-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 font-black text-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Отправить</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* STUDENT CHAT DRAWER: Shows Teacher's messages right in front of the child in any mode */}
              {isStudent && (isStudentChatOpen || chatMessages.length > 0) && (
                <div className="bg-slate-950/40 border border-white/20 rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4" />
                      Сообщения от учителя (прочитай и ответь):
                    </span>
                    {chatMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          speakRussianText(chatMessages[chatMessages.length - 1].text)
                        }
                        className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Озвучить последнее</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-32 overflow-y-auto flex flex-col gap-1.5 bg-slate-900/60 rounded-xl p-2.5">
                    {chatMessages.length === 0 ? (
                      <div className="text-xs text-slate-300 italic">
                        Здесь появятся сообщения от учителя. Ты также можешь написать учителю!
                      </div>
                    ) : (
                      chatMessages.slice(-6).map((msg) => {
                        const isMine = msg.senderId === selfId;
                        return (
                          <div
                            key={msg.id}
                            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold ${
                              isMine
                                ? 'bg-indigo-600/80 text-white self-end'
                                : 'bg-amber-400 text-slate-950 self-start shadow'
                            }`}
                          >
                            <span>
                              <b>{isMine ? 'Ты: ' : `👩‍🏫 ${msg.senderName}: `}</b>
                              {msg.text}
                            </span>
                            <button
                              type="button"
                              onClick={() => speakRussianText(msg.text)}
                              className="p-1 rounded hover:bg-black/10 shrink-0 cursor-pointer"
                              title="Озвучить сообщение"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendChatSubmit} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Написать ответ учителю..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-bold placeholder:text-slate-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Ответить</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
