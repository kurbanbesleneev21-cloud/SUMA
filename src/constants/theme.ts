export type AccentId = 'violet' | 'blue' | 'pink' | 'emerald' | 'amber';

export const accents: Record<AccentId, { primary: string; gradient: [string, string, string]; soft: string }> = {
  violet: { primary: '#8B5CF6', gradient: ['#7C3AED', '#6D28D9', '#3B82F6'], soft: 'rgba(139, 92, 246, 0.16)' },
  blue: { primary: '#3B82F6', gradient: ['#2563EB', '#1D4ED8', '#22D3EE'], soft: 'rgba(59, 130, 246, 0.16)' },
  pink: { primary: '#EC4899', gradient: ['#DB2777', '#9D174D', '#8B5CF6'], soft: 'rgba(236, 72, 153, 0.16)' },
  emerald: { primary: '#10B981', gradient: ['#059669', '#047857', '#22D3EE'], soft: 'rgba(16, 185, 129, 0.16)' },
  amber: { primary: '#F59E0B', gradient: ['#D97706', '#B45309', '#EF4444'], soft: 'rgba(245, 158, 11, 0.16)' },
};

const base = {
  dark: {
    background: '#090910',
    navy: '#0D1230',
    surface: '#12121D',
    surfaceAlt: '#1B1B2B',
    glass: 'rgba(22, 22, 38, 0.72)',
    border: '#252538',
    text: '#FFFFFF',
    textMuted: '#8A8AA6',
    neon: '#38BDF8',
    bubbleOther: '#1B1B2B',
    bubbleOtherText: '#FFFFFF',
    danger: '#F43F5E',
    success: '#22C55E',
    warning: '#F59E0B',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  light: {
    background: '#F6F6FB',
    navy: '#E7EAF8',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEEF6',
    glass: 'rgba(255, 255, 255, 0.82)',
    border: '#E1E1EE',
    text: '#11111A',
    textMuted: '#6B6B80',
    neon: '#0284C7',
    bubbleOther: '#FFFFFF',
    bubbleOtherText: '#11111A',
    danger: '#E11D48',
    success: '#16A34A',
    warning: '#D97706',
    overlay: 'rgba(10, 10, 20, 0.35)',
  },
};

export const buildPalette = (scheme: 'dark' | 'light', accent: AccentId) => {
  const a = accents[accent];
  return {
    ...base[scheme],
    primary: a.primary,
    primarySoft: a.soft,
    gradient: a.gradient,
    bubbleOwn: a.gradient[0],
    bubbleOwnText: '#FFFFFF',
  };
};

export type Palette = ReturnType<typeof buildPalette>;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const avatarGradients: [string, string][] = [
  ['#7C3AED', '#3B82F6'],
  ['#DB2777', '#7C3AED'],
  ['#0EA5E9', '#22C55E'],
  ['#F59E0B', '#EF4444'],
  ['#6366F1', '#06B6D4'],
  ['#8B5CF6', '#EC4899'],
];
