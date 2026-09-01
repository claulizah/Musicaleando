import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChoiceRow } from '../../../components/ChoiceRow';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { useQuizStore } from '../../../store/useQuizStore';
import { CONCIERTO } from '../../../lib/archetypes';
import { CONCIERTO_IMAGES } from '../../../lib/images';
import { spacing } from '../../../theme';

export function Step8Concierto({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setConcierto = useQuizStore((s) => s.setConcierto);

  const choose = (id: string) => {
    setConcierto(id);
    setTimeout(onAdvance, 320);
  };

  return (
    <View style={styles.container}>
      <QuestionHeader title="¿Cómo vives un concierto?" />
      <View style={styles.list}>
        {CONCIERTO.map((option) => (
          <ChoiceRow
            key={option.id}
            label={option.label}
            image={CONCIERTO_IMAGES[option.id]}
            selected={answers.concertoId === option.id}
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
