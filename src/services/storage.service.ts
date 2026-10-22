import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlaybackHistoryRecord } from '../core/types';

const HISTORY_KEY = '@chrono_playback_history_v1';
const STREAM_RECENT_KEY = '@chrono_recent_streams_v1';

export const StorageService = {
  async getHistoryMap(): Promise<Record<string, PlaybackHistoryRecord>> {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, PlaybackHistoryRecord>;
    } catch {
      return {};
    }
  },

  async saveProgress(record: PlaybackHistoryRecord): Promise<void> {
    try {
      const current = await this.getHistoryMap();
      current[record.videoId] = {
        ...record,
        updatedAt: Date.now(),
      };
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(current));
    } catch {
      return;
    }
  },

  async clearAllHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch {
      return;
    }
  },

  async getRecentStreams(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(STREAM_RECENT_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  },

  async addRecentStream(url: string): Promise<string[]> {
    try {
      const current = await this.getRecentStreams();
      const filtered = [url, ...current.filter((item) => item !== url)].slice(0, 10);
      await AsyncStorage.setItem(STREAM_RECENT_KEY, JSON.stringify(filtered));
      return filtered;
    } catch {
      return [];
    }
  },
};
