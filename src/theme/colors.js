export const darkColors = {
  mode: 'dark',
  background: '#121212',
  card: '#1E1E1E',
  cardBorder: '#2A2A2A',
  textPrimary: '#F5F5F5',
  textSecondary: '#9A9A9A',
  accent: '#4F9DFF',
  accentSoft: 'rgba(79, 157, 255, 0.15)',
  success: '#3ECF8E',
  successSoft: 'rgba(62, 207, 142, 0.15)',
  danger: '#FF6B6B',
  pill: '#2A2A2A',
};

export const lightColors = {
  mode: 'light',
  background: '#F4F4F5',
  card: '#FFFFFF',
  cardBorder: '#E2E2E5',
  textPrimary: '#161616',
  textSecondary: '#6B6B70',
  accent: '#2F6FE0',
  accentSoft: 'rgba(47, 111, 224, 0.12)',
  success: '#1E9E63',
  successSoft: 'rgba(30, 158, 99, 0.12)',
  danger: '#D64545',
  pill: '#ECECEE',
};

export function getColors(mode) {
  return mode === 'light' ? lightColors : darkColors;
}

// Kept for any leftover static imports -- defaults to dark.
export const colors = darkColors;
