import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { THEME } from '../../core/constants/theme';
import { formatDurationMs } from '../../engine/gesture.math';

export interface NativeSubtitleOption {
  id: string;
  label: string;
}

interface VlcControlModalProps {
  visible: boolean;
  onClose: () => void;
  nativeSubtitleTracks: NativeSubtitleOption[];
  selectedNativeSubtitleId: string | null;
  onSelectNativeSubtitle: (id: string | null) => void;
}

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SLEEP_OPTIONS: Array<number | null> = [null, 15, 30, 45, 60];

export const VlcControlModal: React.FC<VlcControlModalProps> = ({
  visible,
  onClose,
  nativeSubtitleTracks,
  selectedNativeSubtitleId,
  onSelectNativeSubtitle,
}) => {
  const [activeTab, setActiveTab] = useState<'subtitles' | 'playback' | 'more'>('subtitles');
  const [isImporting, setIsImporting] = useState(false);
  const playbackSpeed = usePlayerStore((s) => s.playbackSpeed);
  const subtitleTracks = usePlayerStore((s) => s.subtitleTracks);
  const activeSubtitleId = usePlayerStore((s) => s.activeSubtitleId);
  const subtitleOffsetMs = usePlayerStore((s) => s.subtitleOffsetMs);
  const subtitleFontSize = usePlayerStore((s) => s.subtitleFontSize);
  const sleepTimerRemainingSec = usePlayerStore((s) => s.sleepTimerRemainingSec);
  const isBackgroundAudioEnabled = usePlayerStore((s) => s.isBackgroundAudioEnabled);
  const setPlaybackSpeed = usePlayerStore((s) => s.setPlaybackSpeed);
  const addSubtitleTrack = usePlayerStore((s) => s.addSubtitleTrack);
  const selectSubtitleTrack = usePlayerStore((s) => s.selectSubtitleTrack);
  const adjustSubtitleOffset = usePlayerStore((s) => s.adjustSubtitleOffset);
  const setSubtitleFontSize = usePlayerStore((s) => s.setSubtitleFontSize);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const toggleBackgroundAudio = usePlayerStore((s) => s.toggleBackgroundAudio);

  const importSubtitle = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const track = await SubtitleService.loadSubtitleFromUri(asset.uri, asset.name);
      onSelectNativeSubtitle(null);
      addSubtitleTrack(track);
    } catch (error) {
      Alert.alert('Subtitle could not be loaded', error instanceof Error ? error.message : 'Select a valid SRT or VTT file and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const selectExternal = (id: string | null) => {
    onSelectNativeSubtitle(null);
    selectSubtitleTrack(id);
  };

  const selectNative = (id: string | null) => {
    selectSubtitleTrack(null);
    onSelectNativeSubtitle(id);
  };

  const sleepLabel = sleepTimerRemainingSec === null
    ? 'Off'
    : formatDurationMs(sleepTimerRemainingSec * 1000);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <GlassPanel style={styles.sheet} intensity={55} heavy activeBorder>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>CHRONO CONTROLS</Text>
              <Text style={styles.title}>Playback lab</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Close playback settings" onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {([
              { id: 'subtitles', label: 'Subtitles', icon: 'chatbox-ellipses-outline' },
              { id: 'playback', label: 'Speed', icon: 'speedometer-outline' },
              { id: 'more', label: 'Timer', icon: 'moon-outline' },
            ] as const).map((tab) => (
              <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, activeTab === tab.id && styles.tabActive]}>
                <Ionicons name={tab.icon as any} size={15} color={activeTab === tab.id ? THEME.colors.accentCyan : THEME.colors.textMuted} />
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
            {activeTab === 'subtitles' && (
              <>
                <TouchableOpacity style={styles.importButton} onPress={importSubtitle} disabled={isImporting}>
                  {isImporting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />}
                  <Text style={styles.importText}>{isImporting ? 'Loading subtitle…' : 'Import .SRT or .VTT file'}</Text>
                  {!isImporting && <Ionicons name="add" size={19} color="#FFFFFF" />}
                </TouchableOpacity>
                <Text style={styles.sectionLabel}>ON-VIDEO SUBTITLES</Text>
                <TouchableOpacity onPress={() => { selectExternal(null); selectNative(null); }} style={styles.trackRow}>
                  <View style={styles.trackCopy}><Text style={styles.trackName}>Subtitles off</Text><Text style={styles.trackMeta}>Hide all subtitle tracks</Text></View>
                  {!activeSubtitleId && !selectedNativeSubtitleId && <Ionicons name="checkmark-circle" size={19} color={THEME.colors.accentCyan} />}
                </TouchableOpacity>

                {nativeSubtitleTracks.map((track) => (
                  <TouchableOpacity key={'native_' + track.id} onPress={() => selectNative(track.id)} style={styles.trackRow}>
                    <View style={styles.trackCopy}><Text numberOfLines={1} style={styles.trackName}>{track.label || 'Embedded subtitle'}</Text><Text style={styles.trackMeta}>Embedded in video</Text></View>
                    {selectedNativeSubtitleId === track.id && <Ionicons name="checkmark-circle" size={19} color={THEME.colors.accentCyan} />}
                  </TouchableOpacity>
                ))}
                {subtitleTracks.map((track) => (
                  <TouchableOpacity key={track.id} onPress={() => selectExternal(track.id)} style={styles.trackRow}>
                    <View style={styles.trackCopy}><Text numberOfLines={1} style={styles.trackName}>{track.name}</Text><Text style={styles.trackMeta}>{track.format.toUpperCase()} · {track.cues.length} cues</Text></View>
                    {activeSubtitleId === track.id && <Ionicons name="checkmark-circle" size={19} color={THEME.colors.accentCyan} />}
                  </TouchableOpacity>
                ))}
                {nativeSubtitleTracks.length === 0 && subtitleTracks.length === 0 && (
                  <Text style={styles.emptyText}>No subtitles loaded. Import an SRT or VTT file from your device.</Text>
                )}

                <View style={styles.divider} />
                <View style={styles.settingRow}>
                  <View style={styles.trackCopy}><Text style={styles.trackName}>Subtitle timing</Text><Text style={styles.trackMeta}>{subtitleOffsetMs > 0 ? '+' : ''}{(subtitleOffsetMs / 1000).toFixed(2)} seconds</Text></View>
                  <View style={styles.stepper}>
                    <TouchableOpacity accessibilityLabel="Show subtitles earlier" style={styles.stepButton} onPress={() => adjustSubtitleOffset(-250)}><Ionicons name="play-back" size={15} color={THEME.colors.accentCyan} /></TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="Show subtitles later" style={styles.stepButton} onPress={() => adjustSubtitleOffset(250)}><Ionicons name="play-forward" size={15} color={THEME.colors.accentCyan} /></TouchableOpacity>
                  </View>
                </View>
                <View style={styles.settingRow}>
                  <View style={styles.trackCopy}><Text style={styles.trackName}>Subtitle size</Text><Text style={styles.trackMeta}>{subtitleFontSize} px</Text></View>
                  <View style={styles.stepper}>
                    <TouchableOpacity accessibilityLabel="Decrease subtitle size" style={styles.stepButton} onPress={() => setSubtitleFontSize(subtitleFontSize - 2)}><Ionicons name="remove" size={17} color={THEME.colors.accentCyan} /></TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="Increase subtitle size" style={styles.stepButton} onPress={() => setSubtitleFontSize(subtitleFontSize + 2)}><Ionicons name="add" size={17} color={THEME.colors.accentCyan} /></TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {activeTab === 'playback' && (
              <>
                <Text style={styles.sectionLabel}>PLAYBACK SPEED</Text>
                <Text style={styles.speedCurrent}>{playbackSpeed.toFixed(playbackSpeed % 1 === 0 ? 1 : 2)}<Text style={styles.speedX}>x</Text></Text>
                <Text style={styles.speedDescription}>Audio pitch is preserved where the platform supports it.</Text>
                <View style={styles.speedGrid}>
                  {SPEED_PRESETS.map((speed) => (
                    <TouchableOpacity key={speed} onPress={() => setPlaybackSpeed(speed)} style={[styles.speedOption, playbackSpeed === speed && styles.speedOptionActive]}>
                      <Text style={[styles.speedText, playbackSpeed === speed && styles.speedTextActive]}>{speed}x</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {activeTab === 'more' && (
              <>
                <Text style={styles.sectionLabel}>SLEEP TIMER</Text>
                <View style={styles.timerPills}>
                  {SLEEP_OPTIONS.map((minutes) => {
                    const active = minutes === null
                      ? sleepTimerRemainingSec === null
                      : sleepTimerRemainingSec !== null && Math.ceil(sleepTimerRemainingSec / 60) === minutes;
                    return (
                      <TouchableOpacity key={minutes === null ? 'off' : String(minutes)} onPress={() => setSleepTimer(minutes)} style={[styles.timerPill, active && styles.timerPillActive]}>
                        <Text style={[styles.timerText, active && styles.timerTextActive]}>{minutes === null ? 'Off' : minutes + ' min'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.settingRow}>
                  <View style={styles.trackCopy}>
                    <Text style={styles.trackName}>Background audio</Text>
                    <Text style={styles.trackMeta}>Keep audio playing when Chrono is backgrounded</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="Toggle background audio"
                    accessibilityState={{ checked: isBackgroundAudioEnabled }}
                    onPress={toggleBackgroundAudio}
                    style={[styles.switch, isBackgroundAudioEnabled && styles.switchOn]}
                  >
                    <View style={[styles.switchKnob, isBackgroundAudioEnabled && styles.switchKnobOn]} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.notice}>Background playback depends on Android's media and battery settings. Video playback is not guaranteed to remain visible outside the app.</Text>
              </>
            )}
          </ScrollView>
        </GlassPanel>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(1,5,15,0.78)', paddingTop: 36 },
  sheet: { maxHeight: '88%', minHeight: '55%', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingHorizontal: 17, paddingTop: 10, paddingBottom: 24 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.45)', alignSelf: 'center', marginBottom: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  eyebrow: { color: THEME.colors.accentCyan, fontSize: 8, fontWeight: '800', letterSpacing: 1.8, marginBottom: 4 },
  title: { color: THEME.colors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  closeButton: { width: 39, height: 39, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: 'rgba(4,8,18,0.55)', marginBottom: 15 },
  tab: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11 },
  tabActive: { backgroundColor: 'rgba(37,99,235,0.2)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.18)' },
  tabText: { color: THEME.colors.textMuted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: THEME.colors.textPrimary },
  content: { flex: 1 },
  contentInner: { paddingBottom: 18 },
  importButton: { minHeight: 47, borderRadius: 13, backgroundColor: '#1769DE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 22 },
  importText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  sectionLabel: { color: THEME.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 9, marginTop: 5 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 51, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.08)' },
  trackCopy: { flex: 1, gap: 4 },
  trackName: { color: THEME.colors.textPrimary, fontSize: 12, fontWeight: '700' },
  trackMeta: { color: THEME.colors.textMuted, fontSize: 10 },
  emptyText: { color: THEME.colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 9, marginBottom: 15 },
  divider: { height: 1, backgroundColor: 'rgba(148,163,184,0.12)', marginVertical: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  stepper: { flexDirection: 'row', gap: 7 },
  stepButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(14,165,233,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)' },
  speedCurrent: { color: THEME.colors.textPrimary, fontSize: 46, textAlign: 'center', fontWeight: '800', marginTop: 15, letterSpacing: -1.4 },
  speedX: { color: THEME.colors.accentCyan, fontSize: 26 },
  speedDescription: { color: THEME.colors.textMuted, textAlign: 'center', fontSize: 10, marginTop: 2, marginBottom: 22 },
  speedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  speedOption: { width: '31%', flexGrow: 1, minHeight: 45, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(4,8,18,0.5)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.1)', borderRadius: 12 },
  speedOptionActive: { borderColor: THEME.colors.accentCyan, backgroundColor: 'rgba(37,99,235,0.22)' },
  speedText: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  speedTextActive: { color: THEME.colors.textPrimary },
  timerPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 15 },
  timerPill: { paddingVertical: 11, paddingHorizontal: 15, borderRadius: 12, backgroundColor: 'rgba(4,8,18,0.55)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.1)' },
  timerPillActive: { backgroundColor: 'rgba(37,99,235,0.22)', borderColor: THEME.colors.accentCyan },
  timerText: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  timerTextActive: { color: THEME.colors.textPrimary },
  switch: { width: 47, height: 27, padding: 3, borderRadius: 15, backgroundColor: 'rgba(148,163,184,0.18)', justifyContent: 'center' },
  switchOn: { backgroundColor: '#1769DE' },
  switchKnob: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#D5E1F0' },
  switchKnobOn: { alignSelf: 'flex-end', backgroundColor: '#FFFFFF' },
  notice: { fontSize: 10, color: THEME.colors.textMuted, lineHeight: 16, marginTop: 15, marginBottom: 7 },
});
