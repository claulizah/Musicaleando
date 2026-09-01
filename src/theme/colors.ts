// "Noche de festival": dark base + electric purple / warm coral accents.
export const colors = {
  bg: '#14111F',
  bgElevated: '#1E1830',
  bgElevatedHigh: '#292040',
  border: 'rgba(245, 243, 250, 0.08)',

  accentPrimary: '#8B5CF6',
  accentPrimaryMuted: 'rgba(139, 92, 246, 0.16)',
  accentSecondary: '#FF6B4A',
  accentSecondaryMuted: 'rgba(255, 107, 74, 0.16)',

  textPrimary: '#F5F3FA',
  textSecondary: '#A79FC2',
  textMuted: '#6F6685',
  onAccent: '#14111F',

  success: '#4ADE80',
  danger: '#F87171',

  gradientStage: ['#2A1B4A', '#14111F'] as const,
} as const;

export type AppColors = typeof colors;
