export type PermissionStatusType = 'undetermined' | 'granted' | 'denied' | 'blocked';

export type DecoderMode = 'HW+' | 'HW' | 'SW';

export type AspectRatioMode = 'FIT' | 'FILL' | 'STRETCH' | '16:9' | '4:3';

export type SortField = 'title' | 'date' | 'duration' | 'size';
export type SortOrder = 'asc' | 'desc';

export interface VideoItem {
  id: string;
  filename: string;
  title: string;
  uri: string;
  duration: number;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  albumId: string;
  folderName: string;
  isNetworkStream?: boolean;
}

export interface VideoFolder {
  id: string;
  name: string;
  videoCount: number;
  totalDuration: number;
  videos: VideoItem[];
  lastModified: number;
}

export interface SubtitleCue {
  id: number;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

export interface SubtitleTrack {
  id: string;
  name: string;
  uri: string;
  format: 'srt' | 'vtt';
  cues: SubtitleCue[];
}

export interface PlaybackHistoryRecord {
  videoId: string;
  uri: string;
  title: string;
  lastPositionMs: number;
  durationMs: number;
  updatedAt: number;
  playbackSpeed: number;
  subtitleOffsetMs: number;
  audioOffsetMs: number;
}

export interface ABRepeatState {
  enabled: boolean;
  pointAMs: number | null;
  pointBMs: number | null;
}

export interface EqualizerBand {
  frequency: string;
  gainDb: number;
}

export interface EqualizerPreset {
  id: string;
  name: string;
  bands: number[];
}
