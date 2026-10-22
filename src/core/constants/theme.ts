export const THEME = {
  colors: {
    bgAbyss: '#040812',
    bgDeepCobalt: '#081024',
    bgElevated: '#0D1836',
    glassSurface: 'rgba(12, 24, 54, 0.76)',
    glassSurfaceHeavy: 'rgba(6, 13, 30, 0.88)',
    glassSurfaceLight: 'rgba(20, 40, 82, 0.55)',
    glassHud: 'rgba(5, 11, 26, 0.82)',
    borderSpecular: 'rgba(56, 189, 248, 0.24)',
    borderSubtle: 'rgba(148, 163, 184, 0.12)',
    borderActive: '#0EA5E9',
    accentElectric: '#0EA5E9',
    accentCyan: '#38BDF8',
    accentCobalt: '#2563EB',
    accentGlow: 'rgba(14, 165, 233, 0.28)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    statusSuccess: '#10B981',
    statusWarning: '#F59E0B',
    statusDanger: '#EF4444',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
  },
  typography: {
    monoFamily: 'monospace',
  },
} as const;

export const EQ_PRESETS = [
  { id: 'flat', name: 'Flat (Default)', bands: [0, 0, 0, 0, 0] },
  { id: 'cinema', name: 'VLC Cinema', bands: [4, 2, -1, 3, 5] },
  { id: 'bass', name: 'Bass Boost', bands: [7, 5, 1, 0, 1] },
  { id: 'vocal', name: 'Clear Dialogue', bands: [-2, 1, 5, 4, 1] },
  { id: 'night', name: 'Night Compression', bands: [-3, 0, 3, 2, -2] },
] as const;

export const EQ_FREQUENCIES = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'] as const;
