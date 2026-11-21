import mqtt, { MqttClient } from 'mqtt';

export const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
] as const;

export const TOPIC_NAMESPACE = 'vox-arcanum-game-2026/typecat';
export const HEARTBEAT_INTERVAL_MS = 500;
export const PLAYER_TIMEOUT_MS = 3000;

export type CoopActiveMode = 'classic_pet' | 'speed_text' | 'word_goal' | 'letter_sprint' | 'cat_chat';
export type RoomParticipantRole = 'player' | 'teacher' | 'student';

export interface CoopPlayerState {
  playerId: string;
  name: string;
  isHost: boolean;
  role?: RoomParticipantRole;
  color: 'orange' | 'blue';
  mode: CoopActiveMode;
  // Live race / game progress
  progressPercent: number;
  wordsCompleted: number;
  lettersMastered: number;
  wpm: number;
  cpm: number;
  accuracy: number;
  elapsedSeconds: number;
  isFinished: boolean;
  finishedAt?: number;
  // Co-op session reward stats
  sessionWordsTotal: number;
  rewardSecondsTotal: number;
  // Study / Teacher monitoring telemetry
  currentTargetWord?: string;
  currentTypedText?: string;
  errorsCount?: number;
  catLevel?: string;
  xp?: number;
  dailyWordsTyped?: number;
  totalWordsTyped?: number;
  completedQuestsCount?: number;
  learnedLettersCount?: number;
  learnedLettersList?: string;
  recentCompletedWords?: string[];
  isVoiceTalking?: boolean;
  updatedAt: number;
}

export interface CoopGameConfig {
  configId: string;
  mode: CoopActiveMode;
  // SpeedTextMode shared state
  speedStoryId?: string;
  speedTargetText?: string;
  // WordGoalMode shared state
  marathonTargetGoal?: number;
  marathonWordsQueue?: string[];
  // LetterSprintMode shared state
  sprintSubMode?: 'random' | 'custom_letters';
  sprintSelectedLetters?: string[];
  sprintWordsPerLetter?: number;
  sprintMinutesLimit?: number;
  sprintSequence?: { letter: string; words: string[] }[];
  sprintStartedAt?: number;
}

export type TeacherNotificationTone = 'hurry' | 'praise' | 'attention' | 'task';

export interface VoiceChunkPacket {
  senderId: string;
  senderName: string;
  senderRole: RoomParticipantRole;
  chunkId: string;
  mimeType: string;
  audioBase64: string;
  timestamp: number;
}

export type CoopRoomEvent =
  | {
      type: 'sync_config';
      senderId: string;
      config: CoopGameConfig;
      timestamp: number;
    }
  | {
      type: 'start_round';
      senderId: string;
      config: CoopGameConfig;
      timestamp: number;
    }
  | {
      type: 'chat_message';
      senderId: string;
      senderName: string;
      messageId: string;
      text: string;
      timestamp: number;
    }
  | {
      type: 'teacher_notification';
      senderId: string;
      senderName: string;
      notificationId: string;
      text: string;
      tone: TeacherNotificationTone;
      speakAloud: boolean;
      timestamp: number;
    }
  | {
      type: 'request_config';
      senderId: string;
      timestamp: number;
    }
  | {
      type: 'leave';
      senderId: string;
      timestamp: number;
    };

export interface MatchmakingBeacon {
  playerId: string;
  playerName: string;
  roomCode: string;
  timestamp: number;
}

export function generateTwoDigitRoomCode(randomFn: () => number = Math.random): string {
  const code = Math.floor(10 + randomFn() * 90);
  return String(Math.min(99, Math.max(10, code)));
}

export function isValidRoomCode(code: string): boolean {
  return /^[1-9][0-9]$/.test(code.trim());
}

export function getRoomWildcardTopic(roomCode: string): string {
  return `${TOPIC_NAMESPACE}/room/${roomCode}/#`;
}

export function getPlayerStateTopic(roomCode: string, playerId: string): string {
  return `${TOPIC_NAMESPACE}/room/${roomCode}/player/${playerId}`;
}

export function getRoomEventsTopic(roomCode: string): string {
  return `${TOPIC_NAMESPACE}/room/${roomCode}/events`;
}

export function getRoomVoiceTopic(roomCode: string): string {
  return `${TOPIC_NAMESPACE}/room/${roomCode}/voice`;
}

export function getMatchmakingTopic(): string {
  return `${TOPIC_NAMESPACE}/matchmaking/lobby`;
}

export function getOrCreateSessionPlayerId(storage?: Pick<Storage, 'getItem' | 'setItem'>): string {
  const store = storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  const key = 'typecat_coop_player_id_v1';
  if (store) {
    const existing = store.getItem(key);
    if (existing && existing.trim().length > 0) {
      return existing;
    }
  }
  const generated = 'p_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
  if (store) {
    try {
      store.setItem(key, generated);
    } catch {
      // Ignore storage quota errors
    }
  }
  return generated;
}

export function pruneStalePlayers(
  playersMap: Map<string, CoopPlayerState>,
  selfId: string,
  now: number = Date.now(),
  timeoutMs: number = PLAYER_TIMEOUT_MS
): boolean {
  let changed = false;
  for (const [id, state] of playersMap.entries()) {
    if (id !== selfId && now - state.updatedAt > timeoutMs) {
      playersMap.delete(id);
      changed = true;
    }
  }
  return changed;
}

export function determineCoopWinner(
  self: CoopPlayerState,
  partner: CoopPlayerState | null
): 'self' | 'partner' | 'tie' | null {
  if (!partner) return self.isFinished ? 'self' : null;
  if (!self.isFinished && !partner.isFinished) return null;

  if (self.isFinished && !partner.isFinished) return 'self';
  if (!self.isFinished && partner.isFinished) return 'partner';

  // For letter_sprint (fixed timer), compare wordsCompleted then lettersMastered
  if (self.mode === 'letter_sprint') {
    if (self.wordsCompleted > partner.wordsCompleted) return 'self';
    if (partner.wordsCompleted > self.wordsCompleted) return 'partner';
    if (self.lettersMastered > partner.lettersMastered) return 'self';
    if (partner.lettersMastered > self.lettersMastered) return 'partner';
    return 'tie';
  }

  // For speed_text and word_goal, whoever finished first (or higher WPM if simultaneous) wins
  if (self.finishedAt && partner.finishedAt && Math.abs(self.finishedAt - partner.finishedAt) > 300) {
    return self.finishedAt < partner.finishedAt ? 'self' : 'partner';
  }
  if (self.wpm > partner.wpm) return 'self';
  if (partner.wpm > self.wpm) return 'partner';
  return 'tie';
}

export interface MqttCoopRoomCallbacks {
  onPlayersChange: (players: CoopPlayerState[]) => void;
  onEvent: (event: CoopRoomEvent) => void;
  onVoiceChunk?: (chunk: VoiceChunkPacket) => void;
  onConnectionChange: (status: 'connecting' | 'connected' | 'disconnected', brokerUrl?: string) => void;
}

export class MqttCoopRoomManager {
  private client: MqttClient | null = null;
  private roomCode: string;
  private selfState: CoopPlayerState;
  private players: Map<string, CoopPlayerState> = new Map();
  private callbacks: MqttCoopRoomCallbacks;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private brokerIndex = 0;
  private isDestroyed = false;
  private boundUnloadHandler: () => void;

  constructor(
    roomCode: string,
    initialSelfState: CoopPlayerState,
    callbacks: MqttCoopRoomCallbacks
  ) {
    this.roomCode = roomCode;
    this.selfState = { ...initialSelfState, updatedAt: Date.now() };
    this.players.set(this.selfState.playerId, this.selfState);
    this.callbacks = callbacks;
    this.boundUnloadHandler = () => this.publishLeaveAndDisconnect();
  }

  public start(): void {
    this.isDestroyed = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.boundUnloadHandler);
      window.addEventListener('pagehide', this.boundUnloadHandler);
    }
    this.connectToBroker(0);
    this.pruneTimer = setInterval(() => {
      if (pruneStalePlayers(this.players, this.selfState.playerId, Date.now(), PLAYER_TIMEOUT_MS)) {
        this.emitPlayers();
      }
    }, 500);
  }

  private connectToBroker(index: number): void {
    if (this.isDestroyed) return;
    this.brokerIndex = index % MQTT_BROKERS.length;
    const brokerUrl = MQTT_BROKERS[this.brokerIndex];
    this.callbacks.onConnectionChange('connecting', brokerUrl);

    const leavePayload = JSON.stringify({
      type: 'leave',
      senderId: this.selfState.playerId,
      timestamp: Date.now(),
    } satisfies CoopRoomEvent);

    const client = mqtt.connect(brokerUrl, {
      clientId: `typecat_${this.selfState.playerId}_${Math.random().toString(16).slice(2, 6)}`,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 2000,
      will: {
        topic: getRoomEventsTopic(this.roomCode),
        payload: leavePayload,
        qos: 0,
        retain: false,
      },
    });

    this.client = client;

    let connectedOnce = false;
    const fallbackTimeout = setTimeout(() => {
      if (!connectedOnce && !this.isDestroyed) {
        try {
          client.end(true);
        } catch {
          // ignore
        }
        this.connectToBroker(this.brokerIndex + 1);
      }
    }, 5500);

    client.on('connect', () => {
      if (this.isDestroyed) return;
      connectedOnce = true;
      clearTimeout(fallbackTimeout);
      this.callbacks.onConnectionChange('connected', brokerUrl);

      client.subscribe(getRoomWildcardTopic(this.roomCode), { qos: 0 }, () => {
        this.publishSelfState();
        if (!this.selfState.isHost) {
          this.publishEvent({
            type: 'request_config',
            senderId: this.selfState.playerId,
            timestamp: Date.now(),
          });
        }
      });

      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => {
        this.publishSelfState();
      }, HEARTBEAT_INTERVAL_MS);
    });

    client.on('message', (topic, payloadBuffer) => {
      if (this.isDestroyed) return;
      try {
        const text = payloadBuffer.toString();
        if (!text) return;
        const parsed = JSON.parse(text);

        if (topic.includes('/player/')) {
          const incoming = parsed as CoopPlayerState;
          if (!incoming || !incoming.playerId) return;
          if (incoming.playerId === this.selfState.playerId) return;
          this.players.set(incoming.playerId, {
            ...incoming,
            updatedAt: Date.now(),
          });
          this.emitPlayers();
        } else if (topic.endsWith('/events')) {
          const ev = parsed as CoopRoomEvent;
          if (!ev || !ev.type) return;
          if (ev.type === 'leave') {
            if (ev.senderId !== this.selfState.playerId) {
              this.players.delete(ev.senderId);
              this.emitPlayers();
            }
            return;
          }
          if (ev.senderId !== this.selfState.playerId) {
            this.callbacks.onEvent(ev);
          }
        } else if (topic.endsWith('/voice')) {
          const chunk = parsed as VoiceChunkPacket;
          if (!chunk || !chunk.audioBase64 || chunk.senderId === this.selfState.playerId) return;
          this.callbacks.onVoiceChunk?.(chunk);
        }
      } catch {
        // Ignore malformed packets
      }
    });

    client.on('error', () => {
      if (!connectedOnce && !this.isDestroyed) {
        clearTimeout(fallbackTimeout);
        try {
          client.end(true);
        } catch {
          // ignore
        }
        this.connectToBroker(this.brokerIndex + 1);
      }
    });

    client.on('close', () => {
      if (!this.isDestroyed) {
        this.callbacks.onConnectionChange('disconnected', brokerUrl);
      }
    });
  }

  public updateSelfState(patch: Partial<CoopPlayerState>): void {
    this.selfState = {
      ...this.selfState,
      ...patch,
      updatedAt: Date.now(),
    };
    this.players.set(this.selfState.playerId, this.selfState);
    this.emitPlayers();
    this.publishSelfState();
  }

  public publishSelfState(): void {
    if (this.isDestroyed || !this.client || !this.client.connected) return;
    this.selfState.updatedAt = Date.now();
    this.players.set(this.selfState.playerId, this.selfState);
    const topic = getPlayerStateTopic(this.roomCode, this.selfState.playerId);
    this.client.publish(topic, JSON.stringify(this.selfState), { qos: 0, retain: false });
  }

  public publishEvent(event: CoopRoomEvent): void {
    if (this.isDestroyed || !this.client || !this.client.connected) return;
    const topic = getRoomEventsTopic(this.roomCode);
    this.client.publish(topic, JSON.stringify(event), { qos: 0, retain: false });
  }

  public publishVoiceChunk(chunk: VoiceChunkPacket): void {
    if (this.isDestroyed || !this.client || !this.client.connected) return;
    const topic = getRoomVoiceTopic(this.roomCode);
    this.client.publish(topic, JSON.stringify(chunk), { qos: 0, retain: false });
  }

  private emitPlayers(): void {
    const list = Array.from(this.players.values()).sort((a, b) => {
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      return a.playerId.localeCompare(b.playerId);
    });
    this.callbacks.onPlayersChange(list);
  }

  public publishLeaveAndDisconnect(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.boundUnloadHandler);
      window.removeEventListener('pagehide', this.boundUnloadHandler);
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }

    if (this.client) {
      try {
        if (this.client.connected) {
          this.client.publish(
            getRoomEventsTopic(this.roomCode),
            JSON.stringify({
              type: 'leave',
              senderId: this.selfState.playerId,
              timestamp: Date.now(),
            } satisfies CoopRoomEvent),
            { qos: 0, retain: false }
          );
        }
        this.client.end(true);
      } catch {
        // ignore
      }
      this.client = null;
    }
  }
}

/**
 * Quick matchmaking over MQTT: listens briefly on matchmaking topic.
 * If another player is waiting in matchmaking within ~1.2s, joins their room code;
 * otherwise creates a new 2-digit room as host and broadcasts beacons so the next seeker joins!
 */
export function findOrCreateRandomRoom(
  playerId: string,
  playerName: string,
  onMatched: (roomCode: string, isHost: boolean) => void
): () => void {
  let settled = false;
  const client = mqtt.connect(MQTT_BROKERS[0], {
    clientId: `typecat_mm_${playerId}_${Math.random().toString(16).slice(2, 6)}`,
    clean: true,
    connectTimeout: 4000,
  });

  const topic = getMatchmakingTopic();
  let waitTimer: ReturnType<typeof setTimeout> | null = null;
  let beaconInterval: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    settled = true;
    if (waitTimer) clearTimeout(waitTimer);
    if (beaconInterval) clearInterval(beaconInterval);
    try {
      client.end(true);
    } catch {
      // ignore
    }
  };

  client.on('connect', () => {
    if (settled) return;
    client.subscribe(topic, { qos: 0 }, () => {
      // Wait 1200ms to see if someone is already advertising an open room
      waitTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const myRoomCode = generateTwoDigitRoomCode();
        // Broadcast our new room code for 12 seconds in the background so any seeker joins us
        const publishBeacon = () => {
          if (client.connected) {
            const beacon: MatchmakingBeacon = {
              playerId,
              playerName,
              roomCode: myRoomCode,
              timestamp: Date.now(),
            };
            client.publish(topic, JSON.stringify(beacon), { qos: 0, retain: false });
          }
        };
        publishBeacon();
        let count = 0;
        beaconInterval = setInterval(() => {
          count++;
          if (count > 15) {
            if (beaconInterval) clearInterval(beaconInterval);
            try {
              client.end(true);
            } catch {
              // ignore
            }
            return;
          }
          publishBeacon();
        }, 700);

        onMatched(myRoomCode, true);
      }, 1200);
    });
  });

  client.on('message', (msgTopic, payload) => {
    if (settled || msgTopic !== topic) return;
    try {
      const beacon = JSON.parse(payload.toString()) as MatchmakingBeacon;
      if (
        beacon &&
        beacon.playerId !== playerId &&
        isValidRoomCode(beacon.roomCode) &&
        Date.now() - beacon.timestamp < 5000
      ) {
        settled = true;
        if (waitTimer) clearTimeout(waitTimer);
        try {
          client.end(true);
        } catch {
          // ignore
        }
        onMatched(beacon.roomCode, false);
      }
    } catch {
      // ignore
    }
  });

  client.on('error', () => {
    if (!settled) {
      settled = true;
      if (waitTimer) clearTimeout(waitTimer);
      onMatched(generateTwoDigitRoomCode(), true);
    }
  });

  return cleanup;
}
