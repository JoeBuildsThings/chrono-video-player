import { create } from 'zustand';
import {
  ABRepeatState,
  AspectRatioMode,
  DecoderMode,
  SubtitleTrack,
  VideoItem,
} from '../core/types';

interface PlayerState {
  activeVideo: VideoItem | null;
  playlist: VideoItem[];
  isMinimized: boolean;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isBuffering: boolean;
  isHudVisible: boolean;
  isLocked: boolean;
  playbackSpeed: number;
  volumeBoost: number;
  isMuted: boolean;
  brightness: number;
  decoderMode: DecoderMode;
  aspectRatio: AspectRatioMode;
  zoomScale: number;
  abRepeat: ABRepeatState;
  subtitleTracks: SubtitleTrack[];
  activeSubtitleId: string | null;
  subtitleOffsetMs: number;
  subtitleFontSize: number;
  audioOffsetMs: number;
  activeEqPresetId: string;
  eqBands: number[];
  sleepTimerRemainingSec: number | null;
  isBackgroundAudioEnabled: boolean;
  openVideo: (video: VideoItem, queue?: VideoItem[], resumeMs?: number) => void;
  minimizePlayer: () => void;
  expandPlayer: () => void;
  closePlayer: () => void;
  setPlaybackStatus: (status: { isPlaying?: boolean; positionMs?: number; durationMs?: number; isBuffering?: boolean }) => void;
  toggleHud: (force?: boolean) => void;
  toggleLock: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolumeBoost: (vol: number) => void;
  toggleMute: () => void;
  setBrightness: (val: number) => void;
  cycleDecoderMode: () => void;
  cycleAspectRatio: () => void;
  setZoomScale: (scale: number) => void;
  setABPointA: (ms: number) => void;
  setABPointB: (ms: number) => void;
  clearABRepeat: () => void;
  addSubtitleTrack: (track: SubtitleTrack) => void;
  selectSubtitleTrack: (id: string | null) => void;
  adjustSubtitleOffset: (deltaMs: number) => void;
  setSubtitleFontSize: (size: number) => void;
  adjustAudioOffset: (deltaMs: number) => void;
  setEqPreset: (presetId: string, bands: number[]) => void;
  setEqBandGain: (index: number, gainDb: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  tickSleepTimer: () => boolean;
  toggleBackgroundAudio: () => void;
  playNextInQueue: () => VideoItem | null;
  playPrevInQueue: () => VideoItem | null;
}

const ASPECT_ORDER: AspectRatioMode[] = ['FIT', 'FILL', 'STRETCH', '16:9', '4:3'];
const DECODER_ORDER: DecoderMode[] = ['HW+', 'HW', 'SW'];
const DEFAULT_REPEAT: ABRepeatState = { enabled: false, pointAMs: null, pointBMs: null };

export const usePlayerStore = create<PlayerState>((set, get) => ({
  activeVideo: null,
  playlist: [],
  isMinimized: false,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  isBuffering: false,
  isHudVisible: true,
  isLocked: false,
  playbackSpeed: 1,
  volumeBoost: 1,
  isMuted: false,
  brightness: 0.75,
  decoderMode: 'HW+',
  aspectRatio: 'FIT',
  zoomScale: 1,
  abRepeat: DEFAULT_REPEAT,
  subtitleTracks: [],
  activeSubtitleId: null,
  subtitleOffsetMs: 0,
  subtitleFontSize: 20,
  audioOffsetMs: 0,
  activeEqPresetId: 'flat',
  eqBands: [0, 0, 0, 0, 0],
  sleepTimerRemainingSec: null,
  isBackgroundAudioEnabled: false,

  openVideo: (video, queue = [video], resumeMs = 0) => {
    const playlist = queue.some((entry) => entry.id === video.id) ? queue : [video, ...queue];
    set({
      activeVideo: video,
      playlist,
      isMinimized: false,
      isPlaying: true,
      positionMs: Math.max(0, resumeMs),
      durationMs: Math.max(0, video.duration),
      isBuffering: true,
      isHudVisible: true,
      isLocked: false,
      zoomScale: 1,
      abRepeat: { ...DEFAULT_REPEAT },
      subtitleTracks: [],
      activeSubtitleId: null,
      subtitleOffsetMs: 0,
      audioOffsetMs: 0,
    });
  },

  minimizePlayer: () => set({ isMinimized: true, isLocked: false }),
  expandPlayer: () => set({ isMinimized: false, isHudVisible: true }),
  closePlayer: () => set({
    activeVideo: null,
    playlist: [],
    isMinimized: false,
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    isBuffering: false,
    isLocked: false,
    abRepeat: { ...DEFAULT_REPEAT },
    subtitleTracks: [],
    activeSubtitleId: null,
  }),

  setPlaybackStatus: (status) => set((state) => ({
    isPlaying: status.isPlaying ?? state.isPlaying,
    positionMs: status.positionMs ?? state.positionMs,
    durationMs: status.durationMs ?? state.durationMs,
    isBuffering: status.isBuffering ?? state.isBuffering,
  })),
  toggleHud: (force) => set((state) => ({ isHudVisible: typeof force === 'boolean' ? force : !state.isHudVisible })),
  toggleLock: () => set((state) => ({ isLocked: !state.isLocked, isHudVisible: true })),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: Math.max(0.5, Math.min(3, Number(speed.toFixed(2)))) }),
  setVolumeBoost: (vol) => set({ volumeBoost: Math.max(0, Math.min(1, Number(vol.toFixed(2)))), isMuted: vol <= 0.001 }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setBrightness: (value) => set({ brightness: Math.max(0.02, Math.min(1, Number(value.toFixed(2)))) }),

  // Retained in state for compatibility; decoder controls are deliberately not exposed as functional features.
  cycleDecoderMode: () => set((state) => {
    const index = DECODER_ORDER.indexOf(state.decoderMode);
    return { decoderMode: DECODER_ORDER[(index + 1) % DECODER_ORDER.length] };
  }),
  cycleAspectRatio: () => set((state) => {
    const index = ASPECT_ORDER.indexOf(state.aspectRatio);
    return { aspectRatio: ASPECT_ORDER[(index + 1) % ASPECT_ORDER.length], zoomScale: 1 };
  }),
  setZoomScale: (scale) => set({ zoomScale: Math.max(0.5, Math.min(2.5, Number(scale.toFixed(2)))) }),

  setABPointA: (ms) => set({ abRepeat: { enabled: false, pointAMs: Math.max(0, ms), pointBMs: null } }),
  setABPointB: (ms) => set((state) => {
    const a = state.abRepeat.pointAMs;
    if (a === null || ms <= a + 500 || (state.durationMs > 0 && ms > state.durationMs)) return state;
    return { abRepeat: { enabled: true, pointAMs: a, pointBMs: ms } };
  }),
  clearABRepeat: () => set({ abRepeat: { ...DEFAULT_REPEAT } }),

  addSubtitleTrack: (track) => set((state) => ({
    subtitleTracks: [...state.subtitleTracks.filter((entry) => entry.id !== track.id && entry.name !== track.name), track],
    activeSubtitleId: track.id,
  })),
  selectSubtitleTrack: (id) => set({ activeSubtitleId: id }),
  adjustSubtitleOffset: (deltaMs) => set((state) => ({
    subtitleOffsetMs: Math.max(-120000, Math.min(120000, state.subtitleOffsetMs + deltaMs)),
  })),
  setSubtitleFontSize: (size) => set({ subtitleFontSize: Math.max(12, Math.min(36, size)) }),
  adjustAudioOffset: (deltaMs) => set((state) => ({
    audioOffsetMs: Math.max(-120000, Math.min(120000, state.audioOffsetMs + deltaMs)),
  })),
  setEqPreset: (presetId, bands) => set({ activeEqPresetId: presetId, eqBands: [...bands] }),
  setEqBandGain: (index, gainDb) => set((state) => {
    if (index < 0 || index >= state.eqBands.length) return state;
    const updated = [...state.eqBands];
    updated[index] = Math.max(-12, Math.min(12, gainDb));
    return { activeEqPresetId: 'custom', eqBands: updated };
  }),
  setSleepTimer: (minutes) => set({ sleepTimerRemainingSec: minutes === null ? null : Math.max(1, minutes) * 60 }),
  tickSleepTimer: () => {
    const remaining = get().sleepTimerRemainingSec;
    if (remaining === null) return false;
    if (remaining <= 1) {
      set({ sleepTimerRemainingSec: null, isPlaying: false });
      return true;
    }
    set({ sleepTimerRemainingSec: remaining - 1 });
    return false;
  },
  toggleBackgroundAudio: () => set((state) => ({ isBackgroundAudioEnabled: !state.isBackgroundAudioEnabled })),
  playNextInQueue: () => {
    const { activeVideo, playlist } = get();
    if (!activeVideo) return null;
    const index = playlist.findIndex((item) => item.id === activeVideo.id);
    if (index < 0 || index + 1 >= playlist.length) return null;
    const next = playlist[index + 1];
    get().openVideo(next, playlist, 0);
    return next;
  },
  playPrevInQueue: () => {
    const { activeVideo, playlist } = get();
    if (!activeVideo) return null;
    const index = playlist.findIndex((item) => item.id === activeVideo.id);
    if (index <= 0) return null;
    const previous = playlist[index - 1];
    get().openVideo(previous, playlist, 0);
    return previous;
  },
}));
