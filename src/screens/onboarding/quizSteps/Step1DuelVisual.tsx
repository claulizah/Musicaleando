import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GradientTile } from '../../../components/GradientTile';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { useQuizStore } from '../../../store/useQuizStore';
import { DUELO_VISUAL } from '../../../lib/archetypes';
import { DUELO_VISUAL_IMAGES } from '../../../lib/images';
import { spacing } from '../../../theme';

export function Step1DuelVisual({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setDuelVisual = useQuizStore((s) => s.setDuelVisual);

  const choose = (id: string) => {
    setDuelVisual(id);
    setTimeout(onAdvance, 320);
  };

  return (
    <View style={styles.container}>
      <QuestionHeader title="¿Qué prefieres en un festival?" />
      <View style={styles.row}>
        {DUELO_VISUAL.map((opt) => (
          <GradientTile
            key={opt.id}
            emoji={opt.emoji}
            label={opt.label}
            gradient={opt.gradient}
            image={DUELO_VISUAL_IMAGES[opt.id]}
            selected={answers.duelVisualId === opt.id}
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
  row: { flex: 1, gap: spacing.md },
  tile: { flex: 1 },
});
