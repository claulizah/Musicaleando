import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GradientTile } from '../../../components/GradientTile';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useQuizStore } from '../../../store/useQuizStore';
import { GENEROS } from '../../../lib/archetypes';
import { GENEROS_IMAGES } from '../../../lib/images';
import { spacing } from '../../../theme';

export function Step2Generos({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const toggleGenero = useQuizStore((s) => s.toggleGenero);

  return (
    <View style={styles.container}>
      <QuestionHeader title="Arma tu mood board" subtitle="Elige hasta 3 géneros" />
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {GENEROS.map((genero) => (
          <GradientTile
            key={genero.id}
            size="medium"
            emoji={genero.emoji}
            label={genero.label}
            gradient={genero.gradient}
            image={GENEROS_IMAGES[genero.id]}
            selected={answers.generoIds.includes(genero.id)}
            onPress={() => toggleGenero(genero.id)}
            style={styles.tile}
          />
        ))}
      </ScrollView>
      <PrimaryButton
        label="Continuar"
        disabled={answers.generoIds.length === 0}
        onPress={onAdvance}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  tile: {
    width: '47%',
  },
});
