import React, { useState } from 'react';
import {
  Users,
  Play,
  LogIn,
  LogOut,
  Crown,
  Sparkles,
  Wifi,
  Shuffle,
  Gift,
  X
} from 'lucide-react';
import { CoopPlayerState, isValidRoomCode } from '../utils/mqttCoopRoom';

interface CoopBarProps {
  isOpen: boolean;
  onCloseCoop: () => void;
  roomCode: string | null;
  isHost: boolean;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected';
  isMatchmaking: boolean;
  players: CoopPlayerState[];
  selfId: string;
  playerName: string;
  onChangePlayerName: (name: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onFindRandomPlayer: () => void;
  onLeaveRoom: () => void;
  onStartCoopRound: () => void;
}

export const CoopBar: React.FC<CoopBarProps> = ({
  isOpen,
  onCloseCoop,
  roomCode,
  isHost,
  connectionStatus,
  isMatchmaking,
  players,
  selfId,
  playerName,
  onChangePlayerName,
  onCreateRoom,
  onJoinRoom,
  onFindRandomPlayer,
  onLeaveRoom,
  onStartCoopRound,
}) => {
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');

  if (!isOpen) return null;

  const partner = players.find(p => p.playerId !== selfId) || null;
  const playersCount = Math.max(1, players.length);

  const formatClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCodeInput.trim();
    if (isValidRoomCode(cleaned)) {
      onJoinRoom(cleaned);
    }
  };

  return (
    <div
      translate="no"
      className="notranslate w-full max-w-7xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-2xl shadow-md border border-indigo-400/50 px-3.5 py-2.5 mb-2 flex flex-col gap-2 animate-fade-in"
    >
      {!roomCode ? (
        /* Lobby Row: Create Room (2 digits), Join by 2-digit code, or Random Matchmaking */
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 font-black text-xs sm:text-sm bg-white/15 px-2.5 py-1 rounded-xl">
              <Users className="w-4 h-4 text-amber-300" />
              <span>Кооператив и соревнование</span>
            </span>

            <input
              type="text"
              value={playerName}
              onChange={(e) => onChangePlayerName(e.target.value)}
              placeholder="Твоё имя..."
              maxLength={20}
              aria-label="Твоё имя в кооперативе"
              className="px-2.5 py-1 rounded-xl bg-white/95 text-slate-800 text-xs font-bold w-32 sm:w-36 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />

            <button
              type="button"
              onClick={onCreateRoom}
              disabled={isMatchmaking}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Создать комнату</span>
            </button>

            <form onSubmit={handleJoinSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="Код (10-99)"
                aria-label="Код комнаты из 2 цифр"
                className="w-24 px-2.5 py-1 rounded-xl bg-white/95 text-slate-900 font-mono font-black text-xs text-center placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                type="submit"
                disabled={!isValidRoomCode(joinCodeInput) || isMatchmaking}
                className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Войти</span>
              </button>
            </form>

            <button
              type="button"
              onClick={onFindRandomPlayer}
              disabled={isMatchmaking}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white font-bold text-xs rounded-xl border border-white/30 transition active:scale-95 flex items-center gap-1.5"
              title="Найти случайного напарника онлайн на сайте"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-300" />
              <span>{isMatchmaking ? 'Поиск игрока...' : 'Случайный игрок'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onCloseCoop}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white/90 hover:text-white transition flex items-center gap-1 text-xs font-bold"
            title="Выключить кооператив"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Закрыть</span>
          </button>
        </div>
      ) : (
        /* Active Room Row: Код: XX | Игроков: N, Start Game button, Partner live stats & Leave */
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Exact status badge: Код: XX | Игроков: N */}
            <div
              data-testid="coop-room-status"
              className="bg-slate-950/40 border border-white/25 px-3 py-1 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-2 shadow-inner"
            >
              <Wifi
                className={`w-3.5 h-3.5 ${
                  connectionStatus === 'connected'
                    ? 'text-emerald-400'
                    : 'text-amber-300 animate-pulse'
                }`}
              />
              <span>
                Код: {roomCode} | Игроков: {playersCount}
              </span>
            </div>

            <span className="text-[11px] font-bold bg-white/15 px-2.5 py-1 rounded-xl flex items-center gap-1">
              {isHost ? (
                <>
                  <Crown className="w-3.5 h-3.5 text-amber-300" />
                  <span>Хост (ты выбираешь правила)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                  <span>Гость (игра по правилам хоста)</span>
                </>
              )}
            </span>

            {isHost && (
              <button
                type="button"
                onClick={onStartCoopRound}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition transform hover:scale-105 active:scale-95 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Начать игру</span>
              </button>
            )}

            {/* Partner Presence & Co-op Reward Summary */}
            {partner ? (
              <div className="flex items-center gap-2 bg-emerald-500/25 border border-emerald-300/40 px-3 py-1 rounded-xl text-xs font-bold">
                <span>🐾 Друг: <b>{partner.name}</b></span>
                <span className="text-emerald-200">|</span>
                <span>Слов за сессию: <b>{partner.sessionWordsTotal}</b></span>
                <span className="text-emerald-200">|</span>
                <span className="flex items-center gap-1 text-amber-200">
                  <Gift className="w-3.5 h-3.5" />
                  Отдых друга: <b>+{formatClock(partner.rewardSecondsTotal)}</b>
                </span>
              </div>
            ) : (
              <span className="text-xs text-indigo-100 font-semibold bg-white/10 px-2.5 py-1 rounded-xl">
                ⏳ Скажи другу код <b className="text-amber-300 font-mono">{roomCode}</b> для входа!
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-3 py-1 bg-rose-500/80 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </button>
        </div>
      )}
    </div>
  );
};
