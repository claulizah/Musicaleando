import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, type } from '../theme';
import { Mood } from '../types/database';
import { useMoodCatalogStore } from '../store/useMoodCatalogStore';

type Props = {
  value: Mood | null;
  onChange: (mood: Mood) => void;
};

// Options come from mood_catalog (a table, not a hardcoded enum) so adding a
// 7th mood-actividad later is a data row, not a code change here.
export function MoodSelector({ value, onChange }: Props) {
  const moods = useMoodCatalogStore((s) => s.moods);
  const fetchCatalog = useMoodCatalogStore((s) => s.fetch);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  return (
    <View style={styles.row}>
      {moods.map((mood) => {
        const selected = value === mood.id;
        return (
          <Pressable
            key={mood.id}
            onPress={() => {
              if (selected) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(mood.id as Mood);
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
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pressable: {
    minWidth: '30%',
    flexGrow: 1,
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
