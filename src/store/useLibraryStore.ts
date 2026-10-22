import { create } from 'zustand';
import {
  PermissionStatusType,
  PlaybackHistoryRecord,
  SortField,
  SortOrder,
  VideoFolder,
  VideoItem,
} from '../core/types';
import { ScannerService } from '../services/scanner.service';
import { StorageService } from '../services/storage.service';
import { normalizeError } from '../core/errors/safeError';

interface LibraryState {
  permissionStatus: PermissionStatusType;
  isLoading: boolean;
  error: string | null;
  folders: VideoFolder[];
  allVideos: VideoItem[];
  selectedFolderId: string | null;
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
  viewMode: 'folders' | 'all' | 'streams';
  historyMap: Record<string, PlaybackHistoryRecord>;
  recentStreams: string[];

  initializeLibrary: () => Promise<void>;
  requestMediaPermission: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  selectFolder: (folderId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSorting: (field: SortField, order: SortOrder) => void;
  setViewMode: (mode: 'folders' | 'all' | 'streams') => void;
  recordPlaybackProgress: (record: PlaybackHistoryRecord) => Promise<void>;
  addStreamToHistory: (url: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  permissionStatus: 'undetermined',
  isLoading: false,
  error: null,
  folders: [],
  allVideos: [],
  selectedFolderId: null,
  searchQuery: '',
  sortField: 'date',
  sortOrder: 'desc',
  viewMode: 'folders',
  historyMap: {},
  recentStreams: [],

  initializeLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      const [status, historyMap, recentStreams] = await Promise.all([
        ScannerService.checkPermissionStatus(),
        StorageService.getHistoryMap(),
        StorageService.getRecentStreams(),
      ]);

      set({ permissionStatus: status, historyMap, recentStreams });

      if (status === 'granted') {
        const { folders, allVideos } = await ScannerService.scanAllVideos();
        set({ folders, allVideos, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({
        isLoading: false,
        error: normalizeError(err, 'Failed to initialize media library.'),
      });
    }
  },

  requestMediaPermission: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await ScannerService.requestPermission();
      set({ permissionStatus: status });

      if (status === 'granted') {
        const { folders, allVideos } = await ScannerService.scanAllVideos();
        set({ folders, allVideos, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({
        isLoading: false,
        error: normalizeError(err, 'Permission request failed.'),
      });
    }
  },

  refreshLibrary: async () => {
    const { permissionStatus } = get();
    if (permissionStatus !== 'granted') return;

    set({ isLoading: true, error: null });
    try {
      const [scanResult, historyMap] = await Promise.all([
        ScannerService.scanAllVideos(),
        StorageService.getHistoryMap(),
      ]);
      set({
        folders: scanResult.folders,
        allVideos: scanResult.allVideos,
        historyMap,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: normalizeError(err, 'Unable to refresh video folders.'),
      });
    }
  },

  selectFolder: (folderId) => set({ selectedFolderId: folderId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSorting: (sortField, sortOrder) => set({ sortField, sortOrder }),
  setViewMode: (viewMode) => set({ viewMode, selectedFolderId: null }),

  recordPlaybackProgress: async (record) => {
    await StorageService.saveProgress(record);
    const updated = await StorageService.getHistoryMap();
    set({ historyMap: updated });
  },

  addStreamToHistory: async (url) => {
    const updated = await StorageService.addRecentStream(url);
    set({ recentStreams: updated });
  },
}));
