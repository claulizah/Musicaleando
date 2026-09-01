import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { colors, spacing, type } from '../theme';
import { energiaEmoji } from '../lib/archetypes';

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export function EnergySlider({ value, onChange }: Props) {
  const [liveValue, setLiveValue] = useState(value);
  const bucket = Math.floor(liveValue * 5);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{energiaEmoji(liveValue)}</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={value}
        minimumTrackTintColor={colors.accentSecondary}
        maximumTrackTintColor={colors.bgElevatedHigh}
        thumbTintColor={colors.accentPrimary}
        onValueChange={(v) => {
          const newBucket = Math.floor(v * 5);
          if (newBucket !== bucket) {
            Haptics.selectionAsync();
          }
          setLiveValue(v);
        }}
        onSlidingComplete={onChange}
      />
      <View style={styles.labelsRow}>
        <Text style={styles.labelText}>😴 Tranqui</Text>
        <Text style={styles.labelText}>Al máximo 🔥</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 72,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  labelText: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
