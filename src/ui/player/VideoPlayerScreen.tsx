import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScaledSize,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { HardwareService } from '../../services/hardware.service';
import { SubtitleService } from '../../services/subtitle.service';
import {
  calculateHorizontalSeekTarget,
  calculateVerticalSwipeValue,
  formatDurationMs,
  formatSignedDeltaMs,
} from '../../engine/gesture.math';
import { GlassPanel } from '../common/GlassPanel';
import { VlcControlModal } from './VlcControlModal';
import { THEME } from '../../core/constants/theme';

export const VideoPlayerScreen: React.FC = () => {
  useKeepAwake();

  
  const [dimensions, setDimensions] = useState<ScaledSize>(() => Dimensions.get('window'));
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [gestureOverlay, setGestureOverlay] = useState<{
    type: 'brightness' | 'volume' | 'seek' | 'zoom' | null;
    label: string;
    subLabel?: string;
    valuePct?: number;
  }>({ type: null, label: '' });

  const gestureStartRef = useRef({
    brightness: 0.75,
    volume: 1.0,
    positionMs: 0,
    zoom: 1.0,
    side: 'left' as 'left' | 'right',
    mode: 'none' as 'none' | 'vertical' | 'horizontal',
  });

  const {
    activeVideo,
    isMinimized,
    isPlaying,
    positionMs,
    durationMs,
    isBuffering,
    isHudVisible,
    isLocked,
    playbackSpeed,
    volumeBoost,
    isMuted,
    brightness,
    decoderMode,
    aspectRatio,
    zoomScale,
    abRepeat,
    subtitleTracks,
    activeSubtitleId,
    subtitleOffsetMs,
    subtitleFontSize,
    sleepTimerRemainingSec,
    isBackgroundAudioEnabled,
    minimizePlayer,
    expandPlayer,
    closePlayer,
    setPlaybackStatus,
    toggleHud,
    toggleLock,
    setPlaybackSpeed,
    setVolumeBoost,
    toggleMute,
    setBrightness,
    cycleDecoderMode,
    cycleAspectRatio,
    setZoomScale,
    setABPointA,
    setABPointB,
    clearABRepeat,
    tickSleepTimer,
    playNextInQueue,
    playPrevInQueue,
  } = usePlayerStore();

  const recordPlaybackProgress = useLibraryStore((s) => s.recordPlaybackProgress);

  useEffect(() => {
    const sub = Dimensions.addEventListener(
      'change',
      ({ window }: { window: ScaledSize }) => {
        setDimensions(window);
        setIsLandscape(window.width > window.height);
      }
    );
    HardwareService.getBrightness().then((b) => setBrightness(b));
    return () => {
      sub.remove();
      HardwareService.unlockOrientation();
    };
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: isBackgroundAudioEnabled,
      shouldDuckAndroid: true,
    }).catch(() => {});
  }, [isBackgroundAudioEnabled]);

  useEffect(() => {
    if (sleepTimerRemainingSec === null) return;
    const timer = setInterval(() => {
      const expired = tickSleepTimer();
      if (expired && videoRef.current) {
        player.pause().catch(() => {});
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sleepTimerRemainingSec]);

  const activeSubtitleCue = useMemo(() => {
    if (!activeSubtitleId) return null;
    const track = subtitleTracks.find((t) => t.id === activeSubtitleId);
    if (!track) return null;
    return SubtitleService.findActiveCue(track.cues, positionMs, subtitleOffsetMs);
  }, [activeSubtitleId, subtitleTracks, positionMs, subtitleOffsetMs]);

  const seekToMs = async (targetMs: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(durationMs || targetMs, targetMs));
    setPlaybackStatus({ positionMs: clamped });
    try {
      await (player.currentTime = clamped / 1000);
    } catch {
      return;
    }
  };

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        await player.pause();
      } else {
        await player.play();
      }
    } catch {
      return;
    }
  };

  const handleToggleOrientation = async () => {
    if (isLandscape) {
      await HardwareService.lockPortrait();
      setIsLandscape(false);
    } else {
      await HardwareService.lockLandscape();
      setIsLandscape(true);
    }
  };

  const saveCurrentProgress = async () => {
    if (activeVideo && positionMs > 1000) {
      await recordPlaybackProgress({
        videoId: activeVideo.id,
        uri: activeVideo.uri,
        title: activeVideo.title,
        lastPositionMs: positionMs,
        durationMs: durationMs || activeVideo.duration,
        updatedAt: Date.now(),
        playbackSpeed,
        subtitleOffsetMs,
        audioOffsetMs: 0,
      });
    }
  };

  const handleMinimizeToPip = async () => {
    await saveCurrentProgress();
    await HardwareService.lockPortrait();
    setIsLandscape(false);
    minimizePlayer();
  };

  const handleExitPlayer = async () => {
    await saveCurrentProgress();
    await HardwareService.unlockOrientation();
    closePlayer();
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setPlaybackError(`Decoder (${decoderMode}) Error: ${status.error}`);
      }
      return;
    }

    const currentPos = status.positionMillis || 0;
    const totalDur = status.durationMillis || activeVideo?.duration || 0;

    if (
      abRepeat.enabled &&
      abRepeat.pointAMs !== null &&
      abRepeat.pointBMs !== null &&
      currentPos >= abRepeat.pointBMs
    ) {
      videoRef.current?.setPositionAsync(abRepeat.pointAMs).catch(() => {});
      return;
    }

    setPlaybackStatus({
      isPlaying: status.isPlaying,
      positionMs: currentPos,
      durationMs: totalDur,
      isBuffering: status.isBuffering,
    });

    if (status.didJustFinish) {
      const next = playNextInQueue();
      if (!next) {
        setPlaybackStatus({ isPlaying: false });
      }
    }
  };

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .enabled(!isLocked && !isMinimized)
    .minDistance(12)
    .onBegin((e) => {
      gestureStartRef.current = {
        brightness,
        volume: volumeBoost,
        positionMs,
        zoom: zoomScale,
        side: e.x < dimensions.width / 2 ? 'left' : 'right',
        mode: 'none',
      };
    })
    .onUpdate((e) => {
      if (gestureStartRef.current.mode === 'none') {
        gestureStartRef.current.mode =
          Math.abs(e.translationX) > Math.abs(e.translationY) * 1.15
            ? 'horizontal'
            : 'vertical';
      }

      if (gestureStartRef.current.mode === 'horizontal') {
        const { targetMs, deltaMs } = calculateHorizontalSeekTarget(
          gestureStartRef.current.positionMs,
          e.translationX,
          dimensions.width,
          durationMs || 60000
        );
        setGestureOverlay({
          type: 'seek',
          label: formatDurationMs(targetMs),
          subLabel: `${formatSignedDeltaMs(deltaMs)} • [${decoderMode}]`,
          valuePct: durationMs > 0 ? Math.round((targetMs / durationMs) * 100) : 0,
        });
      } else {
        if (gestureStartRef.current.side === 'left') {
          const nextBright = calculateVerticalSwipeValue(
            gestureStartRef.current.brightness,
            e.translationY,
            dimensions.height,
            1.0
          );
          setBrightness(nextBright);
          HardwareService.setBrightness(nextBright);
          setGestureOverlay({
            type: 'brightness',
            label: `Brightness ${Math.round(nextBright * 100)}%`,
            valuePct: Math.round(nextBright * 100),
          });
        } else {
          const nextVol = calculateVerticalSwipeValue(
            gestureStartRef.current.volume,
            e.translationY,
            dimensions.height,
            2.0
          );
          setVolumeBoost(nextVol);
          setGestureOverlay({
            type: 'volume',
            label:
              nextVol > 1.0
                ? `VLC Boost ${Math.round(nextVol * 100)}%`
                : `Volume ${Math.round(nextVol * 100)}%`,
            subLabel: nextVol > 1.0 ? 'Pre-Amp Overdrive Active' : undefined,
            valuePct: Math.round((nextVol / 2.0) * 100),
          });
        }
      }
    })
    .onEnd((e) => {
      if (gestureStartRef.current.mode === 'horizontal') {
        const { targetMs } = calculateHorizontalSeekTarget(
          gestureStartRef.current.positionMs,
          e.translationX,
          dimensions.width,
          durationMs || 60000
        );
        seekToMs(targetMs);
      }
      setTimeout(() => setGestureOverlay({ type: null, label: '' }), 350);
    });

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .enabled(!isLocked && !isMinimized)
    .onBegin(() => {
      gestureStartRef.current.zoom = zoomScale;
    })
    .onUpdate((e) => {
      const nextZoom = Math.max(
        0.5,
        Math.min(2.2, Number((gestureStartRef.current.zoom * e.scale).toFixed(2)))
      );
      setZoomScale(nextZoom);
      setGestureOverlay({
        type: 'zoom',
        label: `Zoom ${Math.round(nextZoom * 100)}%`,
        subLabel: `Aspect: ${aspectRatio}`,
      });
    })
    .onEnd(() => {
      setTimeout(() => setGestureOverlay({ type: null, label: '' }), 400);
    });

  const doubleTapGesture = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .enabled(!isLocked && !isMinimized)
    .onEnd((e) => {
      const third = dimensions.width / 3;
      if (e.x < third) {
        const target = Math.max(0, positionMs - 10000);
        seekToMs(target);
        setGestureOverlay({ type: 'seek', label: '-10s Rewind' });
      } else if (e.x > third * 2) {
        const target = Math.min(durationMs, positionMs + 10000);
        seekToMs(target);
        setGestureOverlay({ type: 'seek', label: '+10s Fast-Forward' });
      } else {
        togglePlayPause();
      }
      setTimeout(() => setGestureOverlay({ type: null, label: '' }), 550);
    });

  const singleTapGesture = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(1)
    .enabled(!isMinimized)
    .onEnd(() => {
      toggleHud();
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture)
  );

  const handleSubtitleJump = (direction: 'prev' | 'next') => {
    if (!activeSubtitleId) return;
    const track = subtitleTracks.find((t) => t.id === activeSubtitleId);
    if (!track) return;
    const target = SubtitleService.findAdjacentCueTimestamp(track.cues, positionMs, direction);
    if (target !== null) {
      seekToMs(target);
    }
  };

  if (!activeVideo) return null;

  const resizeModeMap: Record<string, ResizeMode> = {
    FIT: ResizeMode.CONTAIN,
    FILL: ResizeMode.COVER,
    STRETCH: ResizeMode.STRETCH,
    '16:9': ResizeMode.CONTAIN,
    '4:3': ResizeMode.CONTAIN,
  };

  const progressRatio = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;

  if (isMinimized) {
    return (
      <View style={styles.miniDockWrapper} pointerEvents="box-none">
        <GlassPanel style={styles.miniDockCard} intensity={55} heavy activeBorder>
          <TouchableOpacity
            style={styles.miniVideoPreview}
            activeOpacity={0.9}
            onPress={expandPlayer}
          >
            <VideoView
        player={player}
        style={style}
        contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
        nativeControls={false}
      />
            <View style={styles.miniExpandBadge}>
              <Ionicons name="expand-outline" size={12} color={THEME.colors.textPrimary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.miniMetaBox} onPress={expandPlayer}>
            <Text style={styles.miniTitle} numberOfLines={1}>
              {activeVideo.title}
            </Text>
            <Text style={styles.miniTime}>
              {formatDurationMs(positionMs)} / {formatDurationMs(durationMs)} • {decoderMode}
            </Text>
            <View style={styles.miniProgressTrack}>
              <View style={[styles.miniProgressFill, { width: `${progressRatio * 100}%` }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.miniIconBtn} onPress={togglePlayPause}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={THEME.colors.accentCyan}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.miniIconBtn} onPress={handleExitPlayer}>
            <Ionicons name="close" size={20} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </GlassPanel>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenOverlay}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.viewportWrapper}>
          <View
            style={[
              styles.videoTransformBox,
              {
                transform: [{ scale: zoomScale }],
                aspectRatio:
                  aspectRatio === '16:9' ? 16 / 9 : aspectRatio === '4:3' ? 4 / 3 : undefined,
              },
            ]}
          >
            <VideoView
        player={player}
        style={style}
        contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
        nativeControls={false}
      />
          </View>

          {brightness < 0.25 && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `rgba(0,0,0,${(0.28 - brightness) * 2.4})` },
              ]}
            />
          )}

          {isBuffering && (
            <View style={styles.centerHudIndicator} pointerEvents="none">
              <ActivityIndicator size="large" color={THEME.colors.accentCyan} />
              <Text style={styles.bufferingText}>Buffering [{decoderMode}]...</Text>
            </View>
          )}

          {gestureOverlay.type && (
            <View style={styles.centerHudIndicator} pointerEvents="none">
              <GlassPanel style={styles.gestureToast} heavy activeBorder>
                <Ionicons
                  name={
                    gestureOverlay.type === 'brightness'
                      ? 'sunny-outline'
                      : gestureOverlay.type === 'volume'
                      ? 'volume-high-outline'
                      : gestureOverlay.type === 'zoom'
                      ? 'expand-outline'
                      : 'time-outline'
                  }
                  size={24}
                  color={THEME.colors.accentCyan}
                />
                <Text style={styles.gestureMainText}>{gestureOverlay.label}</Text>
                {gestureOverlay.subLabel && (
                  <Text style={styles.gestureSubText}>{gestureOverlay.subLabel}</Text>
                )}
                {typeof gestureOverlay.valuePct === 'number' && (
                  <View style={styles.gestureMeterTrack}>
                    <View
                      style={[
                        styles.gestureMeterFill,
                        {
                          width: `${Math.min(100, gestureOverlay.valuePct)}%`,
                          backgroundColor:
                            gestureOverlay.type === 'volume' && volumeBoost > 1.0
                              ? THEME.colors.statusWarning
                              : THEME.colors.accentElectric,
                        },
                      ]}
                    />
                  </View>
                )}
              </GlassPanel>
            </View>
          )}
        </View>
      </GestureDetector>

      {activeSubtitleCue && (
        <View style={styles.subtitleContainer} pointerEvents="box-none">
          <GlassPanel style={styles.subtitlePill} intensity={25}>
            <View style={styles.subtitleControlsRow}>
              <TouchableOpacity onPress={() => handleSubtitleJump('prev')}>
                <Ionicons name="play-skip-back" size={14} color={THEME.colors.accentCyan} />
              </TouchableOpacity>
              <Text style={[styles.subtitleText, { fontSize: subtitleFontSize }]}>
                {activeSubtitleCue.text}
              </Text>
              <TouchableOpacity onPress={() => handleSubtitleJump('next')}>
                <Ionicons name="play-skip-forward" size={14} color={THEME.colors.accentCyan} />
              </TouchableOpacity>
            </View>
          </GlassPanel>
        </View>
      )}

      {playbackError && (
        <View style={styles.errorBanner}>
          <GlassPanel style={styles.errorCard} heavy>
            <Ionicons name="warning-outline" size={20} color={THEME.colors.statusWarning} />
            <Text style={styles.errorText} numberOfLines={2}>
              {playbackError}
            </Text>
            <TouchableOpacity
              style={styles.errorSwitchBtn}
              onPress={() => {
                setPlaybackError(null);
                cycleDecoderMode();
              }}
            >
              <Text style={styles.errorSwitchText}>Switch Decoder ({decoderMode})</Text>
            </TouchableOpacity>
          </GlassPanel>
        </View>
      )}

      {isHudVisible && isLocked && (
        <View style={styles.lockedOverlay} pointerEvents="box-none">
          <TouchableOpacity style={styles.unlockFloatingBtn} onPress={toggleLock}>
            <Ionicons name="lock-closed" size={22} color={THEME.colors.accentCyan} />
            <Text style={styles.unlockText}>Touch Locked • Tap to Unlock</Text>
          </TouchableOpacity>
        </View>
      )}

      {isHudVisible && !isLocked && (
        <View style={styles.hudContainer} pointerEvents="box-none">
          <GlassPanel style={styles.topHudBar} intensity={40} heavy>
            <TouchableOpacity onPress={handleExitPlayer} style={styles.hudIconBtn}>
              <Ionicons name="arrow-back" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.titleBlock}>
              <Text style={styles.videoHeaderTitle} numberOfLines={1}>
                {activeVideo.title}
              </Text>
              <Text style={styles.videoHeaderSub}>
                {activeVideo.folderName} • {playbackSpeed.toFixed(2)}x
                {volumeBoost > 1.0 ? ` • Boost ${Math.round(volumeBoost * 100)}%` : ''}
              </Text>
            </View>

            <TouchableOpacity style={styles.decoderChip} onPress={cycleDecoderMode}>
              <Text style={styles.decoderChipText}>{decoderMode}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hudIconBtn} onPress={handleMinimizeToPip}>
              <Ionicons name="chevron-down" size={20} color={THEME.colors.accentCyan} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.hudIconBtn} onPress={handleToggleOrientation}>
              <Ionicons name="phone-landscape-outline" size={19} color={THEME.colors.accentCyan} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.hudIconBtn} onPress={() => setIsLabOpen(true)}>
              <Ionicons name="options-outline" size={20} color={THEME.colors.accentCyan} />
            </TouchableOpacity>
          </GlassPanel>

          <GlassPanel style={styles.bottomHudBar} intensity={45} heavy>
            <View style={styles.quickPillsRow}>
              <TouchableOpacity
                style={[styles.toolPill, abRepeat.pointAMs !== null && styles.toolPillActive]}
                onPress={() => {
                  if (abRepeat.pointAMs === null) {
                    setABPointA(positionMs);
                  } else if (abRepeat.pointBMs === null) {
                    setABPointB(positionMs);
                  } else {
                    clearABRepeat();
                  }
                }}
              >
                <Ionicons name="repeat-outline" size={14} color={THEME.colors.accentCyan} />
                <Text style={styles.toolPillText}>
                  {abRepeat.pointAMs === null
                    ? 'A-B Loop'
                    : abRepeat.pointBMs === null
                    ? `A: ${formatDurationMs(abRepeat.pointAMs)} -> Set B`
                    : `Loop ${formatDurationMs(abRepeat.pointAMs)}-${formatDurationMs(abRepeat.pointBMs)}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolPill} onPress={cycleAspectRatio}>
                <Ionicons name="resize-outline" size={14} color={THEME.colors.accentCyan} />
                <Text style={styles.toolPillText}>{aspectRatio}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolPill}
                onPress={() => {
                  const next =
                    playbackSpeed >= 2.0 ? 1.0 : Number((playbackSpeed + 0.25).toFixed(2));
                  setPlaybackSpeed(next);
                }}
              >
                <Ionicons name="speedometer-outline" size={14} color={THEME.colors.accentCyan} />
                <Text style={styles.toolPillText}>{playbackSpeed.toFixed(2)}x</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolPill} onPress={() => setIsLabOpen(true)}>
                <Ionicons name="chatbox-ellipses-outline" size={14} color={THEME.colors.accentCyan} />
                <Text style={styles.toolPillText}>Sub / EQ</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.seekBarRow}>
              <Text style={styles.timeCodeText}>{formatDurationMs(positionMs)}</Text>

              <Pressable
                style={styles.progressTrackHitbox}
                onPress={(e) => {
                  const width = dimensions.width - 150;
                  const ratio = Math.max(
                    0,
                    Math.min(1, e.nativeEvent.locationX / Math.max(width, 100))
                  );
                  seekToMs(Math.round(ratio * durationMs));
                }}
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
                  {abRepeat.pointAMs !== null && durationMs > 0 && (
                    <View
                      style={[
                        styles.abMarker,
                        { left: `${(abRepeat.pointAMs / durationMs) * 100}%` },
                      ]}
                    />
                  )}
                  {abRepeat.pointBMs !== null && durationMs > 0 && (
                    <View
                      style={[
                        styles.abMarker,
                        { left: `${(abRepeat.pointBMs / durationMs) * 100}%` },
                      ]}
                    />
                  )}
                </View>
              </Pressable>

              <Text style={styles.timeCodeText}>
                -{formatDurationMs(Math.max(0, durationMs - positionMs))}
              </Text>
            </View>

            <View style={styles.transportRow}>
              <TouchableOpacity style={styles.hudIconBtn} onPress={toggleLock}>
                <Ionicons name="lock-open-outline" size={20} color={THEME.colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.hudIconBtn} onPress={playPrevInQueue}>
                <Ionicons name="play-skip-back" size={22} color={THEME.colors.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.hudIconBtn}
                onPress={() => seekToMs(Math.max(0, positionMs - 10000))}
              >
                <Ionicons name="play-back" size={22} color={THEME.colors.accentCyan} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playPauseMainOrb}
                onPress={togglePlayPause}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={28}
                  color={THEME.colors.textPrimary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.hudIconBtn}
                onPress={() => seekToMs(Math.min(durationMs, positionMs + 10000))}
              >
                <Ionicons name="play-forward" size={22} color={THEME.colors.accentCyan} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.hudIconBtn} onPress={playNextInQueue}>
                <Ionicons name="play-skip-forward" size={22} color={THEME.colors.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.hudIconBtn} onPress={toggleMute}>
                <Ionicons
                  name={isMuted ? 'volume-mute' : 'volume-high'}
                  size={20}
                  color={isMuted ? THEME.colors.statusDanger : THEME.colors.accentCyan}
                />
              </TouchableOpacity>
            </View>
          </GlassPanel>
        </View>
      )}

      <VlcControlModal visible={isLabOpen} onClose={() => setIsLabOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
    zIndex: 50,
  },
  viewportWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  videoTransformBox: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoElement: {
    width: '100%',
    height: '100%',
  },
  centerHudIndicator: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingText: {
    color: THEME.colors.accentCyan,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  gestureToast: {
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.md,
    alignItems: 'center',
    minWidth: 170,
    gap: 4,
  },
  gestureMainText: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: THEME.typography.monoFamily,
  },
  gestureSubText: {
    color: THEME.colors.accentCyan,
    fontSize: 11,
    fontWeight: '700',
  },
  gestureMeterTrack: {
    width: 130,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  gestureMeterFill: {
    height: '100%',
  },
  subtitleContainer: {
    position: 'absolute',
    bottom: 145,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  subtitlePill: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 8,
  },
  subtitleControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subtitleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  errorBanner: {
    position: 'absolute',
    top: 85,
    left: 20,
    right: 20,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.md,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  errorSwitchBtn: {
    backgroundColor: THEME.colors.accentCobalt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
  },
  errorSwitchText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 28,
  },
  unlockFloatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.glassSurfaceHeavy,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.accentCyan,
  },
  unlockText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  hudContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
    padding: THEME.spacing.md,
  },
  topHudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    gap: 8,
    marginTop: 18,
  },
  titleBlock: {
    flex: 1,
  },
  videoHeaderTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  videoHeaderSub: {
    color: THEME.colors.accentCyan,
    fontSize: 11,
    fontFamily: THEME.typography.monoFamily,
  },
  decoderChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.accentCobalt,
    borderWidth: 1,
    borderColor: THEME.colors.accentCyan,
  },
  decoderChipText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  hudIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomHudBar: {
    padding: THEME.spacing.md,
    gap: 10,
    marginBottom: 8,
  },
  quickPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
    backgroundColor: 'rgba(4, 8, 18, 0.7)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
  },
  toolPillActive: {
    backgroundColor: THEME.colors.accentCobalt,
    borderColor: THEME.colors.accentCyan,
  },
  toolPillText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  seekBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeCodeText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontFamily: THEME.typography.monoFamily,
  },
  progressTrackHitbox: {
    flex: 1,
    paddingVertical: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.colors.accentElectric,
  },
  abMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: THEME.colors.statusWarning,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  playPauseMainOrb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: THEME.colors.accentCobalt,
    borderWidth: 1.5,
    borderColor: THEME.colors.accentCyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniDockWrapper: {
    position: 'absolute',
    left: THEME.spacing.md,
    right: THEME.spacing.md,
    bottom: THEME.spacing.md,
    zIndex: 60,
  },
  miniDockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 10,
  },
  miniVideoPreview: {
    width: 96,
    height: 56,
    borderRadius: THEME.radius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
  },
  miniExpandBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(4, 8, 18, 0.78)',
    padding: 3,
    borderRadius: 4,
  },
  miniMetaBox: {
    flex: 1,
    gap: 3,
  },
  miniTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  miniTime: {
    color: THEME.colors.accentCyan,
    fontSize: 10,
    fontFamily: THEME.typography.monoFamily,
  },
  miniProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    marginTop: 2,
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: THEME.colors.accentElectric,
  },
  miniIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.glassSurfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
