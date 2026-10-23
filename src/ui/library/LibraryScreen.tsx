import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { VideoFolder, VideoItem } from '../../core/types';
import { PermissionGate } from './PermissionGate';
import { GlassPanel } from '../common/GlassPanel';
import { THEME } from '../../core/constants/theme';
import { formatDurationMs } from '../../engine/gesture.math';

function historyVideo(record: { videoId: string; uri: string; title: string; durationMs: number }): VideoItem {
  const stream = /^https?:\/\//i.test(record.uri);
  const name = record.title || record.uri.split('/').pop() || 'Video';
  return {
    id: record.videoId,
    filename: name,
    title: name.replace(/\.[^/.]+$/, ''),
    uri: record.uri,
    duration: record.durationMs || 0,
    width: 0,
    height: 0,
    creationTime: 0,
    modificationTime: 0,
    albumId: stream ? 'network' : 'recent',
    folderName: stream ? 'Network stream' : 'Recently played',
    isNetworkStream: stream,
  };
}

function shortDate(timestamp: number): string {
  if (!timestamp) return 'On device';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const LibraryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const permissionStatus = useLibraryStore((s) => s.permissionStatus);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const error = useLibraryStore((s) => s.error);
  const folders = useLibraryStore((s) => s.folders);
  const allVideos = useLibraryStore((s) => s.allVideos);
  const selectedFolderId = useLibraryStore((s) => s.selectedFolderId);
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const sortField = useLibraryStore((s) => s.sortField);
  const sortOrder = useLibraryStore((s) => s.sortOrder);
  const viewMode = useLibraryStore((s) => s.viewMode);
  const historyMap = useLibraryStore((s) => s.historyMap);
  const recentStreams = useLibraryStore((s) => s.recentStreams);
  const requestMediaPermission = useLibraryStore((s) => s.requestMediaPermission);
  const refreshLibrary = useLibraryStore((s) => s.refreshLibrary);
  const selectFolder = useLibraryStore((s) => s.selectFolder);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const setSorting = useLibraryStore((s) => s.setSorting);
  const setViewMode = useLibraryStore((s) => s.setViewMode);
  const addStreamToHistory = useLibraryStore((s) => s.addStreamToHistory);
  const openVideo = usePlayerStore((s) => s.openVideo);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamDialogVisible, setStreamDialogVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isPicking, setIsPicking] = useState(false);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) || null,
    [folders, selectedFolderId]
  );

  const displayedVideos = useMemo(() => {
    let videos = selectedFolderId && viewMode === 'all'
      ? (selectedFolder?.videos || [])
      : allVideos;
    const query = searchQuery.trim().toLocaleLowerCase();
    if (query) {
      videos = videos.filter((video) =>
        video.title.toLocaleLowerCase().includes(query) ||
        video.filename.toLocaleLowerCase().includes(query) ||
        video.folderName.toLocaleLowerCase().includes(query)
      );
    }
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    return [...videos].sort((a, b) => {
      if (sortField === 'title') return multiplier * a.title.localeCompare(b.title);
      if (sortField === 'duration') return multiplier * (a.duration - b.duration);
      if (sortField === 'size') return multiplier * (a.width * a.height - b.width * b.height);
      return multiplier * (a.modificationTime - b.modificationTime);
    });
  }, [allVideos, selectedFolder, selectedFolderId, searchQuery, sortField, sortOrder, viewMode]);

  const displayedFolders = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return folders.filter((folder) => !query || folder.name.toLocaleLowerCase().includes(query));
  }, [folders, searchQuery]);

  const latestResume = useMemo(() => {
    const record = Object.values(historyMap)
      .filter((entry) => entry.lastPositionMs > 1000 && (!entry.durationMs || entry.durationMs - entry.lastPositionMs > 5000))
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!record) return null;
    const item = allVideos.find((video) => video.id === record.videoId) || historyVideo(record);
    return { record, item };
  }, [historyMap, allVideos]);

  const handlePickVideo = async () => {
    if (isPicking) return;
    setIsPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const item: VideoItem = {
        id: 'picked_' + asset.uri,
        filename: asset.name,
        title: asset.name.replace(/\.[^/.]+$/, ''),
        uri: asset.uri,
        duration: 0,
        width: 0,
        height: 0,
        creationTime: 0,
        modificationTime: Date.now(),
        albumId: 'imported',
        folderName: 'Imported files',
      };
      openVideo(item, [item], 0);
    } catch (pickError) {
      Alert.alert('Could not open video', pickError instanceof Error ? pickError.message : 'Try selecting the file again.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleLaunchStream = () => {
    const value = streamUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) {
      Alert.alert('Check the link', 'Enter a valid HTTP or HTTPS video link.');
      return;
    }
    const item: VideoItem = {
      id: 'stream_' + value,
      filename: value.split('/').pop()?.split('?')[0] || 'Network stream',
      title: value.split('/').pop()?.split('?')[0] || value,
      uri: value,
      duration: 0,
      width: 0,
      height: 0,
      creationTime: 0,
      modificationTime: Date.now(),
      albumId: 'network',
      folderName: 'Network stream',
      isNetworkStream: true,
    };
    setStreamDialogVisible(false);
    setStreamUrl('');
    openVideo(item, [item], 0);
    addStreamToHistory(value).catch(() => {
      // Starting playback must not depend on optional recent-link storage.
    });
  };

  const playItem = (item: VideoItem, queue: VideoItem[]) => {
    const record = historyMap[item.id] || Object.values(historyMap).find((entry) => entry.uri === item.uri);
    const safeQueue = queue.some((entry) => entry.id === item.id) ? queue : [item, ...queue];
    openVideo(item, safeQueue, record?.lastPositionMs || 0);
  };

  const requestClearHistory = () => {
    Alert.alert('Clear watch history?', 'This removes saved resume positions on this device. Your videos will not be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear history',
        style: 'destructive',
        onPress: async () => {
          try {
            const { StorageService } = await import('../../services/storage.service');
            await StorageService.clearAllHistory();
            await refreshLibrary();
          } catch (clearError) {
            Alert.alert('Could not clear history', clearError instanceof Error ? clearError.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const renderVideo = ({ item }: { item: VideoItem }) => {
    const record = historyMap[item.id] || Object.values(historyMap).find((entry) => entry.uri === item.uri);
    const ratio = record && record.durationMs > 0 ? Math.max(0, Math.min(1, record.lastPositionMs / record.durationMs)) : 0;
    return (
      <Pressable onPress={() => playItem(item, displayedVideos)} style={({ pressed }) => [styles.videoRow, pressed && styles.pressed]}>
        <View style={styles.videoGlyph}>
          <Ionicons name={item.isNetworkStream ? 'globe-outline' : 'play'} size={22} color={THEME.colors.accentCyan} />
        </View>
        <View style={styles.videoInfo}>
          <Text numberOfLines={1} style={styles.videoTitle}>{item.title || item.filename}</Text>
          <Text numberOfLines={1} style={styles.videoMeta}>
            {item.folderName}  ·  {item.duration > 0 ? formatDurationMs(item.duration) : 'Duration loads on open'}
          </Text>
          {ratio > 0 && (
            <View style={styles.resumeTrack}>
              <View style={[styles.resumeFill, { width: (ratio * 100) + '%' }]} />
            </View>
          )}
        </View>
        <View style={styles.videoRight}>
          <Text style={styles.videoDate}>{record ? formatDurationMs(record.lastPositionMs) : shortDate(item.modificationTime)}</Text>
          <Ionicons name="chevron-forward" size={17} color={THEME.colors.textMuted} />
        </View>
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Ionicons name={viewMode === 'folders' ? 'folder-open-outline' : 'film-outline'} size={30} color={THEME.colors.accentCyan} /></View>
      <Text style={styles.emptyTitle}>{searchQuery ? 'Nothing matched' : 'Your library is quiet'}</Text>
      <Text style={styles.emptyHint}>{searchQuery ? 'Try a shorter title or folder name.' : 'Import a video or refresh after adding media to your device.'}</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={handlePickVideo}>
        <Ionicons name="add" size={18} color={THEME.colors.accentCyan} />
        <Text style={styles.secondaryButtonText}>Open a video file</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFolder = ({ item }: { item: VideoFolder }) => (
    <Pressable
      onPress={() => { setViewMode('all'); selectFolder(item.id); }}
      style={({ pressed }) => [styles.folderRow, pressed && styles.pressed]}
    >
      <View style={styles.folderGlyph}>
        <Ionicons name="folder-open" size={23} color={THEME.colors.accentCyan} />
      </View>
      <View style={styles.videoInfo}>
        <Text numberOfLines={1} style={styles.videoTitle}>{item.name}</Text>
        <Text style={styles.videoMeta}>{item.videoCount} {item.videoCount === 1 ? 'video' : 'videos'}  ·  {formatDurationMs(item.totalDuration)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
    </Pressable>
  );

  const switchView = (mode: 'folders' | 'all' | 'streams') => {
    setViewMode(mode);
    setSearchQuery('');
  };

  return (
    <LinearGradient colors={['#061126', '#040812', '#070D1B']} style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Animated.View entering={FadeIn.duration(350)} style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <LinearGradient colors={['#38BDF8', '#2563EB']} style={styles.brandMark}>
                <Ionicons name="play" size={18} color="#FFFFFF" />
              </LinearGradient>
              <View>
                <Text style={styles.brandTitle}>chrono<Text style={styles.brandAccent}>.</Text></Text>
                <Text style={styles.brandSubtitle}>YOUR MEDIA, YOUR PACE</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity accessibilityLabel="Import video" style={styles.headerButton} onPress={handlePickVideo} disabled={isPicking}>
                {isPicking ? <ActivityIndicator color={THEME.colors.accentCyan} /> : <Ionicons name="add" size={23} color={THEME.colors.textPrimary} />}
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Refresh library" style={styles.headerButton} onPress={() => refreshLibrary()}>
                <Ionicons name="refresh-outline" size={20} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Settings" style={styles.headerButton} onPress={() => setSettingsVisible(true)}>
                <Ionicons name="options-outline" size={20} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {permissionStatus === 'granted' ? (
            <>
              <View style={styles.hero}>
                <Text style={styles.heroEyebrow}>YOUR LIBRARY</Text>
                <Text style={styles.heroTitle}>Find your next{'\n'}frame.</Text>
                <Text style={styles.heroCaption}>{allVideos.length.toLocaleString()} videos indexed on this device</Text>
                <View style={styles.heroGlow} />
              </View>

              {latestResume && (
                <Animated.View entering={FadeInDown.duration(280)}>
                  <GlassPanel style={styles.resumeCard} intensity={28} heavy>
                    <Pressable onPress={() => playItem(latestResume.item, [latestResume.item, ...allVideos.filter((video) => video.id !== latestResume.item.id)])} style={styles.resumeInner}>
                      <View style={styles.resumeIcon}>
                        <Ionicons name="play" size={18} color="#FFFFFF" />
                      </View>
                      <View style={styles.resumeText}>
                        <Text style={styles.eyebrow}>CONTINUE WATCHING</Text>
                        <Text numberOfLines={1} style={styles.resumeTitle}>{latestResume.record.title}</Text>
                        <Text style={styles.resumeMeta}>Resume at {formatDurationMs(latestResume.record.lastPositionMs)}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={19} color={THEME.colors.accentCyan} />
                    </Pressable>
                  </GlassPanel>
                </Animated.View>
              )}

              <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={19} color={THEME.colors.textMuted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={viewMode === 'folders' ? 'Search folders' : 'Search your videos'}
                  placeholderTextColor={THEME.colors.textMuted}
                  style={styles.searchInput}
                  returnKeyType="search"
                  accessibilityLabel="Search media library"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.tabRow}>
                {([
                  { id: 'all', label: 'Videos', icon: 'film-outline' },
                  { id: 'folders', label: 'Folders', icon: 'folder-outline' },
                  { id: 'streams', label: 'Links', icon: 'globe-outline' },
                ] as const).map((tab) => {
                  const active = (tab.id === 'all' && viewMode === 'all' && !selectedFolderId) ||
                    (tab.id === 'folders' && viewMode === 'folders') ||
                    (tab.id === 'streams' && viewMode === 'streams') ||
                    (tab.id === 'all' && !!selectedFolderId);
                  return (
                    <TouchableOpacity key={tab.id} onPress={() => switchView(tab.id === 'all' ? 'all' : tab.id === 'folders' ? 'folders' : 'streams')} style={[styles.tabButton, active && styles.tabActive]}>
                      <Ionicons name={tab.icon as any} size={16} color={active ? THEME.colors.accentCyan : THEME.colors.textMuted} />
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {viewMode !== 'streams' && (
                <View style={styles.listHeading}>
                  <View style={styles.listHeadingLeft}>
                    {selectedFolderId && (
                      <TouchableOpacity accessibilityLabel="Back to all videos" onPress={() => setViewMode('folders')} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={16} color={THEME.colors.accentCyan} />
                      </TouchableOpacity>
                    )}
                    <Text style={styles.sectionTitle}>{viewMode === 'folders' ? 'Folders' : selectedFolder?.name || 'All videos'}</Text>
                    <Text style={styles.countText}>{viewMode === 'folders' ? displayedFolders.length : displayedVideos.length}</Text>
                  </View>
                  <TouchableOpacity accessibilityLabel="Change sort order" onPress={() => {
                    if (sortOrder === 'desc') {
                      setSorting(sortField, 'asc');
                    } else {
                      const fields = ['date', 'title', 'duration'] as const;
                      const index = fields.indexOf(sortField as 'date' | 'title' | 'duration');
                      setSorting(fields[(index + 1) % fields.length], 'desc');
                    }
                  }} style={styles.sortButton}>
                    <Ionicons name="swap-vertical" size={16} color={THEME.colors.textSecondary} />
                    <Text style={styles.sortText}>{sortField === 'date' ? 'Recent' : sortField === 'title' ? 'Title' : 'Duration'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {viewMode === 'streams' ? (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.streamsContent}
                  refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refreshLibrary()} tintColor={THEME.colors.accentCyan} />}
                >
                  <GlassPanel style={styles.streamCard} intensity={24}>
                    <View style={styles.streamIcon}><Ionicons name="link" size={22} color={THEME.colors.accentCyan} /></View>
                    <Text style={styles.streamTitle}>Play from a link</Text>
                    <Text style={styles.streamCaption}>Paste an HTTP, HTTPS or HLS video URL. Unsupported hosts or formats will report a playback error.</Text>
                    <TextInput
                      value={streamUrl}
                      onChangeText={setStreamUrl}
                      placeholder="https://example.com/video.mp4"
                      placeholderTextColor={THEME.colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      style={styles.streamInput}
                      accessibilityLabel="Video stream URL"
                    />
                    <TouchableOpacity style={styles.primaryButton} onPress={handleLaunchStream}>
                      <Ionicons name="play" size={17} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Play stream</Text>
                    </TouchableOpacity>
                  </GlassPanel>
                  <Text style={styles.sectionTitle}>Recent links</Text>
                  {recentStreams.length === 0 ? (
                    <Text style={styles.emptyHint}>Streams you open will appear here.</Text>
                  ) : recentStreams.map((url) => (
                    <Pressable key={url} style={styles.recentStream} onPress={() => { setStreamUrl(url); }}>
                      <View style={styles.videoGlyph}><Ionicons name="globe-outline" size={19} color={THEME.colors.accentCyan} /></View>
                      <Text numberOfLines={2} style={styles.recentStreamText}>{url}</Text>
                      <TouchableOpacity accessibilityLabel="Play recent stream" onPress={() => { setStreamUrl(url); const item: VideoItem = { id: 'stream_' + url, filename: url.split('/').pop()?.split('?')[0] || 'Network stream', title: url.split('/').pop()?.split('?')[0] || url, uri: url, duration: 0, width: 0, height: 0, creationTime: 0, modificationTime: Date.now(), albumId: 'network', folderName: 'Network stream', isNetworkStream: true }; openVideo(item, [item], 0); }} style={styles.playRecent}>
                        <Ionicons name="play" size={17} color={THEME.colors.accentCyan} />
                      </TouchableOpacity>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : viewMode === 'folders' ? (
                <FlatList<VideoFolder>
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  data={displayedFolders}
                  keyExtractor={(item) => item.id}
                  renderItem={renderFolder}
                  ListEmptyComponent={renderEmpty}
                  refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refreshLibrary()} tintColor={THEME.colors.accentCyan} />}
                  initialNumToRender={12}
                  maxToRenderPerBatch={10}
                  windowSize={7}
                  keyboardShouldPersistTaps="handled"
                />
              ) : (
                <FlatList<VideoItem>
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  data={displayedVideos}
                  keyExtractor={(item) => item.id}
                  renderItem={renderVideo}
                  ListEmptyComponent={renderEmpty}
                  refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refreshLibrary()} tintColor={THEME.colors.accentCyan} />}
                  initialNumToRender={12}
                  maxToRenderPerBatch={10}
                  windowSize={7}
                  keyboardShouldPersistTaps="handled"
                />
              )}

              {isLoading && allVideos.length === 0 && (
                <View style={styles.loading}><ActivityIndicator size="small" color={THEME.colors.accentCyan} /><Text style={styles.loadingText}>Scanning your library…</Text></View>
              )}
            </>
          ) : (
            <View style={styles.permissionArea}>
              <PermissionGate
                status={permissionStatus}
                onRequestPermission={requestMediaPermission}
                onOpenNetworkStream={() => setStreamDialogVisible(true)}
                onPickExternalVideo={handlePickVideo}
              />
            </View>
          )}

          {error && (
            <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(140)} style={styles.errorToast}>
              <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => refreshLibrary()}><Ionicons name="refresh" size={17} color={THEME.colors.textPrimary} /></TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      </SafeAreaView>

      <Modal visible={streamDialogVisible} transparent animationType="fade" onRequestClose={() => setStreamDialogVisible(false)} statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <GlassPanel style={styles.streamDialog} intensity={55} heavy activeBorder>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.eyebrow}>NETWORK PLAYBACK</Text>
                <Text style={styles.modalTitle}>Open a stream</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Close stream dialog" onPress={() => setStreamDialogVisible(false)} style={styles.headerButton}>
                <Ionicons name="close" size={20} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.streamCaption}>Use an HTTP or HTTPS video URL. HLS links ending in .m3u8 work when supported by the source.</Text>
            <TextInput
              value={streamUrl}
              onChangeText={setStreamUrl}
              placeholder="https://example.com/video.mp4"
              placeholderTextColor={THEME.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.streamInput}
              accessibilityLabel="Video stream URL"
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleLaunchStream}>
              <Ionicons name="play" size={17} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Play stream</Text>
            </TouchableOpacity>
          </GlassPanel>
        </View>
      </Modal>

      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Animated.View entering={SlideInDown.duration(240)} exiting={SlideOutDown.duration(180)} style={styles.settingsSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Library settings</Text>
              <TouchableOpacity accessibilityLabel="Close settings" onPress={() => setSettingsVisible(false)} style={styles.headerButton}>
                <Ionicons name="close" size={20} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.settingsRow} onPress={() => { setSettingsVisible(false); refreshLibrary(); }}>
              <Ionicons name="refresh-outline" size={20} color={THEME.colors.accentCyan} />
              <View style={styles.settingsCopy}><Text style={styles.settingsTitle}>Rescan library</Text><Text style={styles.settingsMeta}>Find videos recently added to your device</Text></View>
              <Ionicons name="chevron-forward" size={17} color={THEME.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRow} onPress={() => { setSettingsVisible(false); requestClearHistory(); }}>
              <Ionicons name="trash-outline" size={20} color="#FCA5A5" />
              <View style={styles.settingsCopy}><Text style={styles.settingsTitle}>Clear watch history</Text><Text style={styles.settingsMeta}>Removes resume points, not video files</Text></View>
              <Ionicons name="chevron-forward" size={17} color={THEME.colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.privacyNote}>Your library and watch history stay on this device. Chrono Player does not require an account.</Text>
          </Animated.View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1, backgroundColor: THEME.colors.bgAbyss },
  safe: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { color: THEME.colors.textPrimary, fontSize: 23, fontWeight: '800', letterSpacing: -0.9 },
  brandAccent: { color: THEME.colors.accentCyan },
  brandSubtitle: { color: THEME.colors.textMuted, fontSize: 8, letterSpacing: 1.6, fontWeight: '700', marginTop: -1 },
  headerActions: { flexDirection: 'row', gap: 7 },
  headerButton: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(19, 40, 77, 0.72)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.13)' },
  hero: { borderRadius: 23, overflow: 'hidden', backgroundColor: '#0B1A36', paddingHorizontal: 20, paddingVertical: 18, minHeight: 138, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(56,189,248,0.17)', marginBottom: 13 },
  heroEyebrow: { color: THEME.colors.accentCyan, fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  heroTitle: { color: '#F8FAFC', fontSize: 29, lineHeight: 31, fontWeight: '800', letterSpacing: -0.9 },
  heroCaption: { color: '#9FB0C9', fontSize: 11, marginTop: 8 },
  heroGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -37, top: -50, backgroundColor: 'rgba(37,99,235,0.18)' },
  resumeCard: { marginBottom: 14, borderRadius: 17 },
  resumeInner: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  resumeIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: THEME.colors.accentCobalt, alignItems: 'center', justifyContent: 'center' },
  resumeText: { flex: 1, gap: 3 },
  eyebrow: { color: THEME.colors.accentCyan, fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  resumeTitle: { color: THEME.colors.textPrimary, fontSize: 13, fontWeight: '700' },
  resumeMeta: { color: THEME.colors.textSecondary, fontSize: 10 },
  searchRow: { height: 46, borderRadius: 15, backgroundColor: 'rgba(9,19,39,0.86)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.13)', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, marginBottom: 12 },
  searchInput: { flex: 1, color: THEME.colors.textPrimary, fontSize: 13, paddingVertical: 0 },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(9,18,36,0.8)', borderRadius: 15, padding: 4, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(148,163,184,0.08)' },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 11 },
  tabActive: { backgroundColor: 'rgba(37,99,235,0.22)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.18)' },
  tabText: { color: THEME.colors.textMuted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: THEME.colors.textPrimary },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7, paddingHorizontal: 2 },
  listHeadingLeft: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sectionTitle: { color: THEME.colors.textPrimary, fontWeight: '800', fontSize: 16 },
  countText: { color: THEME.colors.textMuted, fontSize: 11 },
  backButton: { width: 27, height: 27, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: 'rgba(56,189,248,0.1)' },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 7 },
  sortText: { color: THEME.colors.textSecondary, fontSize: 10, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 18, flexGrow: 1 },
  videoRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, marginBottom: 7, paddingHorizontal: 10, paddingVertical: 11, gap: 11, backgroundColor: 'rgba(14,28,54,0.64)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.08)' },
  folderRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, marginBottom: 7, paddingHorizontal: 10, paddingVertical: 13, gap: 11, backgroundColor: 'rgba(14,28,54,0.64)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.08)' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  videoGlyph: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,165,233,0.1)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.13)' },
  folderGlyph: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37,99,235,0.14)' },
  videoInfo: { flex: 1, gap: 4 },
  videoTitle: { color: THEME.colors.textPrimary, fontSize: 12, fontWeight: '700' },
  videoMeta: { color: THEME.colors.textMuted, fontSize: 10 },
  videoRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  videoDate: { color: THEME.colors.textMuted, fontSize: 9 },
  resumeTrack: { height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 2, overflow: 'hidden' },
  resumeFill: { height: '100%', backgroundColor: THEME.colors.accentCyan },
  streamsContent: { gap: 13, paddingBottom: 30 },
  streamCard: { padding: 16, borderRadius: 19, gap: 8 },
  streamIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: 'rgba(14,165,233,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  streamTitle: { color: THEME.colors.textPrimary, fontSize: 17, fontWeight: '800' },
  streamCaption: { color: THEME.colors.textSecondary, fontSize: 11, lineHeight: 17 },
  streamInput: { height: 45, borderRadius: 12, color: THEME.colors.textPrimary, backgroundColor: 'rgba(4,8,18,0.7)', borderWidth: 1, borderColor: THEME.colors.borderSpecular, paddingHorizontal: 12, fontSize: 12, marginTop: 5 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 45, borderRadius: 13, backgroundColor: '#1769DE', paddingHorizontal: 14, marginTop: 5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  recentStream: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, borderRadius: 13, backgroundColor: 'rgba(14,28,54,0.64)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.08)' },
  recentStreamText: { flex: 1, fontSize: 10, color: THEME.colors.textSecondary },
  playRecent: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(56,189,248,0.1)' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 48, paddingBottom: 36 },
  emptyIcon: { width: 61, height: 61, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,165,233,0.1)', marginBottom: 13 },
  emptyTitle: { color: THEME.colors.textPrimary, fontSize: 15, fontWeight: '800' },
  emptyHint: { color: THEME.colors.textMuted, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 7 },
  secondaryButton: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: THEME.colors.borderSpecular, marginTop: 15 },
  secondaryButtonText: { color: THEME.colors.accentCyan, fontSize: 11, fontWeight: '800' },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  loadingText: { color: THEME.colors.textSecondary, fontSize: 11 },
  permissionArea: { flex: 1, justifyContent: 'center' },
  errorToast: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: 'rgba(248,113,113,0.28)', backgroundColor: 'rgba(65,17,26,0.93)', borderRadius: 13, padding: 11, marginBottom: 4 },
  errorText: { color: '#FECACA', flex: 1, fontSize: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(1,5,15,0.74)' },
  streamDialog: { marginHorizontal: 18, padding: 17, borderRadius: 23, gap: 10, backgroundColor: 'rgba(8,20,42,0.98)' },
  settingsSheet: { backgroundColor: '#0A1730', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 21, paddingTop: 11, paddingBottom: 30, borderWidth: 1, borderColor: 'rgba(56,189,248,0.22)' },
  modalHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.45)', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: THEME.colors.textPrimary, fontSize: 19, fontWeight: '800' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.09)' },
  settingsCopy: { flex: 1, gap: 4 },
  settingsTitle: { color: THEME.colors.textPrimary, fontSize: 12, fontWeight: '700' },
  settingsMeta: { color: THEME.colors.textMuted, fontSize: 10 },
  privacyNote: { color: THEME.colors.textMuted, fontSize: 10, lineHeight: 16, marginTop: 17 },
});
