import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Trash2,
  Volume2,
  Smile,
  Users,
  UserPlus,
  LogIn,
  MessageCircle
} from 'lucide-react';
import { CatLevel } from '../types';
import { CatAvatar } from './CatAvatar';
import { VirtualKeyboard } from './VirtualKeyboard';
import {
  playCorrectBeep,
  speakRussianText
} from '../utils/soundAndEffects';
import {
  GlobalLobbyPlayer,
  GlobalLobbyChatMessage,
  isValidRoomCode
} from '../utils/mqttCoopRoom';

interface GlobalCoopChatModeProps {
  catLevel: CatLevel;
  soundEnabled: boolean;
  onAddXp: (amount: number) => void;
  kbScale: number;
  onSetKbScale: (s: number) => void;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
  onWordCompleted?: (wordsCount?: number, charLength?: number) => void;
  onChatSent?: () => void;
  selfPlayerId: string;
  coopRoomCode: string | null;
  globalOnlinePlayers: GlobalLobbyPlayer[];
  globalChatMessages: GlobalLobbyChatMessage[];
  globalLobbyStatus: 'idle' | 'connecting' | 'connected' | 'disconnected';
  onSendGlobalChatMessage: (text: string, inviteRoomCode?: string | null) => void;
  onClearGlobalChatMessages: () => void;
  onCreateRoom: () => string;
  onJoinRoom: (code: string) => void;
}

const QUICK_GLOBAL_CHAT_SUGGESTIONS = [
  '👋 Привет! Кто пойдёт со мной в комнату?',
  '⚡ Го соревноваться в скорость текста!',
  '🎯 Кто со мной в марафон слов?',
  '🔤 Давай вместе проходить буквенный спринт!',
  '😺 Привет всем! Давай дружить и играть вместе!'
];

export const GlobalCoopChatMode: React.FC<GlobalCoopChatModeProps> = ({
  catLevel,
  soundEnabled,
  onAddXp,
  kbScale,
  onSetKbScale,
  isMobileMode,
  onToggleMobileMode,
  onWordCompleted,
  onChatSent,
  selfPlayerId,
  coopRoomCode,
  globalOnlinePlayers,
  globalChatMessages,
  globalLobbyStatus,
  onSendGlobalChatMessage,
  onClearGlobalChatMessages,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [catAction, setCatAction] = useState<any>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onlineLobbyCount = Math.max(1, globalOnlinePlayers.length);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalChatMessages.length]);

  const handleSendMessage = useCallback(
    (customText?: string) => {
      const textToSend = (customText !== undefined ? customText : inputValue).trim();
      if (!textToSend) return;

      setInputValue('');
      if (soundEnabled) playCorrectBeep();

      const xpReward = Math.min(25, Math.max(5, Math.round(textToSend.length * 0.8)));
      onAddXp(xpReward);

      const wordsCount = textToSend.split(/\s+/).filter(Boolean).length;
      if (wordsCount > 0) {
        const avgLen = Math.round(textToSend.length / wordsCount);
        onWordCompleted?.(wordsCount, avgLen);
      }
      onChatSent?.();

      onSendGlobalChatMessage(textToSend, coopRoomCode);
      setCatAction('love');
      setTimeout(() => setCatAction('idle'), 1200);
    },
    [
      inputValue,
      soundEnabled,
      onAddXp,
      onWordCompleted,
      onChatSent,
      onSendGlobalChatMessage,
      coopRoomCode,
    ]
  );

  const handleCreateAndInviteToChat = useCallback(() => {
    const activeCode = coopRoomCode || onCreateRoom();
    onSendGlobalChatMessage(
      `Привет! Я создал комнату ${activeCode}. Заходи ко мне играть вместе!`,
      activeCode
    );
    setCatAction('jump');
    setTimeout(() => setCatAction('idle'), 1200);
  }, [coopRoomCode, onCreateRoom, onSendGlobalChatMessage]);

  const handleSpeakLastMessage = useCallback(() => {
    const lastMsg = globalChatMessages[globalChatMessages.length - 1];
    if (lastMsg?.text) {
      speakRussianText(lastMsg.text);
      return;
    }
    if (inputValue.trim()) {
      speakRussianText(inputValue.trim());
    }
  }, [globalChatMessages, inputValue]);

  // Global hotkey Alt + 1 in GlobalCoopChatMode: speak the last message (mine or other player's)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === '1' || e.code === 'Digit1')) {
        e.preventDefault();
        handleSpeakLastMessage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSpeakLastMessage]);

  const handleVirtualKey = (char: string) => {
    if (char === ' ') {
      setInputValue((prev) => prev + ' ');
    } else {
      setInputValue((prev) => prev + char);
    }
  };

  return (
    <div translate="no" className="notranslate w-full max-w-4xl flex flex-col items-center gap-3">
      {/* Top Banner with Cat Helper, Online Players Strip & Action Buttons */}
      <div className="w-full bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
              <CatAvatar action={catAction} stage={catLevel} scaleOverride={0.4} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2 flex-wrap">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Общий чат кооператива</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      globalLobbyStatus === 'connected'
                        ? 'bg-emerald-500'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span>Онлайн в кооперативе: {onlineLobbyCount}</span>
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Сюда попадают все, кто открыл «Кооператив». Найди друга по переписке, послушай сообщения и переходите в одну комнату!
              </p>
            </div>
          </div>

          {/* Invite to Room, Speak Last Message (Alt + 1) & Clear History Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-testid="global-chat-invite-room-btn"
              onClick={handleCreateAndInviteToChat}
              className="px-3 py-2 text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition border border-amber-500/40 flex items-center gap-1.5 text-xs font-black shadow-2xs cursor-pointer"
              title={
                coopRoomCode
                  ? `Отправить приглашение в твою комнату ${coopRoomCode} в общий чат`
                  : 'Создать комнату и сразу отправить приглашение всем в общий чат'
              }
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {coopRoomCode
                  ? `Позвать всех в комнату ${coopRoomCode}`
                  : 'Создать комнату и позвать в чат'}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                handleSpeakLastMessage();
              }}
              className="px-3 py-2 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition border border-purple-200 flex items-center gap-1.5 text-xs font-bold shadow-2xs cursor-pointer"
              title="Озвучить последнее сообщение в общем чате (Alt + 1)"
            >
              <Volume2 className="w-4 h-4 text-purple-600" />
              <span>Озвучить (Alt + 1)</span>
            </button>

            <button
              type="button"
              onClick={onClearGlobalChatMessages}
              className="p-2.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition border border-transparent hover:border-rose-200 flex items-center gap-1 cursor-pointer"
              title="Очистить переписку"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs font-bold hidden sm:inline">Очистить</span>
            </button>
          </div>
        </div>

        {/* Active Players Online in Co-op Strip */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs pt-2 border-t border-slate-100">
          <span className="text-slate-500 font-bold">Игроки тут:</span>
          {globalOnlinePlayers.map((p) => {
            const isMe = p.playerId === selfPlayerId;
            return (
              <div
                key={p.playerId}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold border ${
                  isMe
                    ? 'bg-purple-50 border-purple-200 text-purple-800'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <span>
                  {isMe ? '🐱 Ты' : '🐾'} {p.name}
                </span>
                {p.roomCode && (
                  <span className="font-mono text-[11px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-md border border-indigo-200">
                    комн. {p.roomCode}
                  </span>
                )}
                {!isMe && p.roomCode && p.roomCode !== coopRoomCode && (
                  <button
                    type="button"
                    onClick={() => onJoinRoom(p.roomCode!)}
                    className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] rounded-md transition cursor-pointer shadow-2xs"
                    title={`Войти в комнату ${p.roomCode} к игроку ${p.name}`}
                  >
                    Войти
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Messages Feed (Same clean format as CatChatMode!) */}
      <div className="w-full bg-white rounded-3xl p-4 sm:p-6 shadow-md border-2 border-slate-200 min-h-[380px] max-h-[520px] overflow-y-auto flex flex-col gap-3.5 select-text">
        {globalChatMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 gap-2">
            <MessageCircle className="w-10 h-10 text-emerald-400" />
            <p className="font-bold text-slate-600 text-sm">
              В общем чате кооператива пока тихо! Напиши «Привет!» всем игрокам.
            </p>
            <p className="text-xs text-slate-400 max-w-md">
              Здесь видны сообщения всех, кто открыл «Кооператив». Можно озвучить любое сообщение кнопкой 🔊, найти друга и одним нажатием перейти с ним в комнату.
            </p>
          </div>
        ) : (
          globalChatMessages.map((msg) => {
            const isSelf = msg.senderId === selfPlayerId;
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                {!isSelf && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 shadow-sm">
                    🐾
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 sm:p-4 rounded-3xl text-sm sm:text-base leading-relaxed shadow-sm ${
                    isSelf
                      ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-tr-none font-medium'
                      : 'bg-sky-50 text-slate-800 border border-sky-200 rounded-tl-none font-medium'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase opacity-75 mb-0.5 flex items-center gap-2">
                    <span>{isSelf ? `Ты (${msg.senderName})` : msg.senderName}</span>
                    {msg.roomCode && isValidRoomCode(msg.roomCode) && (
                      <span
                        className={`font-mono px-1.5 py-0.2 rounded text-[10px] ${
                          isSelf
                            ? 'bg-white/20 text-amber-200'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        Комната {msg.roomCode}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <span className="break-words">{msg.text}</span>

                      {msg.roomCode &&
                        isValidRoomCode(msg.roomCode) &&
                        msg.roomCode !== coopRoomCode && (
                          <button
                            type="button"
                            onClick={() => onJoinRoom(msg.roomCode!)}
                            className="w-fit px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Войти в комнату {msg.roomCode}</span>
                          </button>
                        )}
                    </div>

                    <button
                      type="button"
                      onClick={() => speakRussianText(msg.text)}
                      className={`p-1 rounded-lg transition flex-shrink-0 cursor-pointer ${
                        isSelf
                          ? 'text-white/80 hover:text-white hover:bg-white/20'
                          : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-200/70'
                      }`}
                      title={
                        isSelf
                          ? 'Озвучить то, что ты написал'
                          : `Озвучить сообщение от ${msg.senderName}`
                      }
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isSelf && (
                  <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-300 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0 mt-0.5 shadow-sm">
                    Ты
                  </div>
                )}
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Friend-Finding Suggestions below chat (same style as CatChatMode) */}
      <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
        <span className="text-[11px] font-bold text-slate-500 uppercase flex-shrink-0 flex items-center gap-1">
          <Smile className="w-3.5 h-3.5 text-purple-500" />
          Подсказки:
        </span>
        {QUICK_GLOBAL_CHAT_SUGGESTIONS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            className="px-3 py-1.5 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 hover:border-purple-300 rounded-xl text-xs font-semibold whitespace-nowrap shadow-sm transition active:scale-95 cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="w-full flex items-center gap-2 bg-white p-2 sm:p-2.5 rounded-2xl shadow-sm border-2 border-purple-100 focus-within:border-purple-400 transition"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Напиши сообщение всем в общий чат кооператива (найти друга, позвать в комнату)..."
          aria-label="Сообщение в общий чат кооператива"
          className="flex-1 px-4 py-2 text-sm sm:text-base border-0 focus:outline-none bg-transparent font-medium text-slate-800 placeholder-slate-400"
        />

        {inputValue.trim().length > 0 && (
          <button
            type="button"
            onClick={() => speakRussianText(inputValue.trim())}
            className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-xl transition flex items-center gap-1 border border-purple-200 cursor-pointer"
            title="Озвучить набранный свой текст"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}

        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-purple-200 transition active:scale-95 cursor-pointer"
          title="Отправить (Enter)"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Отправить</span>
        </button>
      </form>

      {/* Virtual Keyboard */}
      <VirtualKeyboard
        currentExpectedChar={undefined}
        hintKey={null}
        onKeyPress={handleVirtualKey}
        isMobileMode={isMobileMode}
        onToggleMobileMode={onToggleMobileMode}
        kbScale={kbScale}
        onSetKbScale={onSetKbScale}
      />
    </div>
  );
};
