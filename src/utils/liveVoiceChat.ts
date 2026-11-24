import { RoomParticipantRole, VoiceChunkPacket } from './mqttCoopRoom';

export const TARGET_PCM_SAMPLE_RATE = 16000;
export const PCM_CHUNK_SAMPLES = 3200; // 200ms per packet at 16kHz wideband HD voice

/**
 * Soft-knee limiter that prevents harsh digital clipping when speaking loudly into the microphone.
 */
export function softLimitSample(x: number): number {
  if (!Number.isFinite(x)) return 0;
  // Linear up to ±0.75, then smooth tanh saturation asymptotically approaching ±0.98
  const absX = Math.abs(x);
  if (absX <= 0.75) return x;
  const sign = x < 0 ? -1 : 1;
  return sign * (0.75 + 0.23 * Math.tanh((absX - 0.75) / 0.25));
}

/**
 * Downsamples Float32Array audio from inputSampleRate (e.g. 44100 or 48000 Hz)
 * to targetSampleRate (16000 Hz) with anti-aliasing averaging and soft-knee limiting,
 * then converts to Int16Array (signed 16-bit PCM).
 */
export function downsampleFloat32ToInt16(
  buffer: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number = TARGET_PCM_SAMPLE_RATE
): Int16Array {
  if (!buffer || buffer.length === 0) return new Int16Array(0);
  if (inputSampleRate <= targetSampleRate) {
    const out = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = softLimitSample(buffer[i]);
      out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return out;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(buffer.length / ratio));
  const result = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const center = i * ratio;
    const start = Math.max(0, Math.floor(center));
    const end = Math.min(buffer.length - 1, Math.ceil(center + ratio));
    let sum = 0;
    let weightSum = 0;

    for (let j = start; j <= end; j++) {
      // Triangular window weight for smoother anti-aliased resampling
      const dist = Math.abs(j - (center + ratio * 0.5));
      const weight = Math.max(0.1, 1 - dist / (ratio + 0.5));
      sum += buffer[j] * weight;
      weightSum += weight;
    }

    const avg = weightSum > 0 ? sum / weightSum : buffer[start] || 0;
    const limited = softLimitSample(avg);
    result[i] = limited < 0 ? Math.round(limited * 0x8000) : Math.round(limited * 0x7fff);
  }

  return result;
}

/**
 * Encodes Int16Array PCM samples to a base64 string (works identically on iPad, Android, Windows, macOS).
 */
export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

/**
 * Decodes a base64 string of signed 16-bit PCM back to Float32Array [-1.0, 1.0].
 */
export function base64ToFloat32Pcm(base64: string): Float32Array {
  if (!base64) return new Float32Array(0);
  let bytes: Uint8Array;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    const buf = Buffer.from(base64, 'base64');
    bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const floatOut = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true); // little-endian
    floatOut[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7fff;
  }
  return floatOut;
}

/**
 * Applies a subtle 2.5ms cosine micro-fade at buffer edges to eliminate clicks/pops
 * if network jitter ever causes a tiny gap between packets.
 */
export function applyMicroDeclickFade(samples: Float32Array, sampleRate: number = TARGET_PCM_SAMPLE_RATE): void {
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.0025), Math.floor(samples.length / 8));
  if (fadeSamples <= 1) return;
  for (let i = 0; i < fadeSamples; i++) {
    const gain = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
}

/**
 * Computes RMS speech level (0..100) from Int16Array for visual mic indicator.
 */
export function computePcmLevelPercent(samples: Int16Array): number {
  if (!samples || samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const norm = samples[i] / 32768;
    sumSq += norm * norm;
  }
  const rms = Math.sqrt(sumSq / samples.length);
  return Math.min(100, Math.round(rms * 320));
}

/**
 * HD 16kHz Wideband Live Voice Communicator using Web Audio API PCM streaming.
 * - Includes High-Pass (90 Hz rumble removal), Anti-Aliasing Low-Pass (7200 Hz),
 *   DynamicsCompressorNode voice leveling, and soft-knee limiting to prevent distortion.
 * - Works across iPad/iOS, Android tablets, Windows PCs, and MacBooks without MediaRecorder codec issues.
 */
export class LiveVoiceCommunicator {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassNode: BiquadFilterNode | null = null;
  private lowpassNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private muteGainNode: GainNode | null = null;
  private playbackMasterNode: DynamicsCompressorNode | null = null;
  private isTalking = false;
  private nextPlaybackTime = 0;
  private unlockBoundHandler: (() => void) | null = null;
  private onLevelCallback: ((levelPercent: number) => void) | null = null;
  private onReceivingCallback: ((receiving: boolean) => void) | null = null;
  private receivingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.setupAutoUnlock();
  }

  public setLevelListener(cb: ((levelPercent: number) => void) | null): void {
    this.onLevelCallback = cb;
  }

  public setReceivingListener(cb: ((receiving: boolean) => void) | null): void {
    this.onReceivingCallback = cb;
  }

  private getOrCreateAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.audioCtx = new AudioContextClass();
      this.playbackMasterNode = null;
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private getOrCreatePlaybackDestination(ctx: AudioContext): AudioNode {
    if (!this.playbackMasterNode) {
      try {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 3;
        comp.attack.value = 0.003;
        comp.release.value = 0.15;
        comp.connect(ctx.destination);
        this.playbackMasterNode = comp;
      } catch {
        return ctx.destination;
      }
    }
    return this.playbackMasterNode;
  }

  /**
   * Unlocks Web Audio playback on iOS/iPadOS/Android tablets and desktop browsers
   * on the very first touch, click, or keypress anywhere in the app.
   */
  private setupAutoUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      const ctx = this.getOrCreateAudioContext();
      if (ctx && ctx.state === 'running') {
        try {
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        } catch {
          // ignore
        }
      }
    };
    this.unlockBoundHandler = unlock;
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  public unlockAudioNow(): void {
    this.getOrCreateAudioContext();
  }

  public isMicActive(): boolean {
    return this.isTalking;
  }

  /**
   * Requests microphone access with automatic fallback:
   * 1. Enhanced speech constraints (echoCancellation, noiseSuppression, autoGainControl)
   * 2. Plain `{ audio: true }` fallback for desktop PCs or tablets with strict audio drivers
   */
  private async requestMicrophoneStream(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    }
  }

  public async startTalking(params: {
    senderId: string;
    senderName: string;
    senderRole: RoomParticipantRole;
    onChunk: (packet: VoiceChunkPacket) => void;
    onStateChange?: (talking: boolean, errorMsg?: string) => void;
  }): Promise<boolean> {
    if (this.isTalking) return true;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      params.onStateChange?.(false, 'Микрофон недоступен в этом браузере (нужен HTTPS)');
      return false;
    }

    try {
      const ctx = this.getOrCreateAudioContext();
      if (!ctx) {
        params.onStateChange?.(false, 'Аудиосистема браузера недоступна');
        return false;
      }
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const stream = await this.requestMicrophoneStream();
      this.micStream = stream;
      this.isTalking = true;
      params.onStateChange?.(true);

      const source = ctx.createMediaStreamSource(stream);
      this.sourceNode = source;

      // 1. High-pass filter at 90 Hz removes low-frequency hum, breath pops, and desk rumble
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 90;
      highpass.Q.value = 0.707;
      this.highpassNode = highpass;

      // 2. Anti-aliasing Low-pass filter at 7200 Hz (below 8000 Hz Nyquist for 16kHz sample rate)
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 7200;
      lowpass.Q.value = 0.707;
      this.lowpassNode = lowpass;

      // 3. Smooth voice compressor / limiter so loud speech never distorts or clips
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 15;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;
      this.compressorNode = compressor;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      this.processorNode = processor;

      // Connect processor through a 0-gain node so the speaker doesn't hear their own voice locally
      const zeroGain = ctx.createGain();
      zeroGain.gain.value = 0;
      this.muteGainNode = zeroGain;

      let pendingSamples: number[] = [];

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isTalking) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleFloat32ToInt16(
          inputData,
          ctx.sampleRate,
          TARGET_PCM_SAMPLE_RATE
        );

        const level = computePcmLevelPercent(downsampled);
        this.onLevelCallback?.(level);

        for (let i = 0; i < downsampled.length; i++) {
          pendingSamples.push(downsampled[i]);
        }

        while (pendingSamples.length >= PCM_CHUNK_SAMPLES) {
          const chunkItems = pendingSamples.slice(0, PCM_CHUNK_SAMPLES);
          pendingSamples = pendingSamples.slice(PCM_CHUNK_SAMPLES);
          const slice = new Int16Array(chunkItems);
          const pcmBase64 = int16ToBase64(slice);
          if (pcmBase64) {
            params.onChunk({
              senderId: params.senderId,
              senderName: params.senderName,
              senderRole: params.senderRole,
              chunkId: `vc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              format: 'pcm_s16le',
              sampleRate: TARGET_PCM_SAMPLE_RATE,
              pcmBase64,
              mimeType: 'audio/pcm',
              audioBase64: pcmBase64,
              timestamp: Date.now(),
            });
          }
        }
      };

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(compressor);
      compressor.connect(processor);
      processor.connect(zeroGain);
      zeroGain.connect(ctx.destination);

      return true;
    } catch (err) {
      this.isTalking = false;
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        params.onStateChange?.(false, 'На этом компьютере или планшете не найден подключённый микрофон');
      } else if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        params.onStateChange?.(false, 'Разреши доступ к микрофону в адресной строке браузера');
      } else {
        params.onStateChange?.(false, 'Не удалось включить микрофон — проверь подключение гарнитуры/микрофона');
      }
      return false;
    }
  }

  public stopTalking(onStateChange?: (talking: boolean) => void): void {
    this.isTalking = false;
    this.onLevelCallback?.(0);

    if (this.processorNode) {
      try {
        this.processorNode.onaudioprocess = null;
        this.processorNode.disconnect();
      } catch {
        // ignore
      }
      this.processorNode = null;
    }
    if (this.compressorNode) {
      try {
        this.compressorNode.disconnect();
      } catch {
        // ignore
      }
      this.compressorNode = null;
    }
    if (this.lowpassNode) {
      try {
        this.lowpassNode.disconnect();
      } catch {
        // ignore
      }
      this.lowpassNode = null;
    }
    if (this.highpassNode) {
      try {
        this.highpassNode.disconnect();
      } catch {
        // ignore
      }
      this.highpassNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    if (this.muteGainNode) {
      try {
        this.muteGainNode.disconnect();
      } catch {
        // ignore
      }
      this.muteGainNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    onStateChange?.(false);
  }

  /**
   * Plays an incoming voice packet smoothly through Web Audio API with a 120ms jitter buffer,
   * edge de-clicking, and clean dynamics control so speech never crackles or clips.
   */
  public enqueueIncomingChunk(packet: VoiceChunkPacket, soundEnabled: boolean = true): void {
    if (!soundEnabled) return;

    const rawBase64 = packet.pcmBase64 || packet.audioBase64;
    if (!rawBase64) return;

    const ctx = this.getOrCreateAudioContext();
    if (!ctx) return;

    // Notify UI that live voice packets are actively arriving right now
    this.onReceivingCallback?.(true);
    if (this.receivingTimeout) clearTimeout(this.receivingTimeout);
    this.receivingTimeout = setTimeout(() => {
      this.onReceivingCallback?.(false);
    }, 900);

    // Universal 16-bit PCM (16kHz wideband default, backward compatible with 8kHz)
    if (packet.format === 'pcm_s16le' || packet.mimeType === 'audio/pcm' || packet.pcmBase64) {
      try {
        const floatSamples = base64ToFloat32Pcm(rawBase64);
        if (floatSamples.length === 0) return;

        const sampleRate = packet.sampleRate || TARGET_PCM_SAMPLE_RATE;
        applyMicroDeclickFade(floatSamples, sampleRate);

        const audioBuffer = ctx.createBuffer(1, floatSamples.length, sampleRate);
        audioBuffer.getChannelData(0).set(floatSamples);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const destination = this.getOrCreatePlaybackDestination(ctx);
        source.connect(destination);

        const now = ctx.currentTime;
        // 120ms initial jitter cushion prevents network Wi-Fi micro-stutters;
        // reset if buffer ever drifts more than 0.85s ahead
        if (this.nextPlaybackTime < now + 0.015 || this.nextPlaybackTime > now + 0.85) {
          this.nextPlaybackTime = now + 0.12;
        }

        source.start(this.nextPlaybackTime);
        this.nextPlaybackTime += audioBuffer.duration;
      } catch {
        // ignore malformed PCM slice
      }
      return;
    }

    // Legacy fallback if an older tab sends a MediaRecorder blob
    try {
      const mime = packet.mimeType || 'audio/webm';
      const audio = new Audio(`data:${mime};base64,${rawBase64}`);
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }

  public destroy(): void {
    this.stopTalking();
    if (this.receivingTimeout) {
      clearTimeout(this.receivingTimeout);
      this.receivingTimeout = null;
    }
    if (typeof window !== 'undefined' && this.unlockBoundHandler) {
      window.removeEventListener('pointerdown', this.unlockBoundHandler);
      window.removeEventListener('touchstart', this.unlockBoundHandler);
      window.removeEventListener('keydown', this.unlockBoundHandler);
      this.unlockBoundHandler = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.playbackMasterNode = null;
    }
  }
}
