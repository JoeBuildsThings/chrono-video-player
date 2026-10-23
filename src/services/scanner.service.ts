import * as MediaLibrary from 'expo-media-library/legacy';
import { PermissionStatusType, VideoFolder, VideoItem } from '../core/types';

function extractFolderName(uri: string, fallbackAlbumTitle?: string): string {
  if (fallbackAlbumTitle?.trim()) return fallbackAlbumTitle;
  try {
    const parts = decodeURIComponent(uri).split('/').filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2];
  } catch {
    // Some Android content URIs are not valid URI-encoded file paths.
  }
  return 'Internal Videos';
}

function cleanVideoTitle(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[._]/g, ' ').trim();
}

function toPermissionStatus(permission: { granted: boolean; status: string; canAskAgain: boolean }): PermissionStatusType {
  if (permission.granted) return 'granted';
  if (permission.status === 'undetermined') return 'undetermined';
  return permission.canAskAgain ? 'denied' : 'blocked';
}

export const ScannerService = {
  async checkPermissionStatus(): Promise<PermissionStatusType> {
    try {
      const permission = await MediaLibrary.getPermissionsAsync(false, ['video']);
      return toPermissionStatus(permission);
    } catch {
      return 'denied';
    }
  },

  async requestPermission(): Promise<PermissionStatusType> {
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['video']);
      return toPermissionStatus(permission);
    } catch {
      return 'denied';
    }
  },

  async scanAllVideos(): Promise<{ folders: VideoFolder[]; allVideos: VideoItem[] }> {
    const folderMap = new Map<string, VideoFolder>();
    const allVideos: VideoItem[] = [];
    const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    const albumNames = new Map(albums.map((album) => [album.id, album.title]));

    let after: string | undefined;
    let hasNextPage = true;
    let pages = 0;

    while (hasNextPage && pages < 100) {
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: ['video'],
        first: 200,
        ...(after ? { after } : {}),
        sortBy: [['modificationTime', false]],
      });

      for (const asset of page.assets) {
        const folderName = extractFolderName(asset.uri, asset.albumId ? albumNames.get(asset.albumId) : undefined);
        const folderId = asset.albumId || ('folder_' + folderName.toLowerCase());
        const item: VideoItem = {
          id: asset.id,
          filename: asset.filename,
          title: cleanVideoTitle(asset.filename),
          uri: asset.uri,
          duration: Math.max(0, Math.round((asset.duration || 0) * 1000)),
          width: asset.width || 0,
          height: asset.height || 0,
          creationTime: asset.creationTime || 0,
          modificationTime: asset.modificationTime || 0,
          albumId: folderId,
          folderName,
        };
        allVideos.push(item);

        const folder = folderMap.get(folderId);
        if (folder) {
          folder.videos.push(item);
          folder.videoCount += 1;
          folder.totalDuration += item.duration;
          folder.lastModified = Math.max(folder.lastModified, item.modificationTime);
        } else {
          folderMap.set(folderId, {
            id: folderId,
            name: folderName,
            videoCount: 1,
            totalDuration: item.duration,
            videos: [item],
            lastModified: item.modificationTime,
          });
        }
      }

      hasNextPage = page.hasNextPage;
      after = page.endCursor;
      pages += 1;
    }

    return {
      folders: Array.from(folderMap.values()).sort((a, b) => b.lastModified - a.lastModified),
      allVideos,
    };
  },
};
