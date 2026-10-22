import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { StorageService } from '../../services/storage.service';
import { GlassPanel } from '../common/GlassPanel';
import { PermissionGate } from './PermissionGate';
import { THEME } from '../../core/constants/theme';
import { formatDurationMs } from '../../engine/gesture.math';
import { SortField, VideoFolder, VideoItem } from '../../core/types';
import { validateStreamUrl } from '../../core/errors/safeError';

const SAMPLE_STREAMS = [
  {
    title: 'Big Buck Bunny (1080p MP4 Test)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    title: 'Tears of Steel (Sci-Fi Open Movie)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
];

const GITHUB_PROFILE_URL = 'https://github.com/JoeBuildsThings';
const GITHUB_REPO_URL = 'https://github.com/JoeBuildsThings/chrono-video-player';

export const LibraryScreen: React.FC = () => {
  const {
    permissionStatus,
    isLoading,
    folders,
    allVideos,
    selectedFolderId,
    searchQuery,
    sortField,
    sortOrder,
    viewMode,
    historyMap,
    recentStreams,
    requestMediaPermission,
    refreshLibrary,
    selectFolder,
    setSearchQuery,
    setSorting,
    setViewMode,
    addStreamToHistory,
  } = useLibraryStore();

  const openVideo = usePlayerStore((s) => s.openVideo);
  const isBackgroundAudioEnabled = usePlayerStore((s) => s.isBackgroundAudioEnabled);
  const toggleBackgroundAudio = usePlayerStore((s) => s.toggleBackgroundAudio);
  const decoderMode = usePlayerStore((s) => s.decoderMode);
  const cycleDecoderMode = usePlayerStore((s) => s.cycleDecoderMode);

  const [streamInput, setStreamInput] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) || null,
    [folders, selectedFolderId]
  );

  const displayedVideos = useMemo(() => {
    const source = activeFolder ? activeFolder.videos : allVideos;
    const query = searchQuery.trim().toLowerCase();

    const filtered = query
      ? source.filter(
          (v) =>
            v.title.toLowerCase().includes(query) ||
            v.folderName.toLowerCase().includes(query)
        )
      : [...source];

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortField === 'duration') {
        comparison = a.duration - b.duration;
      } else {
        comparison = a.modificationTime - b.modificationTime;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [activeFolder, allVideos, searchQuery, sortField, sortOrder]);

  const handleOpenVideo = (video: VideoItem, queue: VideoItem[]) => {
    const saved = historyMap[video.id];
    const resumeMs =
      saved && saved.lastPositionMs < saved.durationMs - 5000 ? saved.lastPositionMs : 0;
    openVideo(video, queue, resumeMs);
  };

  const handlePickSingleFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const customItem: VideoItem = {
        id: `ext_${file.uri}`,
        filename: file.name,
        title: file.name.replace(/\.[^/.]+$/, ''),
        uri: file.uri,
        duration: 0,
        width: 1920,
        height: 1080,
        creationTime: Date.now(),
        modificationTime: Date.now(),
        albumId: 'external',
        folderName: 'External Picker',
      };
      handleOpenVideo(customItem, [customItem]);
    } catch {
      return;
    }
  };

  const handleLaunchStream = async (rawUrl: string, customTitle?: string) => {
    setStreamError(null);
    const check = validateStreamUrl(rawUrl);
    if (!check.ok || !check.data) {
      setStreamError(check.error || 'Invalid stream URL');
      return;
    }
    const cleanUrl = check.data;
    await addStreamToHistory(cleanUrl);
    const streamVideo: VideoItem = {
      id: `net_${cleanUrl}`,
      filename: cleanUrl.split('/').pop() || 'Network Stream',
      title: customTitle || cleanUrl.split('/').pop() || 'VLC Network Stream',
      uri: cleanUrl,
      duration: 0,
      width: 1920,
      height: 1080,
      creationTime: Date.now(),
      modificationTime: Date.now(),
      albumId: 'network',
      folderName: 'Network Stream',
      isNetworkStream: true,
    };
    handleOpenVideo(streamVideo, [streamVideo]);
  };

  const cycleSortField = () => {
    const order: SortField[] = ['date', 'title', 'duration'];
    const nextField = order[(order.indexOf(sortField) + 1) % order.length];
    setSorting(nextField, sortOrder);
  };

  const toggleSortOrder = () => {
    setSorting(sortField, sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const handleClearWatchHistory = async () => {
    await StorageService.clearAllHistory();
    await refreshLibrary();
    setIsSettingsOpen(false);
  };

  const renderLastPlayedBanner = () => {
    const records = Object.values(historyMap).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!records.length) return null;
    const latest = records[0];
    const targetVideo = allVideos.find((v) => v.id === latest.videoId);
    if (!targetVideo) return null;

    const progressPct =
      latest.durationMs > 0
        ? Math.min(100, Math.round((latest.lastPositionMs / latest.durationMs) * 100))
        : 0;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleOpenVideo(targetVideo, allVideos)}
        style={styles.resumeBannerWrapper}
      >
        <GlassPanel style={styles.resumeBanner} activeBorder>
          <View style={styles.resumeRow}>
            <View style={styles.resumePlayBadge}>
              <Ionicons name="play" size={18} color={THEME.colors.textPrimary} />
            </View>
            <View style={styles.resumeInfo}>
              <Text style={styles.resumeTag}>CONTINUE WATCHING • {progressPct}%</Text>
              <Text style={styles.resumeTitle} numberOfLines={1}>
                {targetVideo.title}
              </Text>
              <Text style={styles.resumeTime}>
                {formatDurationMs(latest.lastPositionMs)} / {formatDurationMs(latest.durationMs)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={THEME.colors.accentCyan} />
          </View>
        </GlassPanel>
      </TouchableOpacity>
    );
  };

  const renderFolderCard = ({ item }: { item: VideoFolder }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => selectFolder(item.id)}
      style={styles.cardTouch}
    >
      <GlassPanel style={styles.folderCard}>
        <View style={styles.folderIconBox}>
          <Ionicons name="folder" size={28} color={THEME.colors.accentElectric} />
          <View style={styles.folderCountBadge}>
            <Text style={styles.folderCountText}>{item.videoCount}</Text>
          </View>
        </View>
        <View style={styles.folderMeta}>
          <Text style={styles.folderTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.folderSub}>
            {item.videoCount} {item.videoCount === 1 ? 'video' : 'videos'} • Total{' '}
            {formatDurationMs(item.totalDuration)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
      </GlassPanel>
    </TouchableOpacity>
  );

  const renderVideoCard = ({ item }: { item: VideoItem }) => {
    const history = historyMap[item.id];
    const progress =
      history && item.duration > 0
        ? Math.min(1, Math.max(0, history.lastPositionMs / item.duration))
        : 0;
    const isNew = !history && Date.now() - item.creationTime < 7 * 86400 * 1000;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleOpenVideo(item, displayedVideos)}
        style={styles.cardTouch}
      >
        <GlassPanel style={styles.videoCard}>
          <View style={styles.videoThumbBox}>
            <Ionicons name="film-outline" size={24} color={THEME.colors.accentCyan} />
            <Text style={styles.durationChip}>{formatDurationMs(item.duration)}</Text>
            {progress > 0.02 && (
              <View style={styles.thumbProgressTrack}>
                <View style={[styles.thumbProgressFill, { width: `${progress * 100}%` }]} />
              </View>
            )}
          </View>

          <View style={styles.videoMeta}>
            <View style={styles.videoTitleRow}>
              {isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
              <Text style={styles.videoTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>

            <View style={styles.videoSpecsRow}>
              <Text style={styles.specBadge}>
                {item.height >= 1080 ? 'FHD 1080p' : item.height >= 720 ? 'HD 720p' : 'SD'}
              </Text>
              <Text style={styles.specFolder} numberOfLines={1}>
                {item.folderName}
              </Text>
              {history && (
                <Text style={styles.specResume}>
                  • {formatDurationMs(history.lastPositionMs)}
                </Text>
              )}
            </View>
          </View>

          <Ionicons name="play-circle-outline" size={26} color={THEME.colors.accentElectric} />
        </GlassPanel>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.logoOrb}>
            <Ionicons name="play" size={18} color={THEME.colors.accentCyan} />
          </View>
          <View>
            <Text style={styles.brandName}>CHRONO PLAYER</Text>
            <Text style={styles.brandTag}>MX GESTURES • VLC CORE</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handlePickSingleFile}
            activeOpacity={0.75}
          >
            <Ionicons name="document-outline" size={20} color={THEME.colors.accentCyan} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={refreshLibrary}
            activeOpacity={0.75}
          >
            <Ionicons name="refresh-outline" size={20} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setIsSettingsOpen(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="settings-outline" size={20} color={THEME.colors.accentCyan} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, viewMode === 'folders' && styles.tabButtonActive]}
          onPress={() => setViewMode('folders')}
        >
          <Ionicons
            name="folder-open-outline"
            size={16}
            color={viewMode === 'folders' ? THEME.colors.accentCyan : THEME.colors.textSecondary}
          />
          <Text style={[styles.tabText, viewMode === 'folders' && styles.tabTextActive]}>
            Folders ({folders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, viewMode === 'all' && styles.tabButtonActive]}
          onPress={() => setViewMode('all')}
        >
          <Ionicons
            name="grid-outline"
            size={16}
            color={viewMode === 'all' ? THEME.colors.accentCyan : THEME.colors.textSecondary}
          />
          <Text style={[styles.tabText, viewMode === 'all' && styles.tabTextActive]}>
            All Videos ({allVideos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, viewMode === 'streams' && styles.tabButtonActive]}
          onPress={() => setViewMode('streams')}
        >
          <Ionicons
            name="globe-outline"
            size={16}
            color={viewMode === 'streams' ? THEME.colors.accentCyan : THEME.colors.textSecondary}
          />
          <Text style={[styles.tabText, viewMode === 'streams' && styles.tabTextActive]}>
            VLC Stream
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'streams' ? (
        <View style={styles.streamContainer}>
          <GlassPanel style={styles.streamPanel} heavy>
            <Text style={styles.streamHeader}>Open Network Stream</Text>
            <Text style={styles.streamSub}>
              Enter direct HTTP, HTTPS, HLS (.m3u8), or RTSP media stream URL.
            </Text>

            <View style={styles.streamInputRow}>
              <Ionicons name="link-outline" size={18} color={THEME.colors.accentCyan} />
              <TextInput
                style={styles.streamInput}
                placeholder="https://example.com/stream.m3u8"
                placeholderTextColor={THEME.colors.textMuted}
                value={streamInput}
                onChangeText={setStreamInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {streamInput.length > 0 && (
                <TouchableOpacity onPress={() => setStreamInput('')}>
                  <Ionicons name="close-circle" size={18} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {streamError && <Text style={styles.errorText}>{streamError}</Text>}

            <TouchableOpacity
              style={styles.streamPlayBtn}
              activeOpacity={0.85}
              onPress={() => handleLaunchStream(streamInput)}
            >
              <Ionicons name="play" size={18} color={THEME.colors.textPrimary} />
              <Text style={styles.streamPlayBtnText}>Launch Stream</Text>
            </TouchableOpacity>
          </GlassPanel>

          <Text style={styles.sectionLabel}>QUICK TEST STREAMS</Text>
          {SAMPLE_STREAMS.map((sample) => (
            <TouchableOpacity
              key={sample.url}
              style={styles.cardTouch}
              onPress={() => handleLaunchStream(sample.url, sample.title)}
            >
              <GlassPanel style={styles.sampleCard}>
                <Ionicons name="radio-outline" size={20} color={THEME.colors.accentElectric} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sampleTitle}>{sample.title}</Text>
                  <Text style={styles.sampleUrl} numberOfLines={1}>
                    {sample.url}
                  </Text>
                </View>
                <Ionicons name="play-circle" size={24} color={THEME.colors.accentCyan} />
              </GlassPanel>
            </TouchableOpacity>
          ))}

          {recentStreams.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>RECENT STREAM HISTORY</Text>
              <FlatList
                data={recentStreams}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.cardTouch}
                    onPress={() => handleLaunchStream(item)}
                  >
                    <GlassPanel style={styles.sampleCard}>
                      <Ionicons name="time-outline" size={18} color={THEME.colors.textSecondary} />
                      <Text style={styles.sampleUrl} numberOfLines={1}>
                        {item}
                      </Text>
                    </GlassPanel>
                  </TouchableOpacity>
                )}
              />
            </>
          )}
        </View>
      ) : permissionStatus !== 'granted' ? (
        <PermissionGate
          status={permissionStatus}
          onRequestPermission={requestMediaPermission}
          onOpenNetworkStream={() => setViewMode('streams')}
          onPickExternalVideo={handlePickSingleFile}
        />
      ) : (
        <View style={styles.mainContent}>
          <View style={styles.searchSortBar}>
            {activeFolder && (
              <TouchableOpacity
                style={styles.backFolderBtn}
                onPress={() => selectFolder(null)}
              >
                <Ionicons name="arrow-back" size={18} color={THEME.colors.accentCyan} />
              </TouchableOpacity>
            )}

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={THEME.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  activeFolder ? `Search in ${activeFolder.name}...` : 'Search videos or folders...'
                }
                placeholderTextColor={THEME.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.sortPill} onPress={cycleSortField}>
              <Text style={styles.sortPillText}>{sortField.toUpperCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sortIconBtn} onPress={toggleSortOrder}>
              <Ionicons
                name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                size={16}
                color={THEME.colors.accentCyan}
              />
            </TouchableOpacity>
          </View>

          {renderLastPlayedBanner()}

          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={THEME.colors.accentElectric} />
              <Text style={styles.loadingText}>Indexing local media directories...</Text>
            </View>
          ) : viewMode === 'folders' && !activeFolder && !searchQuery.trim() ? (
            <FlatList
              data={folders}
              keyExtractor={(item) => item.id}
              renderItem={renderFolderCard}
              contentContainerStyle={styles.listPadding}
              ListEmptyComponent={
                <View style={styles.centerBox}>
                  <Ionicons name="videocam-off-outline" size={42} color={THEME.colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Video Folders Found</Text>
                  <Text style={styles.emptySub}>
                    Place video files on your device or use the VLC Stream tab.
                  </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={displayedVideos}
              keyExtractor={(item) => item.id}
              renderItem={renderVideoCard}
              contentContainerStyle={styles.listPadding}
              ListHeaderComponent={
                activeFolder ? (
                  <View style={styles.breadcrumbBar}>
                    <Ionicons name="folder-open" size={16} color={THEME.colors.accentCyan} />
                    <Text style={styles.breadcrumbText}>
                      {activeFolder.name} ({displayedVideos.length})
                    </Text>
                  </View>
                ) : undefined
              }
              ListEmptyComponent={
                <View style={styles.centerBox}>
                  <Text style={styles.emptyTitle}>No matching videos</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      <Modal
        visible={isSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <GlassPanel style={styles.settingsSheet} intensity={55} heavy activeBorder>
            <View style={styles.settingsHeader}>
              <View style={styles.brandRow}>
                <Ionicons name="settings-outline" size={20} color={THEME.colors.accentCyan} />
                <Text style={styles.settingsTitle}>CHRONO PREFERENCES</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSettingsOpen(false)}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={20} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.prefRow} onPress={cycleDecoderMode}>
              <View>
                <Text style={styles.prefLabel}>Default Hardware Decoder</Text>
                <Text style={styles.prefSub}>Switch between HW+, HW, and Software decoding</Text>
              </View>
              <View style={styles.prefBadge}>
                <Text style={styles.prefBadgeText}>{decoderMode}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.prefRow} onPress={toggleBackgroundAudio}>
              <View>
                <Text style={styles.prefLabel}>Background Audio Playback</Text>
                <Text style={styles.prefSub}>Keep playing audio when app is minimized</Text>
              </View>
              <View style={styles.prefBadge}>
                <Text style={styles.prefBadgeText}>
                  {isBackgroundAudioEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.prefRow} onPress={handleClearWatchHistory}>
              <View>
                <Text style={styles.prefLabel}>Clear Resume Watch History</Text>
                <Text style={styles.prefSub}>Reset saved timestamps for all local videos</Text>
              </View>
              <Ionicons name="trash-outline" size={18} color={THEME.colors.statusDanger} />
            </TouchableOpacity>

            <View style={styles.settingsDivider} />

            <TouchableOpacity
              style={styles.githubCard}
              activeOpacity={0.85}
              onPress={() => Linking.openURL(GITHUB_PROFILE_URL)}
            >
              <Ionicons name="logo-github" size={26} color={THEME.colors.textPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.githubCardTitle}>@JoeBuildsThings</Text>
                <Text style={styles.githubCardSub}>
                  View Developer Profile & Projects on GitHub
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={THEME.colors.accentCyan} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.repoLinkBtn}
              activeOpacity={0.8}
              onPress={() => Linking.openURL(GITHUB_REPO_URL)}
            >
              <Ionicons name="git-branch-outline" size={16} color={THEME.colors.accentCyan} />
              <Text style={styles.repoLinkText}>
                github.com/JoeBuildsThings/chrono-video-player
              </Text>
            </TouchableOpacity>
          </GlassPanel>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bgAbyss,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  logoOrb: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderWidth: 1,
    borderColor: THEME.colors.accentElectric,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  brandTag: {
    color: THEME.colors.accentCyan,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.lg,
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  tabButtonActive: {
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderColor: THEME.colors.accentElectric,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  mainContent: {
    flex: 1,
  },
  searchSortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  backFolderBtn: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.glassSurface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: 13,
  },
  sortPill: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    justifyContent: 'center',
  },
  sortPillText: {
    color: THEME.colors.accentCyan,
    fontSize: 11,
    fontWeight: '700',
  },
  sortIconBtn: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeBannerWrapper: {
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.sm,
  },
  resumeBanner: {
    padding: THEME.spacing.md,
  },
  resumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  resumePlayBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.accentCobalt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeInfo: {
    flex: 1,
  },
  resumeTag: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.accentCyan,
    letterSpacing: 0.7,
  },
  resumeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginVertical: 2,
  },
  resumeTime: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.typography.monoFamily,
  },
  listPadding: {
    paddingHorizontal: THEME.spacing.lg,
    paddingBottom: 110,
  },
  cardTouch: {
    marginBottom: THEME.spacing.sm,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.md,
    gap: THEME.spacing.md,
  },
  folderIconBox: {
    width: 48,
    height: 48,
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderCountBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: THEME.colors.accentCobalt,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.accentCyan,
  },
  folderCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  folderMeta: {
    flex: 1,
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 3,
  },
  folderSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.md,
    gap: THEME.spacing.md,
  },
  videoThumbBox: {
    width: 78,
    height: 54,
    borderRadius: THEME.radius.sm,
    backgroundColor: '#050C1E',
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  durationChip: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(4, 8, 18, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 9,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.typography.monoFamily,
  },
  thumbProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  thumbProgressFill: {
    height: '100%',
    backgroundColor: THEME.colors.accentElectric,
  },
  videoMeta: {
    flex: 1,
    gap: 4,
  },
  videoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBadge: {
    backgroundColor: THEME.colors.accentCobalt,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.accentCyan,
  },
  videoTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  videoSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.accentCyan,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  specFolder: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    maxWidth: 110,
  },
  specResume: {
    fontSize: 11,
    color: THEME.colors.accentElectric,
    fontFamily: THEME.typography.monoFamily,
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: THEME.spacing.sm,
    paddingVertical: 4,
  },
  breadcrumbText: {
    color: THEME.colors.accentCyan,
    fontSize: 13,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
    gap: 8,
  },
  loadingText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
  emptyTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  streamContainer: {
    flex: 1,
    paddingHorizontal: THEME.spacing.lg,
  },
  streamPanel: {
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.lg,
  },
  streamHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  streamSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  streamInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 8, 18, 0.75)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    height: 44,
    gap: 8,
    marginBottom: THEME.spacing.sm,
  },
  streamInput: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontFamily: THEME.typography.monoFamily,
  },
  errorText: {
    color: THEME.colors.statusDanger,
    fontSize: 12,
    marginBottom: THEME.spacing.sm,
  },
  streamPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.accentCobalt,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.accentCyan,
  },
  streamPlayBtnText: {
    color: THEME.colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.9,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.xs,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.md,
    gap: THEME.spacing.md,
  },
  sampleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  sampleUrl: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.typography.monoFamily,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 16, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  settingsSheet: {
    width: '100%',
    maxWidth: 440,
    padding: THEME.spacing.lg,
    gap: THEME.spacing.sm,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  settingsTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.glassSurfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(4, 8, 18, 0.6)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  prefLabel: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  prefSub: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  prefBadge: {
    backgroundColor: THEME.colors.accentCobalt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.accentCyan,
  },
  prefBadgeText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderSubtle,
    marginVertical: THEME.spacing.xs,
  },
  githubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderWidth: 1,
    borderColor: THEME.colors.accentElectric,
  },
  githubCardTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  githubCardSub: {
    color: THEME.colors.accentCyan,
    fontSize: 11,
    marginTop: 1,
  },
  repoLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  repoLinkText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontFamily: THEME.typography.monoFamily,
  },
});
