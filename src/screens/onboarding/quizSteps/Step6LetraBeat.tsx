import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GradientTile } from '../../../components/GradientTile';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { useQuizStore } from '../../../store/useQuizStore';
import { LETRA_BEAT } from '../../../lib/archetypes';
import { LETRA_BEAT_IMAGES } from '../../../lib/images';
import { spacing } from '../../../theme';

export function Step6LetraBeat({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setLetraBeat = useQuizStore((s) => s.setLetraBeat);

  const choose = (id: string) => {
    setLetraBeat(id);
    setTimeout(onAdvance, 320);
  };

  return (
    <View style={styles.container}>
      <QuestionHeader title="¿Letra o beat?" />
      <View style={styles.row}>
        {LETRA_BEAT.map((opt) => (
          <GradientTile
            key={opt.id}
            emoji={opt.emoji}
            label={opt.label}
            gradient={opt.gradient}
            image={LETRA_BEAT_IMAGES[opt.id]}
            selected={answers.letraBeatId === opt.id}
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
