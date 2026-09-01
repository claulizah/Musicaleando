import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GradientTile } from '../../../components/GradientTile';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { useQuizStore } from '../../../store/useQuizStore';
import { ERA } from '../../../lib/archetypes';
import { ERA_IMAGES } from '../../../lib/images';
import { colors, spacing } from '../../../theme';

// Fixed gradient per era tile (ERA options carry flavor text, not their own gradient).
const ERA_GRADIENTS: readonly [string, string][] = [
  [colors.accentPrimary, '#2A1B4A'],
  ['#6D28D9', '#14111F'],
  [colors.accentSecondary, '#B23A2A'],
  [colors.accentPrimary, colors.accentSecondary],
  ['#B24A78', '#2A1B4A'],
];

export function Step4Era({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setEra = useQuizStore((s) => s.setEra);

  const choose = (id: string) => {
    setEra(id);
    setTimeout(onAdvance, 320);
  };

  return (
    <View style={styles.container}>
      <QuestionHeader title="¿En qué década vive tu alma musical?" />
      <View style={styles.grid}>
        {ERA.map((era, i) => (
          <GradientTile
            key={era.id}
            size="medium"
            emoji={era.emoji ?? '🎵'}
            label={era.label}
            gradient={ERA_GRADIENTS[i % ERA_GRADIENTS.length]}
            image={ERA_IMAGES[era.id]}
            selected={answers.eraId === era.id}
            onPress={() => choose(era.id)}
            style={styles.tile}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '47%',
  },
});
