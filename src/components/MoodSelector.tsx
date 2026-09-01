import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, type } from '../theme';
import { Mood } from '../types/database';

const MOODS: { id: Mood; label: string; emoji: string }[] = [
  { id: 'fiesta', label: 'Fiesta', emoji: '🎉' },
  { id: 'chill', label: 'Chill', emoji: '🌙' },
  { id: 'electronica', label: 'Electrónica', emoji: '🎧' },
];

type Props = {
  value: Mood | null;
  onChange: (mood: Mood) => void;
};

export function MoodSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {MOODS.map((mood) => {
        const selected = value === mood.id;
        return (
          <Pressable
            key={mood.id}
            onPress={() => {
              if (selected) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(mood.id);
            }}
            style={styles.pressable}
          >
            <MotiView
              animate={{
                backgroundColor: selected ? colors.accentPrimary : colors.bgElevated,
                scale: selected ? 1.04 : 1,
              }}
              transition={{ type: 'timing', duration: 220 }}
              style={styles.pill}
            >
              <Text style={styles.emoji}>{mood.emoji}</Text>
              <Text style={[styles.label, selected && styles.labelSelected]}>{mood.label}</Text>
            </MotiView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pressable: {
    flex: 1,
  },
  pill: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: {
    fontSize: 26,
  },
  label: {
    ...type.label,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.onAccent,
  },
});
