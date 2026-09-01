import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GradientTile } from '../../../components/GradientTile';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { useQuizStore } from '../../../store/useQuizStore';
import { DUELO_FINAL } from '../../../lib/archetypes';
import { DUELO_FINAL_IMAGES } from '../../../lib/images';
import { spacing } from '../../../theme';

export function Step10DuelFinal({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setDuelFinal = useQuizStore((s) => s.setDuelFinal);

  const choose = (id: string) => {
    setDuelFinal(id);
    setTimeout(onAdvance, 320);
  };

  return (
    <View style={styles.container}>
      <QuestionHeader title="En el festival, tú eres..." />
      <View style={styles.grid}>
        {DUELO_FINAL.map((opt) => (
          <GradientTile
            key={opt.id}
            size="medium"
            emoji={opt.emoji}
            label={opt.label}
            gradient={opt.gradient}
            image={DUELO_FINAL_IMAGES[opt.id]}
            selected={answers.duelFinalId === opt.id}
            onPress={() => choose(opt.id)}
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
