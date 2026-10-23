import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { HardwareService } from '../../services/hardware.service';
import { SubtitleService } from '../../services/subtitle.service';
import { calculateHorizontalSeekTarget, calculateVerticalSwipeValue, formatDurationMs, formatSignedDeltaMs } from '../../engine/gesture.math';
import { GlassPanel } from '../common/GlassPanel';
import { VlcControlModal, NativeSubtitleOption } from './VlcControlModal';
import { THEME } from '../../core/constants/theme';
import { VideoItem } from '../../core/types';

const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

const KeepAwakeGate: React.FC = () => {
  useKeepAwake();
  return null;
};

export const VideoPlayerScreen: React.FC = () => {
  const activeVideo = usePlayerStore((state) => state.activeVideo);

  useEffect(() => {
    let mounted = true;
    HardwareService.getBrightness().then((value) => {
      if (!mounted) return;
      originalBrightness.current = value;
      usePlayerStore.getState().setBrightness(value);
    }).catch(() => {});
    return () => {
      mounted = false;
      if (originalBrightness.current !== null) void HardwareService.setBrightness(originalBrightness.current);
      void HardwareService.unlockOrientation();
    };
  }, []);

  if (!activeVideo) return null;
  return <PlayerContent key={activeVideo.id} video={activeVideo} />;
};

const PlayerContent: React.FC<{ video: VideoItem }> = ({ video }) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nativeSubtitleTracks, setNativeSubtitleTracks] = useState<NativeSubtitleOption[]>([]);
  const [selectedNativeSubtitleId, setSelectedNativeSubtitleId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [gestureToast, setGestureToast] = useState<{ title: string; detail?: string; value?: number } | null>(null);
  const [progressWidth, setProgressWidth] = useState(1);

  const positionMs = usePlayerStore((state) => state.positionMs);
  const durationMs = usePlayerStore((state) => state.durationMs);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isMinimized = usePlayerStore((state) => state.isMinimized);
  const isBuffering = usePlayerStore((state) => state.isBuffering);
  const isHudVisible = usePlayerStore((state) => state.isHudVisible);
  const isLocked = usePlayerStore((state) => state.isLocked);
  const playbackSpeed = usePlayerStore((state) => state.playbackSpeed);
  const volume = usePlayerStore((state) => state.volumeBoost);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const brightness = usePlayerStore((state) => state.brightness);
  const aspectRatio = usePlayerStore((state) => state.aspectRatio);
  const zoomScale = usePlayerStore((state) => state.zoomScale);
  const abRepeat = usePlayerStore((state) => state.abRepeat);
  const subtitleTracks = usePlayerStore((state) => state.subtitleTracks);
  const activeSubtitleId = usePlayerStore((state) => state.activeSubtitleId);
  const subtitleOffsetMs = usePlayerStore((state) => state.subtitleOffsetMs);
  const subtitleFontSize = usePlayerStore((state) => state.subtitleFontSize);
  const sleepTimerRemainingSec = usePlayerStore((state) => state.sleepTimerRemainingSec);
  const backgroundAudioEnabled = usePlayerStore((state) => state.isBackgroundAudioEnabled);

  const videoSource = useMemo(() => ({
    uri: video.uri,
    contentType: /\.m3u8(?:$|[?#])/i.test(video.uri) ? 'hls' as const : 'auto' as const,
  }), [video.uri]);

  const player = useVideoPlayer(videoSource, (instance) => {
    const state = usePlayerStore.getState();
    instance.timeUpdateEventInterval = 0.25;
    instance.audioMixingMode = 'duckOthers';
    instance.preservesPitch = true;
    instance.playbackRate = state.playbackSpeed;
    instance.volume = state.volumeBoost;
    instance.muted = state.isMuted;
    instance.staysActiveInBackground = state.isBackgroundAudioEnabled;
    instance.currentTime = Math.max(0, state.positionMs) / 1000;
    instance.play();
  });

  const positionRef = useRef(usePlayerStore.getState().positionMs);
  const durationRef = useRef(video.duration || 0);
  const lastSavedAt = useRef(0);
  const abSeeking = useRef(false);
  const lastBrightnessWriteAt = useRef(0);
  const gestureStart = useRef({
    brightness: 0.75,
    volume: 1,
    positionMs: 0,
    zoom: 1,
    side: 'left' as 'left' | 'right',
    mode: 'none' as 'none' | 'vertical' | 'horizontal',
  });

  const saveRecord = useCallback(async (force = false) => {
    const latest = usePlayerStore.getState();
    if (positionRef.current < 1000) return;
    if (!force && Date.now() - lastSavedAt.current < 12000) return;
    lastSavedAt.current = Date.now();
    try {
      await useLibraryStore.getState().recordPlaybackProgress({
        videoId: video.id,
        uri: video.uri,
        title: video.title,
        lastPositionMs: positionRef.current,
        durationMs: durationRef.current || video.duration || 0,
        updatedAt: Date.now(),
        playbackSpeed: latest.playbackSpeed,
        subtitleOffsetMs: latest.subtitleOffsetMs,
        audioOffsetMs: latest.audioOffsetMs,
      });
    } catch {
      lastSavedAt.current = 0;
    }
  }, [video]);

  useEffect(() => {
    return () => {
      void saveRecord(true);
    };
  }, [saveRecord]);

  useEffect(() => {
    player.playbackRate = playbackSpeed;
  }, [player, playbackSpeed]);

  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  useEffect(() => {
    player.muted = isMuted;
  }, [player, isMuted]);

  useEffect(() => {
    player.staysActiveInBackground = backgroundAudioEnabled;
    player.showNowPlayingNotification = backgroundAudioEnabled;
  }, [player, backgroundAudioEnabled]);

  useEffect(() => {
    if (isPlaying && !player.playing) player.play();
    else if (!isPlaying && player.playing) player.pause();
  }, [isPlaying, player]);

  useEffect(() => {
    const statusSub = player.addListener('statusChange', ({ status, error }) => {
      const loading = status === 'loading';
      usePlayerStore.getState().setPlaybackStatus({ isBuffering: loading });
      if (status === 'error') {
        setPlaybackError(error?.message || 'This video could not be played. Check the file or stream link.');
      } else if (status === 'readyToPlay') {
        setPlaybackError(null);
      }
    });

    const playingSub = player.addListener('playingChange', ({ isPlaying: nowPlaying }) => {
      usePlayerStore.getState().setPlaybackStatus({ isPlaying: nowPlaying, isBuffering: false });
    });

    const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
      const latest = usePlayerStore.getState();
      if (latest.activeVideo && latest.activeVideo.id !== video.id) return;
      const current = Math.max(0, Math.round(currentTime * 1000));
      positionRef.current = current;

      const repeat = latest.abRepeat;
      if (repeat.enabled && repeat.pointAMs !== null && repeat.pointBMs !== null) {
        if (current >= repeat.pointBMs && !abSeeking.current) {
          abSeeking.current = true;
          player.currentTime = repeat.pointAMs / 1000;
          positionRef.current = repeat.pointAMs;
          latest.setPlaybackStatus({ positionMs: repeat.pointAMs });
          return;
        }
        if (current < repeat.pointBMs - 600) abSeeking.current = false;
      }

      latest.setPlaybackStatus({ positionMs: current });
      if (Date.now() - lastSavedAt.current > 12000) void saveRecord();
    });

    const sourceSub = player.addListener('sourceLoad', ({ duration, availableSubtitleTracks }) => {
      const total = Number.isFinite(duration) ? Math.max(0, Math.round(duration * 1000)) : 0;
      durationRef.current = total || video.duration || 0;
      usePlayerStore.getState().setPlaybackStatus({ durationMs: durationRef.current, isBuffering: false });
      const options = (availableSubtitleTracks || []).map((track, index) => ({
        id: String(track.id),
        label: track.label || track.language || ('Embedded subtitle ' + (index + 1)),
      }));
      setNativeSubtitleTracks(options);
      const currentNativeTrack = player.subtitleTrack;
      setSelectedNativeSubtitleId(currentNativeTrack ? String(currentNativeTrack.id) : null);
    });

    const subtitleChangeSub = player.addListener('subtitleTrackChange', ({ subtitleTrack }) => {
      setSelectedNativeSubtitleId(subtitleTrack ? String(subtitleTrack.id) : null);
    });

    const endedSub = player.addListener('playToEnd', () => {
      void saveRecord(true);
      const next = usePlayerStore.getState().playNextInQueue();
      if (!next) usePlayerStore.getState().setPlaybackStatus({ isPlaying: false, positionMs: durationRef.current });
    });

    return () => {
      statusSub.remove();
      playingSub.remove();
      timeSub.remove();
      sourceSub.remove();
      subtitleChangeSub.remove();
      endedSub.remove();
    };
  }, [player, saveRecord, video]);

  const sleepTimerActive = sleepTimerRemainingSec !== null;
  useEffect(() => {
    if (!sleepTimerActive) return;
    const interval = setInterval(() => {
      const expired = usePlayerStore.getState().tickSleepTimer();
      if (expired) {
        player.pause();
        void saveRecord(true);
        Alert.alert('Sleep timer finished', 'Playback has been paused.');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerActive, player, saveRecord]);

  const activeSubtitleCue = useMemo(() => {
    if (!activeSubtitleId) return null;
    const track = subtitleTracks.find((item) => item.id === activeSubtitleId);
    return track ? SubtitleService.findActiveCue(track.cues, positionMs, subtitleOffsetMs) : null;
  }, [activeSubtitleId, subtitleTracks, positionMs, subtitleOffsetMs]);

  const seekToMs = useCallback((targetMs: number) => {
    const latestDuration = usePlayerStore.getState().durationMs || durationRef.current;
    const safeTarget = Math.max(0, latestDuration > 0 ? Math.min(latestDuration, targetMs) : targetMs);
    player.currentTime = safeTarget / 1000;
    positionRef.current = safeTarget;
    usePlayerStore.getState().setPlaybackStatus({ positionMs: safeTarget });
  }, [player]);

  const togglePlayPause = useCallback(() => {
    if (usePlayerStore.getState().isPlaying) player.pause();
    else player.play();
  }, [player]);

  const changeBrightness = (value: number) => {
    usePlayerStore.getState().setBrightness(value);
    const now = Date.now();
    if (now - lastBrightnessWriteAt.current > 120) {
      lastBrightnessWriteAt.current = now;
      void HardwareService.setBrightness(value);
    }
  };

  const toggleOrientation = async () => {
    try {
      if (isLandscape) await HardwareService.lockPortrait();
      else await HardwareService.lockLandscape();
    } catch {
      Alert.alert('Orientation unavailable', 'Your device did not allow an orientation change.');
    }
  };

  const exitPlayer = async () => {
    await saveRecord(true);
    usePlayerStore.getState().closePlayer();
  };

  const minimizePlayer = async () => {
    await saveRecord(true);
    usePlayerStore.getState().minimizePlayer();
  };

  const startPictureInPicture = async () => {
    try {
      await player.startPictureInPicture();
    } catch {
      Alert.alert('Picture-in-picture unavailable', 'This device or video does not support picture-in-picture right now.');
    }
  };

  const onNativeSubtitleSelect = (id: string | null) => {
    const nativeTrack = id === null ? null : player.availableSubtitleTracks.find((track) => String(track.id) === id) || null;
    player.subtitleTrack = nativeTrack;
    setSelectedNativeSubtitleId(id);
    usePlayerStore.getState().selectSubtitleTrack(null);
  };

  const subtitleJump = (direction: 'prev' | 'next') => {
    if (!activeSubtitleId) return;
    const track = subtitleTracks.find((item) => item.id === activeSubtitleId);
    if (!track) return;
    const target = SubtitleService.findAdjacentCueTimestamp(track.cues, positionMs, direction);
    if (target !== null) seekToMs(target);
  };

  const showToast = (title: string, detail?: string, value?: number) => {
    setGestureToast({ title, detail, value });
    setTimeout(() => setGestureToast(null), 650);
  };

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .maxPointers(1)
    .enabled(!isLocked && !isMinimized)
    .minDistance(14)
    .onBegin((event) => {
      gestureStart.current = {
        brightness,
        volume,
        positionMs,
        zoom: zoomScale,
        side: event.x < width / 2 ? 'left' : 'right',
        mode: 'none',
      };
    })
    .onUpdate((event) => {
      if (gestureStart.current.mode === 'none') {
        gestureStart.current.mode = Math.abs(event.translationX) > Math.abs(event.translationY) * 1.15
          ? 'horizontal'
          : 'vertical';
      }

      if (gestureStart.current.mode === 'horizontal') {
        const result = calculateHorizontalSeekTarget(
          gestureStart.current.positionMs,
          event.translationX,
          width,
          durationMs || 60000
        );
        setGestureToast({
          title: formatDurationMs(result.targetMs),
          detail: formatSignedDeltaMs(result.deltaMs),
          value: durationMs > 0 ? result.targetMs / durationMs : undefined,
        });
      } else if (gestureStart.current.side === 'left') {
        const next = calculateVerticalSwipeValue(gestureStart.current.brightness, event.translationY, height, 1);
        changeBrightness(next);
        setGestureToast({ title: 'Brightness ' + Math.round(next * 100) + '%', value: next });
      } else {
        const next = calculateVerticalSwipeValue(gestureStart.current.volume, event.translationY, height, 1);
        usePlayerStore.getState().setVolumeBoost(next);
        player.volume = next;
        setGestureToast({ title: 'Volume ' + Math.round(next * 100) + '%', value: next });
      }
    })
    .onEnd((event) => {
      if (gestureStart.current.mode === 'horizontal') {
        const result = calculateHorizontalSeekTarget(
          gestureStart.current.positionMs,
          event.translationX,
          width,
          durationMs || 60000
        );
        seekToMs(result.targetMs);
        showToast('Seeked to ' + formatDurationMs(result.targetMs), formatSignedDeltaMs(result.deltaMs));
      } else if (gestureStart.current.mode === 'vertical') {
        if (gestureStart.current.side === 'left') void HardwareService.setBrightness(usePlayerStore.getState().brightness);
        else player.volume = usePlayerStore.getState().volumeBoost;
      }
      setTimeout(() => setGestureToast(null), 480);
    });

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .enabled(!isLocked && !isMinimized)
    .onBegin(() => { gestureStart.current.zoom = zoomScale; })
    .onUpdate((event) => {
      const nextZoom = Math.max(0.75, Math.min(2.5, Number((gestureStart.current.zoom * event.scale).toFixed(2))));
      usePlayerStore.getState().setZoomScale(nextZoom);
      setGestureToast({ title: 'Zoom ' + Math.round(nextZoom * 100) + '%' });
    })
    .onEnd(() => setTimeout(() => setGestureToast(null), 400));

  const doubleTapGesture = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .enabled(!isLocked && !isMinimized)
    .onEnd((event) => {
      if (event.x < width / 3) {
        const target = Math.max(0, positionRef.current - 10000);
        seekToMs(target);
        showToast('−10 seconds', formatDurationMs(target));
      } else if (event.x > width * 2 / 3) {
        const target = positionRef.current + 10000;
        seekToMs(target);
        showToast('+10 seconds', formatDurationMs(target));
      } else {
        togglePlayPause();
      }
    });

  const singleTapGesture = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(1)
    .enabled(!isMinimized && !isLocked)
    .onEnd(() => usePlayerStore.getState().toggleHud());

  const touchGestures = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Exclusive(panGesture, doubleTapGesture, singleTapGesture)
  );

  const progress = durationMs > 0 ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0;
  const resizeContentFit = aspectRatio === 'FILL' ? 'cover' : aspectRatio === 'STRETCH' ? 'fill' : 'contain';
  const videoFrameStyle = aspectRatio === '16:9'
    ? styles.videoFrame169
    : aspectRatio === '4:3'
      ? styles.videoFrame43
      : styles.videoFrame;
  const repeatLabel = abRepeat.pointAMs === null
    ? 'Set A-B'
    : abRepeat.pointBMs === null
      ? 'Set B · ' + formatDurationMs(abRepeat.pointAMs)
      : formatDurationMs(abRepeat.pointAMs) + ' – ' + formatDurationMs(abRepeat.pointBMs);

  if (isMinimized) {
    return (
      <View style={styles.minimizedLayer} pointerEvents="box-none">
        <GlassPanel style={styles.miniCard} intensity={55} heavy activeBorder>
          <TouchableOpacity accessibilityLabel="Expand player" onPress={() => usePlayerStore.getState().expandPlayer()} style={styles.miniVideoFrame}>
            <VideoView player={player} style={styles.miniVideo} contentFit="cover" nativeControls={false} allowsPictureInPicture />
            <View style={styles.miniExpandBadge}><Ionicons name="expand" size={13} color="#FFFFFF" /></View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => usePlayerStore.getState().expandPlayer()} style={styles.miniMeta}>
            <Text numberOfLines={1} style={styles.miniTitle}>{video.title}</Text>
            <Text style={styles.miniTime}>{formatDurationMs(positionMs)} / {formatDurationMs(durationMs)}</Text>
            <View style={styles.miniTrack}><View style={[styles.miniFill, { width: (progress * 100) + '%' }]} /></View>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'} style={styles.miniAction} onPress={togglePlayPause}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={THEME.colors.accentCyan} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Close player" style={styles.miniAction} onPress={exitPlayer}>
            <Ionicons name="close" size={19} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </GlassPanel>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.videoStage}>
        <GestureDetector gesture={touchGestures}>
          <View style={styles.gesturePlane}>
            <View style={[videoFrameStyle, { transform: [{ scale: zoomScale }] }]}>
              <VideoView
                player={player}
                style={styles.video}
                contentFit={resizeContentFit}
                nativeControls={false}
                allowsPictureInPicture
                surfaceType="textureView"
              />
            </View>
          </View>
        </GestureDetector>
        {brightness < 0.22 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.softwareDimmer, { opacity: (0.22 - brightness) * 0.5 }]} />}

        {isBuffering && !playbackError && (
          <View pointerEvents="none" style={styles.centerStatus}>
            <ActivityIndicator size="large" color={THEME.colors.accentCyan} />
            <Text style={styles.statusText}>Loading video…</Text>
          </View>
        )}

        {activeSubtitleCue && !selectedNativeSubtitleId && (
          <View pointerEvents="none" style={[styles.subtitleDock, { bottom: isHudVisible ? (isLandscape ? 112 : 185) : 42 }]}>
            <Text style={[styles.subtitleText, { fontSize: subtitleFontSize }]}>{activeSubtitleCue.text}</Text>
          </View>
        )}

        {gestureToast && (
          <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(200)} style={styles.toastWrap} pointerEvents="none">
            <GlassPanel style={styles.toastCard} intensity={60} heavy>
              <Text style={styles.toastTitle}>{gestureToast.title}</Text>
              {gestureToast.detail && <Text style={styles.toastDetail}>{gestureToast.detail}</Text>}
              {typeof gestureToast.value === 'number' && (
                <View style={styles.toastTrack}><View style={[styles.toastFill, { width: (Math.max(0, Math.min(1, gestureToast.value)) * 100) + '%' }]} /></View>
              )}
            </GlassPanel>
          </Animated.View>
        )}

        {playbackError && (
          <Animated.View entering={FadeIn.duration(180)} style={styles.errorWrap}>
            <GlassPanel style={styles.errorCard} intensity={45} heavy activeBorder>
              <Ionicons name="alert-circle-outline" size={24} color="#FCA5A5" />
              <View style={styles.errorCopy}>
                <Text style={styles.errorTitle}>Playback failed</Text>
                <Text style={styles.errorMessage}>{playbackError}</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Retry playback" onPress={() => { setPlaybackError(null); player.currentTime = positionRef.current / 1000; player.play(); }} style={styles.errorAction}>
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Close playback error" onPress={() => setPlaybackError(null)} style={styles.errorAction}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </GlassPanel>
          </Animated.View>
        )}

        {isHudVisible && !isLocked && (
          <View style={styles.hudLayer} pointerEvents="box-none">
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
              <GlassPanel style={styles.topBar} intensity={42} heavy>
                <TouchableOpacity accessibilityLabel="Exit video player" onPress={exitPlayer} style={styles.topIcon}>
                  <Ionicons name="chevron-back" size={22} color={THEME.colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.titleArea}>
                  <Text numberOfLines={1} style={styles.mediaTitle}>{video.title}</Text>
                  <Text numberOfLines={1} style={styles.mediaMeta}>{video.isNetworkStream ? 'Network stream' : video.folderName} · {playbackSpeed}x</Text>
                </View>
                <TouchableOpacity accessibilityLabel="Picture in picture" onPress={startPictureInPicture} style={styles.topIcon}>
                  <Ionicons name="albums-outline" size={19} color={THEME.colors.accentCyan} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="Minimize player" onPress={minimizePlayer} style={styles.topIcon}>
                  <Ionicons name="chevron-down" size={21} color={THEME.colors.accentCyan} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="Change orientation" onPress={toggleOrientation} style={styles.topIcon}>
                  <Ionicons name="phone-landscape-outline" size={19} color={THEME.colors.accentCyan} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="Playback and subtitle settings" onPress={() => setSettingsOpen(true)} style={styles.topIcon}>
                  <Ionicons name="options-outline" size={20} color={THEME.colors.textPrimary} />
                </TouchableOpacity>
              </GlassPanel>
            </Animated.View>

            <View style={styles.hudSpacer} />

            <Animated.View entering={SlideInDown.duration(220)} exiting={SlideOutDown.duration(170)}>
              <GlassPanel style={styles.bottomBar} intensity={48} heavy>
                <View style={styles.quickTools}>
                  <TouchableOpacity style={[styles.tool, abRepeat.pointAMs !== null && styles.toolActive]} onPress={() => {
                    if (abRepeat.pointAMs === null) usePlayerStore.getState().setABPointA(positionMs);
                    else if (abRepeat.pointBMs === null) {
                      if (positionMs <= abRepeat.pointAMs + 500) Alert.alert('Choose a later point', 'Point B must be at least half a second after point A.');
                      else usePlayerStore.getState().setABPointB(positionMs);
                    } else usePlayerStore.getState().clearABRepeat();
                  }}>
                    <Ionicons name="repeat-outline" size={14} color={THEME.colors.accentCyan} />
                    <Text numberOfLines={1} style={styles.toolText}>{repeatLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tool} onPress={() => usePlayerStore.getState().cycleAspectRatio()}>
                    <Ionicons name="scan-outline" size={14} color={THEME.colors.accentCyan} />
                    <Text style={styles.toolText}>{aspectRatio}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tool} onPress={() => {
                    const next = SPEED_STEPS[(SPEED_STEPS.indexOf(playbackSpeed) + 1) % SPEED_STEPS.length];
                    usePlayerStore.getState().setPlaybackSpeed(next);
                  }}>
                    <Ionicons name="speedometer-outline" size={14} color={THEME.colors.accentCyan} />
                    <Text style={styles.toolText}>{playbackSpeed}x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tool} onPress={() => setSettingsOpen(true)}>
                    <Ionicons name="chatbox-ellipses-outline" size={14} color={THEME.colors.accentCyan} />
                    <Text style={styles.toolText}>Subtitles</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.seekRow}>
                  <Text style={styles.timecode}>{formatDurationMs(positionMs)}</Text>
                  <Pressable
                    accessibilityRole="adjustable"
                    accessibilityLabel="Seek video"
                    style={styles.seekHitbox}
                    onLayout={(event) => setProgressWidth(Math.max(1, event.nativeEvent.layout.width))}
                    onPress={(event) => seekToMs((event.nativeEvent.locationX / progressWidth) * (durationMs || positionRef.current + 60000))}
                  >
                    <View style={styles.seekTrack}>
                      <View style={[styles.seekFill, { width: (progress * 100) + '%' }]} />
                      {abRepeat.pointAMs !== null && durationMs > 0 && <View style={[styles.abMark, { left: (abRepeat.pointAMs / durationMs * 100) + '%' }]} />}
                      {abRepeat.pointBMs !== null && durationMs > 0 && <View style={[styles.abMarkB, { left: (abRepeat.pointBMs / durationMs * 100) + '%' }]} />}
                    </View>
                  </Pressable>
                  <Text style={styles.timecode}>−{formatDurationMs(Math.max(0, durationMs - positionMs))}</Text>
                </View>

                <View style={styles.transportRow}>
                  <TouchableOpacity accessibilityLabel={isLocked ? 'Unlock controls' : 'Lock controls'} style={styles.transportIcon} onPress={() => usePlayerStore.getState().toggleLock()}>
                    <Ionicons name={isLocked ? 'lock-closed-outline' : 'lock-open-outline'} size={19} color={THEME.colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="Previous video" style={styles.transportIcon} onPress={() => {
                    if (!usePlayerStore.getState().playPrevInQueue()) showToast('Start of queue');
                  }}>
                    <Ionicons name="play-skip-back" size={20} color={THEME.colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="Rewind 10 seconds" style={styles.transportIcon} onPress={() => seekToMs(positionMs - 10000)}>
                    <Ionicons name="play-back" size={22} color={THEME.colors.accentCyan} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'} style={styles.playOrb} onPress={togglePlayPause}>
                    <LinearGradient colors={['#38BDF8', '#2563EB']} style={styles.playOrbGradient}>
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={25} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="Forward 10 seconds" style={styles.transportIcon} onPress={() => seekToMs(positionMs + 10000)}>
                    <Ionicons name="play-forward" size={22} color={THEME.colors.accentCyan} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="Next video" style={styles.transportIcon} onPress={() => {
                    if (!usePlayerStore.getState().playNextInQueue()) showToast('End of queue');
                  }}>
                    <Ionicons name="play-skip-forward" size={20} color={THEME.colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'} style={styles.transportIcon} onPress={() => usePlayerStore.getState().toggleMute()}>
                    <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={19} color={isMuted ? '#FCA5A5' : THEME.colors.accentCyan} />
                  </TouchableOpacity>
                </View>
                {sleepTimerRemainingSec !== null && (
                  <Text style={styles.sleepHint}>Sleep timer · {formatDurationMs(sleepTimerRemainingSec * 1000)} remaining</Text>
                )}
              </GlassPanel>
            </Animated.View>
          </View>
        )}

        {isHudVisible && isLocked && (
          <Animated.View entering={FadeIn.duration(160)} style={styles.lockedWrap}>
            <TouchableOpacity onPress={() => usePlayerStore.getState().toggleLock()} style={styles.unlockButton}>
              <Ionicons name="lock-closed" size={18} color={THEME.colors.accentCyan} />
              <Text style={styles.unlockText}>Controls locked · tap to unlock</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </View>

      {isPlaying && !isMinimized && <KeepAwakeGate />}
      <VlcControlModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        nativeSubtitleTracks={nativeSubtitleTracks}
        selectedNativeSubtitleId={selectedNativeSubtitleId}
        onSelectNativeSubtitle={onNativeSubtitleSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#01040A', zIndex: 50 },
  videoStage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#01040A', overflow: 'hidden' },
  gesturePlane: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  videoFrame: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  videoFrame169: { width: '100%', aspectRatio: 16 / 9, maxHeight: '100%', justifyContent: 'center', alignItems: 'center' },
  videoFrame43: { width: '100%', aspectRatio: 4 / 3, maxHeight: '100%', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  softwareDimmer: { backgroundColor: '#000000' },
  centerStatus: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusText: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '600' },
  subtitleDock: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  subtitleText: { color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.62)', textAlign: 'center', fontWeight: '700', paddingHorizontal: 11, paddingVertical: 5, overflow: 'hidden', borderRadius: 5, textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  toastWrap: { position: 'absolute', alignSelf: 'center', top: '43%', minWidth: 156, maxWidth: '80%' },
  toastCard: { borderRadius: 17, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  toastTitle: { color: THEME.colors.textPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  toastDetail: { color: THEME.colors.accentCyan, fontSize: 11, marginTop: 4, fontWeight: '700' },
  toastTrack: { width: 125, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginTop: 9 },
  toastFill: { height: '100%', backgroundColor: THEME.colors.accentCyan },
  errorWrap: { position: 'absolute', top: 85, left: 14, right: 14 },
  errorCard: { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 17 },
  errorCopy: { flex: 1, gap: 4 },
  errorTitle: { color: THEME.colors.textPrimary, fontSize: 13, fontWeight: '800' },
  errorMessage: { color: THEME.colors.textSecondary, fontSize: 10, lineHeight: 15 },
  errorAction: { width: 31, height: 31, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  hudLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 7, borderRadius: 17 },
  topIcon: { width: 35, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.035)' },
  titleArea: { flex: 1, paddingHorizontal: 5, gap: 3 },
  mediaTitle: { color: THEME.colors.textPrimary, fontSize: 12, fontWeight: '800' },
  mediaMeta: { color: THEME.colors.accentCyan, fontSize: 9, fontWeight: '600' },
  hudSpacer: { flex: 1 },
  bottomBar: { padding: 10, borderRadius: 19, gap: 9, marginBottom: 2 },
  quickTools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tool: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 99, backgroundColor: 'rgba(3,11,26,0.65)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.14)' },
  toolActive: { backgroundColor: 'rgba(37,99,235,0.22)', borderColor: 'rgba(56,189,248,0.42)' },
  toolText: { color: THEME.colors.textPrimary, fontSize: 9, fontWeight: '700' },
  seekRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  timecode: { color: THEME.colors.textPrimary, fontSize: 9, fontVariant: ['tabular-nums'] },
  seekHitbox: { flex: 1, paddingVertical: 8, justifyContent: 'center' },
  seekTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 5, overflow: 'visible', position: 'relative' },
  seekFill: { height: '100%', borderRadius: 5, backgroundColor: THEME.colors.accentCyan },
  abMark: { position: 'absolute', height: 9, width: 3, top: -2, backgroundColor: '#FBBF24', borderRadius: 2 },
  abMarkB: { position: 'absolute', height: 9, width: 3, top: -2, backgroundColor: '#F472B6', borderRadius: 2 },
  transportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  transportIcon: { flex: 1, minWidth: 28, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  playOrb: { width: 49, height: 49, borderRadius: 25, overflow: 'hidden', borderWidth: 1.4, borderColor: 'rgba(186,230,253,0.85)' },
  playOrbGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sleepHint: { color: THEME.colors.textMuted, fontSize: 9, textAlign: 'right' },
  lockedWrap: { position: 'absolute', top: 18, left: 18 },
  unlockButton: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10, backgroundColor: 'rgba(5,11,26,0.9)', borderRadius: 99, borderWidth: 1, borderColor: THEME.colors.borderSpecular },
  unlockText: { color: THEME.colors.textPrimary, fontSize: 11, fontWeight: '700' },
  minimizedLayer: { position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 70 },
  miniCard: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 9, borderRadius: 17 },
  miniVideoFrame: { width: 92, height: 55, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000000' },
  miniVideo: { width: '100%', height: '100%' },
  miniExpandBadge: { position: 'absolute', right: 3, bottom: 3, padding: 3, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.65)' },
  miniMeta: { flex: 1, gap: 4 },
  miniTitle: { color: THEME.colors.textPrimary, fontSize: 11, fontWeight: '800' },
  miniTime: { color: THEME.colors.accentCyan, fontSize: 9 },
  miniTrack: { height: 3, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' },
  miniFill: { height: '100%', backgroundColor: THEME.colors.accentCyan },
  miniAction: { width: 31, height: 36, justifyContent: 'center', alignItems: 'center' },
});
