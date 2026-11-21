import { RoomParticipantRole, VoiceChunkPacket } from './mqttCoopRoom';

export const VOICE_SLICE_DURATION_MS = 550;

export function selectSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class LiveVoiceCommunicator {
  private stream: MediaStream | null = null;
  private sliceInterval: ReturnType<typeof setInterval> | null = null;
  private activeRecorder: MediaRecorder | null = null;
  private isTalking = false;
  private playbackQueue: { url: string }[] = [];
  private isPlayingAudio = false;
  private currentAudio: HTMLAudioElement | null = null;

  public isMicActive(): boolean {
    return this.isTalking;
  }

  public async startTalking(params: {
    senderId: string;
    senderName: string;
    senderRole: RoomParticipantRole;
    onChunk: (packet: VoiceChunkPacket) => void;
    onStateChange?: (talking: boolean, errorMsg?: string) => void;
  }): Promise<boolean> {
    if (this.isTalking) return true;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      params.onStateChange?.(false, 'Микрофон недоступен в этом браузере');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.stream = stream;
      this.isTalking = true;
      params.onStateChange?.(true);

      const mimeType = selectSupportedAudioMimeType();

      const recordSingleSlice = () => {
        if (!this.isTalking || !this.stream) return;
        try {
          const recorder = mimeType
            ? new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 24000 })
            : new MediaRecorder(this.stream);
          this.activeRecorder = recorder;
          const chunks: BlobPart[] = [];

          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              chunks.push(ev.data);
            }
          };

          recorder.onstop = async () => {
            if (chunks.length === 0) return;
            const effectiveMime = recorder.mimeType || mimeType || 'audio/webm';
            const blob = new Blob(chunks, { type: effectiveMime });
            if (blob.size < 40) return;
            try {
              const audioBase64 = await blobToBase64(blob);
              if (audioBase64) {
                params.onChunk({
                  senderId: params.senderId,
                  senderName: params.senderName,
                  senderRole: params.senderRole,
                  chunkId: `vc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  mimeType: effectiveMime,
                  audioBase64,
                  timestamp: Date.now(),
                });
              }
            } catch {
              // ignore slice encoding error
            }
          };

          recorder.start();
          setTimeout(() => {
            if (recorder.state === 'recording') {
              try {
                recorder.stop();
              } catch {
                // ignore
              }
            }
          }, VOICE_SLICE_DURATION_MS);
        } catch {
          // ignore slice start error
        }
      };

      recordSingleSlice();
      this.sliceInterval = setInterval(recordSingleSlice, VOICE_SLICE_DURATION_MS + 25);
      return true;
    } catch {
      this.isTalking = false;
      params.onStateChange?.(false, 'Разреши доступ к микрофону в браузере, чтобы говорить');
      return false;
    }
  }

  public stopTalking(onStateChange?: (talking: boolean) => void): void {
    this.isTalking = false;
    if (this.sliceInterval) {
      clearInterval(this.sliceInterval);
      this.sliceInterval = null;
    }
    if (this.activeRecorder && this.activeRecorder.state === 'recording') {
      try {
        this.activeRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.activeRecorder = null;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    onStateChange?.(false);
  }

  public enqueueIncomingChunk(packet: VoiceChunkPacket, soundEnabled: boolean = true): void {
    if (!soundEnabled || !packet.audioBase64) return;
    // Drop stale voice packets older than 4 seconds
    if (Date.now() - packet.timestamp > 4000) return;
    const mime = packet.mimeType || 'audio/webm';
    const dataUrl = `data:${mime};base64,${packet.audioBase64}`;
    // Prevent queue backlog
    if (this.playbackQueue.length > 6) {
      this.playbackQueue.shift();
    }
    this.playbackQueue.push({ url: dataUrl });
    this.processPlaybackQueue();
  }

  private processPlaybackQueue(): void {
    if (this.isPlayingAudio || this.playbackQueue.length === 0) return;
    const nextItem = this.playbackQueue.shift();
    if (!nextItem) return;

    this.isPlayingAudio = true;
    try {
      const audio = new Audio(nextItem.url);
      this.currentAudio = audio;
      const finish = () => {
        this.isPlayingAudio = false;
        this.currentAudio = null;
        this.processPlaybackQueue();
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
    } catch {
      this.isPlayingAudio = false;
      this.processPlaybackQueue();
    }
  }

  public destroy(): void {
    this.stopTalking();
    this.playbackQueue = [];
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
    this.isPlayingAudio = false;
  }
}
