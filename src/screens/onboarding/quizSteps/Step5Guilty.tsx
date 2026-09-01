import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChoiceRow } from '../../../components/ChoiceRow';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { useQuizStore } from '../../../store/useQuizStore';
import { GUILTY_PLEASURES } from '../../../lib/archetypes';
import { GUILTY_PLEASURE_IMAGES } from '../../../lib/images';
import { spacing } from '../../../theme';

export function Step5Guilty({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setGuiltyPleasure = useQuizStore((s) => s.setGuiltyPleasure);

  const choose = (id: string) => {
    setGuiltyPleasure(id);
    setTimeout(onAdvance, 320);
  };

  return (
    <View style={styles.container}>
      <QuestionHeader title="Confiesa tu guilty pleasure musical" />
      <View style={styles.list}>
        {GUILTY_PLEASURES.map((option) => (
          <ChoiceRow
            key={option.id}
            label={option.label}
            image={GUILTY_PLEASURE_IMAGES[option.id]}
            selected={answers.guiltyPleasureId === option.id}
            onPress={() => choose(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { gap: spacing.sm },
});
