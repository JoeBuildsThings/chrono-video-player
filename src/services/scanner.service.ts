import * as MediaLibrary from 'expo-media-library';
import { PermissionStatusType, VideoFolder, VideoItem } from '../core/types';

function extractFolderName(uri: string, fallbackAlbumTitle?: string): string {
  if (fallbackAlbumTitle && fallbackAlbumTitle.trim().length > 0) {
    return fallbackAlbumTitle;
  }
  try {
    const decoded = decodeURIComponent(uri);
    const segments = decoded.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return segments[segments.length - 2];
    }
  } catch {
    // Fallback
  }
  return 'Internal Videos';
}

function cleanVideoTitle(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[._]/g, ' ');
}

export const ScannerService = {
  async checkPermissionStatus(): Promise<PermissionStatusType> {
    try {
      const perm = await MediaLibrary.getPermissionsAsync();
      if (perm.granted) return 'granted';
      if (perm.status === 'undetermined') return 'undetermined';
      if (!perm.canAskAgain) return 'blocked';
      return 'denied';
    } catch {
      return 'denied';
    }
  },

  async requestPermission(): Promise<PermissionStatusType> {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.granted) return 'granted';
      if (!perm.canAskAgain) return 'blocked';
      return 'denied';
    } catch {
      return 'denied';
    }
  },

  async scanAllVideos(): Promise<{ folders: VideoFolder[]; allVideos: VideoItem[] }> {
    const folderMap = new Map<string, VideoFolder>();
    const allVideos: VideoItem[] = [];

    const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    const albumNameLookup = new Map<string, string>();
    for (const alb of albums) {
      albumNameLookup.set(alb.id, alb.title);
    }

    let hasNextPage = true;
    let endCursor: string | undefined = undefined;
    let safetyPages = 0;

    while (hasNextPage && safetyPages < 15) {
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: ['video'],
        first: 200,
        after: endCursor,
        sortBy: [['modificationTime', false]],
      });

      for (const asset of page.assets) {
        const albumTitle = asset.albumId ? albumNameLookup.get(asset.albumId) : undefined;
        const folderName = extractFolderName(asset.uri, albumTitle);
        const folderId = asset.albumId || `folder_${folderName.toLowerCase()}`;

        const videoItem: VideoItem = {
          id: asset.id,
          filename: asset.filename,
          title: cleanVideoTitle(asset.filename),
          uri: asset.uri,
          duration: Math.round((asset.duration || 0) * 1000),
          width: asset.width || 1920,
          height: asset.height || 1080,
          creationTime: asset.creationTime || Date.now(),
          modificationTime: asset.modificationTime || Date.now(),
          albumId: folderId,
          folderName,
        };

        allVideos.push(videoItem);

        const existingFolder = folderMap.get(folderId);
        if (existingFolder) {
          existingFolder.videos.push(videoItem);
          existingFolder.videoCount += 1;
          existingFolder.totalDuration += videoItem.duration;
          if (videoItem.modificationTime > existingFolder.lastModified) {
            existingFolder.lastModified = videoItem.modificationTime;
          }
        } else {
          folderMap.set(folderId, {
            id: folderId,
            name: folderName,
            videoCount: 1,
            totalDuration: videoItem.duration,
            videos: [videoItem],
            lastModified: videoItem.modificationTime,
          });
        }
      }

      hasNextPage = page.hasNextPage;
      endCursor = page.endCursor;
      safetyPages += 1;
    }

    const folders = Array.from(folderMap.values()).sort(
      (a, b) => b.lastModified - a.lastModified
    );

    return { folders, allVideos };
  },
};
