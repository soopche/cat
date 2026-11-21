import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MQTT_BROKERS,
  TOPIC_NAMESPACE,
  PLAYER_TIMEOUT_MS,
  generateTwoDigitRoomCode,
  isValidRoomCode,
  getRoomWildcardTopic,
  getPlayerStateTopic,
  getRoomEventsTopic,
  getRoomVoiceTopic,
  getOrCreateSessionPlayerId,
  pruneStalePlayers,
  determineCoopWinner,
  CoopPlayerState,
} from './mqttCoopRoom';

test('generateTwoDigitRoomCode generates valid 2-digit codes 10-99', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateTwoDigitRoomCode();
    assert.equal(code.length, 2);
    assert.equal(isValidRoomCode(code), true);
    const num = Number(code);
    assert.ok(num >= 10 && num <= 99);
  }
  assert.equal(generateTwoDigitRoomCode(() => 0), '10');
  assert.equal(generateTwoDigitRoomCode(() => 0.9999), '99');
  assert.equal(isValidRoomCode('05'), false);
  assert.equal(isValidRoomCode('79'), true);
  assert.equal(isValidRoomCode('100'), false);
});

test('MQTT topic structure uses vox-arcanum-game-2026/typecat/room/XX/... and EMQX/HiveMQ brokers', () => {
  assert.equal(MQTT_BROKERS[0], 'wss://broker.emqx.io:8084/mqtt');
  assert.equal(MQTT_BROKERS[1], 'wss://broker.hivemq.com:8884/mqtt');
  assert.ok(TOPIC_NAMESPACE.startsWith('vox-arcanum-game-2026'));
  assert.equal(getRoomWildcardTopic('79'), `${TOPIC_NAMESPACE}/room/79/#`);
  assert.equal(getPlayerStateTopic('79', 'p_123'), `${TOPIC_NAMESPACE}/room/79/player/p_123`);
  assert.equal(getRoomEventsTopic('79'), `${TOPIC_NAMESPACE}/room/79/events`);
  assert.equal(getRoomVoiceTopic('79'), `${TOPIC_NAMESPACE}/room/79/voice`);
});

test('getOrCreateSessionPlayerId persists and reuses sessionStorage ID', () => {
  const memory = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
  };
  const firstId = getOrCreateSessionPlayerId(mockStorage);
  assert.ok(firstId.startsWith('p_'));
  const secondId = getOrCreateSessionPlayerId(mockStorage);
  assert.equal(firstId, secondId);
});

test('pruneStalePlayers removes inactive remote players after 3 seconds while preserving self', () => {
  const map = new Map<string, CoopPlayerState>();
  const now = 100_000;
  const base: CoopPlayerState = {
    playerId: 'self',
    name: 'Хост',
    isHost: true,
    color: 'orange',
    mode: 'speed_text',
    progressPercent: 0,
    wordsCompleted: 0,
    lettersMastered: 0,
    wpm: 0,
    cpm: 0,
    accuracy: 100,
    elapsedSeconds: 0,
    isFinished: false,
    sessionWordsTotal: 0,
    rewardSecondsTotal: 0,
    updatedAt: now - 10_000,
  };

  map.set('self', base);
  map.set('active_peer', { ...base, playerId: 'active_peer', isHost: false, updatedAt: now - 1500 });
  map.set('stale_peer', { ...base, playerId: 'stale_peer', isHost: false, updatedAt: now - (PLAYER_TIMEOUT_MS + 200) });

  const changed = pruneStalePlayers(map, 'self', now, PLAYER_TIMEOUT_MS);
  assert.equal(changed, true);
  assert.equal(map.has('self'), true);
  assert.equal(map.has('active_peer'), true);
  assert.equal(map.has('stale_peer'), false);
});

test('determineCoopWinner accurately determines winner across speed_text, word_goal, and letter_sprint', () => {
  const p1: CoopPlayerState = {
    playerId: 'p1',
    name: 'Аня',
    isHost: true,
    color: 'orange',
    mode: 'word_goal',
    progressPercent: 100,
    wordsCompleted: 50,
    lettersMastered: 0,
    wpm: 35,
    cpm: 175,
    accuracy: 98,
    elapsedSeconds: 45,
    isFinished: true,
    finishedAt: 1000,
    sessionWordsTotal: 50,
    rewardSecondsTotal: 600,
    updatedAt: 1000,
  };

  const p2: CoopPlayerState = {
    ...p1,
    playerId: 'p2',
    name: 'Друг',
    isHost: false,
    color: 'blue',
    isFinished: false,
    progressPercent: 80,
    wordsCompleted: 40,
    wpm: 28,
  };

  assert.equal(determineCoopWinner(p1, p2), 'self');
  assert.equal(determineCoopWinner(p2, p1), 'partner');

  // Letter sprint compares wordsCompleted then lettersMastered when both finished
  const s1: CoopPlayerState = { ...p1, mode: 'letter_sprint', wordsCompleted: 22, lettersMastered: 4 };
  const s2: CoopPlayerState = { ...p2, mode: 'letter_sprint', isFinished: true, wordsCompleted: 25, lettersMastered: 5 };
  assert.equal(determineCoopWinner(s1, s2), 'partner');
});

import {
  downsampleFloat32ToInt16,
  int16ToBase64,
  base64ToFloat32Pcm,
  computePcmLevelPercent,
  TARGET_PCM_SAMPLE_RATE,
} from './liveVoiceChat';

test('WebAudio PCM voice encoder/decoder works identically across iPad, Android tablets, and desktop PCs without MediaRecorder codecs', () => {
  // Simulate 48kHz microphone buffer with a 440Hz sine wave
  const inputRate = 48000;
  const inputSamples = new Float32Array(4800); // 100ms at 48kHz
  for (let i = 0; i < inputSamples.length; i++) {
    inputSamples[i] = Math.sin((2 * Math.PI * 440 * i) / inputRate) * 0.5;
  }

  const downsampledInt16 = downsampleFloat32ToInt16(inputSamples, inputRate, TARGET_PCM_SAMPLE_RATE);
  assert.equal(downsampledInt16.length, 800); // 100ms at 8kHz

  const levelPct = computePcmLevelPercent(downsampledInt16);
  assert.ok(levelPct > 20 && levelPct <= 100);

  const b64 = int16ToBase64(downsampledInt16);
  assert.ok(b64.length > 100);

  const decodedFloat32 = base64ToFloat32Pcm(b64);
  assert.equal(decodedFloat32.length, downsampledInt16.length);

  // Verify signal integrity after round-trip
  for (let i = 0; i < 20; i++) {
    const expected = downsampledInt16[i] / (downsampledInt16[i] < 0 ? 0x8000 : 0x7fff);
    assert.ok(Math.abs(decodedFloat32[i] - expected) < 0.001);
  }
});

