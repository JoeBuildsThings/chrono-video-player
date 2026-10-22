import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { THEME } from '../../core/constants/theme';

interface GlassPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  heavy?: boolean;
  activeBorder?: boolean;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  style,
  intensity = 35,
  heavy = false,
  activeBorder = false,
}) => {
  return (
    <View
      style={[
        styles.wrapper,
        heavy ? styles.bgHeavy : styles.bgStandard,
        activeBorder ? styles.borderActive : styles.borderDefault,
        style,
      ]}
    >
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
  },
  bgStandard: {
    backgroundColor: THEME.colors.glassSurface,
  },
  bgHeavy: {
    backgroundColor: THEME.colors.glassSurfaceHeavy,
  },
  borderDefault: {
    borderColor: THEME.colors.borderSpecular,
  },
  borderActive: {
    borderColor: THEME.colors.borderActive,
  },
  content: {
    position: 'relative',
    zIndex: 2,
  },
});
