import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';

// Shared surfaces and type hierarchy for the daily planning/recording journey.
export const editorial = StyleSheet.create({
  intro: { gap: 8, marginBottom: 20 },
  eyebrow: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.1,
    fontWeight: '700',
    color: colors.primary,
  },
  title: {
    ...typography.section,
    fontSize: 30,
    lineHeight: 40,
    color: colors.heading,
  },
  section: { ...typography.section, color: colors.heading },
  description: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 24,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 20,
  },
  hero: {
    backgroundColor: colors.tint,
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  segment: {
    backgroundColor: colors.border,
    borderRadius: 16,
    padding: 4,
    flexDirection: 'row',
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  segmentActive: { backgroundColor: colors.surface },
});
