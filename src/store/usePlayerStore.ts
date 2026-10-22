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
  setPlaybackStatus: (status: {
    isPlaying?: boolean;
    positionMs?: number;
    durationMs?: number;
    isBuffering?: boolean;
  }) => void;
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

export const usePlayerStore = create<PlayerState>((set, get) => ({
  activeVideo: null,
  playlist: [],
  isMinimized: false,
  isPlaying: true,
  positionMs: 0,
  durationMs: 0,
  isBuffering: false,
  isHudVisible: true,
  isLocked: false,
  playbackSpeed: 1.0,
  volumeBoost: 1.0,
  isMuted: false,
  brightness: 0.75,
  decoderMode: 'HW+',
  aspectRatio: 'FIT',
  zoomScale: 1.0,
  abRepeat: { enabled: false, pointAMs: null, pointBMs: null },
  subtitleTracks: [],
  activeSubtitleId: null,
  subtitleOffsetMs: 0,
  subtitleFontSize: 18,
  audioOffsetMs: 0,
  activeEqPresetId: 'flat',
  eqBands: [0, 0, 0, 0, 0],
  sleepTimerRemainingSec: null,
  isBackgroundAudioEnabled: false,

  openVideo: (video, queue = [video], resumeMs = 0) =>
    set({
      activeVideo: video,
      playlist: queue.length ? queue : [video],
      isMinimized: false,
      isPlaying: true,
      positionMs: resumeMs,
      durationMs: video.duration || 0,
      isBuffering: true,
      isHudVisible: true,
      isLocked: false,
      zoomScale: 1.0,
      abRepeat: { enabled: false, pointAMs: null, pointBMs: null },
    }),

  minimizePlayer: () => set({ isMinimized: true, isLocked: false }),

  expandPlayer: () => set({ isMinimized: false, isHudVisible: true }),

  closePlayer: () =>
    set({
      activeVideo: null,
      isMinimized: false,
      isPlaying: false,
      isLocked: false,
      abRepeat: { enabled: false, pointAMs: null, pointBMs: null },
    }),

  setPlaybackStatus: (status) =>
    set((state) => ({
      isPlaying: status.isPlaying ?? state.isPlaying,
      positionMs: status.positionMs ?? state.positionMs,
      durationMs: status.durationMs ?? state.durationMs,
      isBuffering: status.isBuffering ?? state.isBuffering,
    })),

  toggleHud: (force) =>
    set((state) => ({
      isHudVisible: typeof force === 'boolean' ? force : !state.isHudVisible,
    })),

  toggleLock: () =>
    set((state) => ({
      isLocked: !state.isLocked,
      isHudVisible: true,
    })),

  setPlaybackSpeed: (speed) =>
    set({ playbackSpeed: Math.max(0.25, Math.min(4.0, Number(speed.toFixed(2)))) }),

  setVolumeBoost: (vol) =>
    set({
      volumeBoost: Math.max(0, Math.min(2.0, Number(vol.toFixed(2)))),
      isMuted: vol <= 0.01,
    }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  setBrightness: (val) =>
    set({ brightness: Math.max(0.02, Math.min(1.0, Number(val.toFixed(2)))) }),

  cycleDecoderMode: () =>
    set((state) => {
      const idx = DECODER_ORDER.indexOf(state.decoderMode);
      const next = DECODER_ORDER[(idx + 1) % DECODER_ORDER.length];
      return { decoderMode: next };
    }),

  cycleAspectRatio: () =>
    set((state) => {
      const idx = ASPECT_ORDER.indexOf(state.aspectRatio);
      const next = ASPECT_ORDER[(idx + 1) % ASPECT_ORDER.length];
      return { aspectRatio: next, zoomScale: 1.0 };
    }),

  setZoomScale: (scale) =>
    set({ zoomScale: Math.max(0.5, Math.min(2.5, Number(scale.toFixed(2)))) }),

  setABPointA: (ms) =>
    set({
      abRepeat: { enabled: false, pointAMs: ms, pointBMs: null },
    }),

  setABPointB: (ms) =>
    set((state) => {
      if (state.abRepeat.pointAMs === null || ms <= state.abRepeat.pointAMs + 500) {
        return state;
      }
      return {
        abRepeat: {
          enabled: true,
          pointAMs: state.abRepeat.pointAMs,
          pointBMs: ms,
        },
      };
    }),

  clearABRepeat: () =>
    set({ abRepeat: { enabled: false, pointAMs: null, pointBMs: null } }),

  addSubtitleTrack: (track) =>
    set((state) => ({
      subtitleTracks: [...state.subtitleTracks.filter((t) => t.name !== track.name), track],
      activeSubtitleId: track.id,
    })),

  selectSubtitleTrack: (id) => set({ activeSubtitleId: id }),

  adjustSubtitleOffset: (deltaMs) =>
    set((state) => ({ subtitleOffsetMs: state.subtitleOffsetMs + deltaMs })),

  setSubtitleFontSize: (size) =>
    set({ subtitleFontSize: Math.max(12, Math.min(34, size)) }),

  adjustAudioOffset: (deltaMs) =>
    set((state) => ({ audioOffsetMs: state.audioOffsetMs + deltaMs })),

  setEqPreset: (presetId, bands) =>
    set({ activeEqPresetId: presetId, eqBands: [...bands] }),

  setEqBandGain: (index, gainDb) =>
    set((state) => {
      const updated = [...state.eqBands];
      updated[index] = Math.max(-12, Math.min(12, gainDb));
      return { activeEqPresetId: 'custom', eqBands: updated };
    }),

  setSleepTimer: (minutes) =>
    set({ sleepTimerRemainingSec: minutes ? minutes * 60 : null }),

  tickSleepTimer: () => {
    const { sleepTimerRemainingSec } = get();
    if (sleepTimerRemainingSec === null) return false;
    if (sleepTimerRemainingSec <= 1) {
      set({ sleepTimerRemainingSec: null, isPlaying: false });
      return true;
    }
    set({ sleepTimerRemainingSec: sleepTimerRemainingSec - 1 });
    return false;
  },

  toggleBackgroundAudio: () =>
    set((state) => ({ isBackgroundAudioEnabled: !state.isBackgroundAudioEnabled })),

  playNextInQueue: () => {
    const { activeVideo, playlist } = get();
    if (!activeVideo || playlist.length <= 1) return null;
    const idx = playlist.findIndex((v) => v.id === activeVideo.id);
    if (idx === -1 || idx + 1 >= playlist.length) return null;
    const nextVideo = playlist[idx + 1];
    get().openVideo(nextVideo, playlist, 0);
    return nextVideo;
  },

  playPrevInQueue: () => {
    const { activeVideo, playlist } = get();
    if (!activeVideo || playlist.length <= 1) return null;
    const idx = playlist.findIndex((v) => v.id === activeVideo.id);
    if (idx <= 0) return null;
    const prevVideo = playlist[idx - 1];
    get().openVideo(prevVideo, playlist, 0);
    return prevVideo;
  },
}));
