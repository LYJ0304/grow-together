import { Platform, StyleSheet } from 'react-native';

const bodyFont = Platform.select({
  ios: 'System',
  web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'sans-serif',
});

// Shared by the home and diary flows; display type is reserved for headings.
export const typography = StyleSheet.create({
  title: { fontFamily: 'Jua', fontSize: 24, lineHeight: 32, fontWeight: '400' },
  section: {
    fontFamily: bodyFont,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  body: {
    fontFamily: bodyFont,
    fontSize: 16,
    lineHeight: 27,
    fontWeight: '400',
  },
  label: {
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  caption: {
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '400',
  },
  button: {
    fontFamily: bodyFont,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
});
