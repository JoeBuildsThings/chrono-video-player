import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassPanel } from '../common/GlassPanel';
import { THEME } from '../../core/constants/theme';
import { PermissionStatusType } from '../../core/types';

interface PermissionGateProps {
  status: PermissionStatusType;
  onRequestPermission: () => void;
  onOpenNetworkStream: () => void;
  onPickExternalVideo: () => void;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  status,
  onRequestPermission,
  onOpenNetworkStream,
  onPickExternalVideo,
}) => {
  const isBlocked = status === 'blocked';

  return (
    <View style={styles.container}>
      <GlassPanel style={styles.card} intensity={45} heavy>
        <View style={styles.iconCircle}>
          <Ionicons name="folder-open-outline" size={38} color={THEME.colors.accentCyan} />
        </View>

        <Text style={styles.title}>Media Storage Access Required</Text>
        <Text style={styles.subtitle}>
          Chrono Player indexes your device folders locally to group video directories, track watch
          progress, and load external SRT/VTT subtitle files.
        </Text>

        <View style={styles.featureList}>
          <View style={styles.featureRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={THEME.colors.accentElectric} />
            <Text style={styles.featureText}>100% Local indexing — zero external telemetry</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="layers-outline" size={18} color={THEME.colors.accentElectric} />
            <Text style={styles.featureText}>MX-style automatic folder hierarchy & resume</Text>
          </View>
        </View>

        {isBlocked ? (
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="settings-outline" size={18} color={THEME.colors.textPrimary} />
            <Text style={styles.primaryButtonText}>Open System Settings</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={onRequestPermission}
          >
            <Ionicons name="lock-open-outline" size={18} color={THEME.colors.textPrimary} />
            <Text style={styles.primaryButtonText}>Grant Media Access</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        <Text style={styles.fallbackLabel}>Or continue without full storage indexing:</Text>
        <View style={styles.fallbackRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={onPickExternalVideo}
          >
            <Ionicons name="document-attach-outline" size={16} color={THEME.colors.accentCyan} />
            <Text style={styles.secondaryButtonText}>Pick Video File</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={onOpenNetworkStream}
          >
            <Ionicons name="globe-outline" size={16} color={THEME.colors.accentCyan} />
            <Text style={styles.secondaryButtonText}>Network Stream</Text>
          </TouchableOpacity>
        </View>
      </GlassPanel>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    padding: THEME.spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: THEME.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: THEME.spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
  },
  featureList: {
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.xl,
    backgroundColor: 'rgba(4, 8, 18, 0.55)',
    padding: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  featureText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: THEME.colors.accentCobalt,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.accentCyan,
  },
  primaryButtonText: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.borderSubtle,
    marginVertical: THEME.spacing.lg,
  },
  fallbackLabel: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: THEME.spacing.sm,
  },
  fallbackRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.glassSurfaceLight,
    borderWidth: 1,
    borderColor: THEME.colors.borderSpecular,
  },
  secondaryButtonText: {
    color: THEME.colors.accentCyan,
    fontSize: 13,
    fontWeight: '600',
  },
});
