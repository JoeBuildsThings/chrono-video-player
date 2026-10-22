import React, { useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SubtitleService } from '../../services/subtitle.service';
import { GlassPanel } from '../common/GlassPanel';
import { EQ_FREQUENCIES, EQ_PRESETS, THEME } from '../../core/constants/theme';

interface VlcControlModalProps {
  visible: boolean;
  onClose: () => void;
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
const SLEEP_OPTIONS = [null, 15, 30, 45, 60];
const GITHUB_PROFILE_URL = 'https://github.com/JoeBuildsThings';
const GITHUB_REPO_URL = 'https://github.com/JoeBuildsThings/chrono-video-player';

export const VlcControlModal: React.FC<VlcControlModalProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<'audio' | 'subtitles' | 'tools'>('audio');

  const {
    playbackSpeed,
    volumeBoost,
    subtitleTracks,
    activeSubtitleId,
    subtitleOffsetMs,
    subtitleFontSize,
    audioOffsetMs,
    activeEqPresetId,
    eqBands,
    sleepTimerRemainingSec,
    isBackgroundAudioEnabled,
    setPlaybackSpeed,
    setVolumeBoost,
    addSubtitleTrack,
    selectSubtitleTrack,
    adjustSubtitleOffset,
    setSubtitleFontSize,
    adjustAudioOffset,
    setEqPreset,
    setEqBandGain,
    setSleepTimer,
    toggleBackgroundAudio,
  } = usePlayerStore();

  const handleLoadExternalSubtitle = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const track = await SubtitleService.loadSubtitleFromUri(asset.uri, asset.name);
      addSubtitleTrack(track);
    } catch {
      return;
    }
  };

  const handleInjectDemoSubtitle = () => {
    const sampleSrt = `1
00:00:01,000 --> 00:00:06,000
[Chrono Subtitle Engine Active • Binary Search Sync]

2
00:00:06,500 --> 00:00:14,000
Swipe horizontally on subtitle text to jump between cues.

3
00:00:14,500 --> 00:00:25,000
Use the VLC Subtitle Lab to adjust sync offset in 50ms steps.`;
    const track = SubtitleService.parseSubtitleContent(sampleSrt, 'Chrono_Demo_Track.srt');
    addSubtitleTrack(track);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <GlassPanel style={styles.sheet} intensity={55} heavy activeBorder>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="options-outline" size={20} color={THEME.colors.accentCyan} />
              <Text style={styles.headerTitle}>VLC / MX ENGINE SETTINGS</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabPill, activeTab === 'audio' && styles.tabPillActive]}
              onPress={() => setActiveTab('audio')}
            >
              <Text style={[styles.tabText, activeTab === 'audio' && styles.tabTextActive]}>
                Audio & 200% EQ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabPill, activeTab === 'subtitles' && styles.tabPillActive]}
              onPress={() => setActiveTab('subtitles')}
            >
              <Text style={[styles.tabText, activeTab === 'subtitles' && styles.tabTextActive]}>
                Subtitles ({subtitleTracks.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabPill, activeTab === 'tools' && styles.tabPillActive]}
              onPress={() => setActiveTab('tools')}
            >
              <Text style={[styles.tabText, activeTab === 'tools' && styles.tabTextActive]}>
                Speed & Info
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {activeTab === 'audio' && (
              <View style={styles.section}>
                <Text style={styles.label}>
                  VLC SOFTWARE PRE-AMP BOOST: {Math.round(volumeBoost * 100)}%
                </Text>
                <View style={styles.boostRow}>
                  {[0.5, 1.0, 1.25, 1.5, 2.0].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.chip,
                        Math.abs(volumeBoost - val) < 0.05 && styles.chipActive,
                        val > 1.0 && styles.chipBoostWarning,
                      ]}
                      onPress={() => setVolumeBoost(val)}
                    >
                      <Text style={styles.chipText}>{Math.round(val * 100)}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>EQUALIZER PRESETS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.presetRow}>
                    {EQ_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset.id}
                        style={[
                          styles.chip,
                          activeEqPresetId === preset.id && styles.chipActive,
                        ]}
                        onPress={() => setEqPreset(preset.id, [...preset.bands])}
                      >
                        <Text style={styles.chipText}>{preset.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.eqBandsContainer}>
                  {EQ_FREQUENCIES.map((freq, idx) => (
                    <View key={freq} style={styles.eqColumn}>
                      <TouchableOpacity
                        style={styles.eqStepBtn}
                        onPress={() => setEqBandGain(idx, eqBands[idx] + 2)}
                      >
                        <Ionicons name="add" size={14} color={THEME.colors.accentCyan} />
                      </TouchableOpacity>
                      <Text style={styles.eqValue}>
                        {eqBands[idx] > 0 ? `+${eqBands[idx]}` : eqBands[idx]}dB
                      </Text>
                      <TouchableOpacity
                        style={styles.eqStepBtn}
                        onPress={() => setEqBandGain(idx, eqBands[idx] - 2)}
                      >
                        <Ionicons name="remove" size={14} color={THEME.colors.textSecondary} />
                      </TouchableOpacity>
                      <Text style={styles.eqFreq}>{freq}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.label}>
                  AUDIO TRACK SYNC OFFSET: {audioOffsetMs >= 0 ? `+${audioOffsetMs}` : audioOffsetMs} ms
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => adjustAudioOffset(-50)}
                  >
                    <Text style={styles.stepBtnText}>-50 ms</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => adjustAudioOffset(-audioOffsetMs)}
                  >
                    <Text style={styles.stepBtnText}>Reset (0 ms)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => adjustAudioOffset(50)}
                  >
                    <Text style={styles.stepBtnText}>+50 ms</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'subtitles' && (
              <View style={styles.section}>
                <View style={styles.subActionRow}>
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={handleLoadExternalSubtitle}
                  >
                    <Ionicons name="document-text-outline" size={16} color={THEME.colors.textPrimary} />
                    <Text style={styles.primaryActionText}>Load .SRT / .VTT File</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={handleInjectDemoSubtitle}
                  >
                    <Text style={styles.secondaryActionText}>Load Test Track</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>ACTIVE SUBTITLE TRACK</Text>
                <View style={styles.boostRow}>
                  <TouchableOpacity
                    style={[styles.chip, activeSubtitleId === null && styles.chipActive]}
                    onPress={() => selectSubtitleTrack(null)}
                  >
                    <Text style={styles.chipText}>Disabled</Text>
                  </TouchableOpacity>
                  {subtitleTracks.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, activeSubtitleId === t.id && styles.chipActive]}
                      onPress={() => selectSubtitleTrack(t.id)}
                    >
                      <Text style={styles.chipText}>
                        {t.name} ({t.cues.length} cues)
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>
                  SUBTITLE SYNC DELAY: {subtitleOffsetMs >= 0 ? `+${subtitleOffsetMs}` : subtitleOffsetMs} ms
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => adjustSubtitleOffset(-50)}
                  >
                    <Text style={styles.stepBtnText}>-50 ms (Earlier)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => adjustSubtitleOffset(-subtitleOffsetMs)}
                  >
                    <Text style={styles.stepBtnText}>0 ms</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => adjustSubtitleOffset(50)}
                  >
                    <Text style={styles.stepBtnText}>+50 ms (Later)</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>SUBTITLE FONT SCALE: {subtitleFontSize}px</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setSubtitleFontSize(subtitleFontSize - 2)}
                  >
                    <Text style={styles.stepBtnText}>A-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setSubtitleFontSize(18)}
                  >
                    <Text style={styles.stepBtnText}>Default (18px)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setSubtitleFontSize(subtitleFontSize + 2)}
                  >
                    <Text style={styles.stepBtnText}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'tools' && (
              <View style={styles.section}>
                <Text style={styles.label}>FINE PLAYBACK SPEED: {playbackSpeed.toFixed(2)}x</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setPlaybackSpeed(playbackSpeed - 0.05)}
                  >
                    <Text style={styles.stepBtnText}>-0.05x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setPlaybackSpeed(1.0)}
                  >
                    <Text style={styles.stepBtnText}>Reset 1.00x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setPlaybackSpeed(playbackSpeed + 0.05)}
                  >
                    <Text style={styles.stepBtnText}>+0.05x</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.boostRow}>
                  {SPEED_PRESETS.map((spd) => (
                    <TouchableOpacity
                      key={spd}
                      style={[
                        styles.chip,
                        Math.abs(playbackSpeed - spd) < 0.02 && styles.chipActive,
                      ]}
                      onPress={() => setPlaybackSpeed(spd)}
                    >
                      <Text style={styles.chipText}>{spd}x</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>
                  SLEEP TIMER:{' '}
                  {sleepTimerRemainingSec
                    ? `${Math.ceil(sleepTimerRemainingSec / 60)} min remaining`
                    : 'OFF'}
                </Text>
                <View style={styles.boostRow}>
                  {SLEEP_OPTIONS.map((mins) => (
                    <TouchableOpacity
                      key={String(mins)}
                      style={[
                        styles.chip,
                        (mins === null && sleepTimerRemainingSec === null) ||
                        (mins !== null &&
                          sleepTimerRemainingSec !== null &&
                          Math.ceil(sleepTimerRemainingSec / 60) === mins)
                          ? styles.chipActive
                          : null,
                      ]}
                      onPress={() => setSleepTimer(mins)}
                    >
                      <Text style={styles.chipText}>{mins === null ? 'Off' : `${mins}m`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.toggleCard,
                    isBackgroundAudioEnabled && styles.toggleCardActive,
                  ]}
                  onPress={toggleBackgroundAudio}
                >
                  <Ionicons
                    name="headset-outline"
                    size={20}
                    color={THEME.colors.accentCyan}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>VLC Background Audio Mode</Text>
                    <Text style={styles.toggleSub}>
                      Continue audio playback when screen is minimized or turned off
                    </Text>
                  </View>
                  <Text style={styles.toggleBadge}>
                    {isBackgroundAudioEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.githubFooterDivider} />

            <View style={styles.githubFooterRow}>
              <TouchableOpacity
                style={styles.githubButton}
                activeOpacity={0.85}
                onPress={() => Linking.openURL(GITHUB_PROFILE_URL)}
              >
                <Ionicons name="logo-github" size={20} color={THEME.colors.textPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.githubBtnTitle}>GitHub • @JoeBuildsThings</Text>
                  <Text style={styles.githubBtnSub}>Engineered by Master Joe</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={THEME.colors.accentCyan} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.githubRepoIconBtn}
                activeOpacity={0.85}
                onPress={() => Linking.openURL(GITHUB_REPO_URL)}
              >
                <Ionicons name="code-slash-outline" size={18} color={THEME.colors.accentCyan} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </GlassPanel>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 16, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    padding: THEME.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.glassSurfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(4, 8, 18, 0.6)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderColor: THEME.colors.accentElectric,
  },
  tabText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  body: {
    maxHeight: 410,
  },
  section: {
    gap: THEME.spacing.sm,
    paddingBottom: THEME.spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.accentCyan,
    letterSpacing: 0.7,
    marginTop: 6,
  },
  boostRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(4, 8, 18, 0.65)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
  },
  chipActive: {
    backgroundColor: THEME.colors.accentCobalt,
    borderColor: THEME.colors.accentCyan,
  },
  chipBoostWarning: {
    borderColor: THEME.colors.statusWarning,
  },
  chipText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  eqBandsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(4, 8, 18, 0.65)',
    padding: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  eqColumn: {
    alignItems: 'center',
    gap: 6,
  },
  eqStepBtn: {
    width: 30,
    height: 26,
    borderRadius: 6,
    backgroundColor: THEME.colors.glassSurfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eqValue: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontFamily: THEME.typography.monoFamily,
    fontWeight: '700',
  },
  eqFreq: {
    color: THEME.colors.textMuted,
    fontSize: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    alignItems: 'center',
  },
  stepBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: THEME.typography.monoFamily,
  },
  subActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.accentCobalt,
    paddingVertical: 11,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.accentCyan,
  },
  primaryActionText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
  },
  secondaryActionText: {
    color: THEME.colors.accentCyan,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    padding: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(4, 8, 18, 0.65)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    marginTop: 6,
  },
  toggleCardActive: {
    borderColor: THEME.colors.accentElectric,
    backgroundColor: THEME.colors.glassSurfaceLight,
  },
  toggleTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSub: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
  },
  toggleBadge: {
    color: THEME.colors.accentCyan,
    fontWeight: '800',
    fontSize: 12,
  },
  githubFooterDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderSubtle,
    marginVertical: THEME.spacing.md,
  },
  githubFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
  },
  githubButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(4, 8, 18, 0.8)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
  },
  githubBtnTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  githubBtnSub: {
    color: THEME.colors.accentCyan,
    fontSize: 11,
  },
  githubRepoIconBtn: {
    width: 42,
    height: 42,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
