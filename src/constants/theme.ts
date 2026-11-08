export const palettes = {
  dark: {
    background: '#0B0B12',
    surface: '#15151F',
    surfaceAlt: '#1E1E2B',
    border: '#2A2A3A',
    text: '#F4F4F8',
    textMuted: '#8C8CA3',
    primary: '#7C3AED',
    primarySoft: 'rgba(124, 58, 237, 0.18)',
    accent: '#3B82F6',
    bubbleOwn: '#6D28D9',
    bubbleOwnText: '#FFFFFF',
    bubbleOther: '#1E1E2B',
    bubbleOtherText: '#F4F4F8',
    danger: '#F43F5E',
    success: '#22C55E',
    warning: '#F59E0B',
  },
  light: {
    background: '#F6F6FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEEF6',
    border: '#E2E2EE',
    text: '#13131C',
    textMuted: '#6B6B80',
    primary: '#7C3AED',
    primarySoft: 'rgba(124, 58, 237, 0.10)',
    accent: '#2563EB',
    bubbleOwn: '#7C3AED',
    bubbleOwnText: '#FFFFFF',
    bubbleOther: '#FFFFFF',
    bubbleOtherText: '#13131C',
    danger: '#E11D48',
    success: '#16A34A',
    warning: '#D97706',
  },
};

export type Palette = typeof palettes.dark;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

export const gradients = [
  ['#7C3AED', '#3B82F6'],
  ['#DB2777', '#7C3AED'],
  ['#0EA5E9', '#22C55E'],
  ['#F59E0B', '#EF4444'],
  ['#6366F1', '#06B6D4'],
  ['#8B5CF6', '#EC4899'],
] as const;
