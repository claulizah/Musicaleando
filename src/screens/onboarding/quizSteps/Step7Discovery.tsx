import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconChoice } from '../../../components/IconChoice';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { useQuizStore } from '../../../store/useQuizStore';
import { DISCOVERY } from '../../../lib/archetypes';
import { DISCOVERY_IMAGES } from '../../../lib/images';

export function Step7Discovery({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setDiscovery = useQuizStore((s) => s.setDiscovery);

  const choose = (id: string) => {
    setDiscovery(id);
    setTimeout(onAdvance, 320);
  };

  return (
    <View style={styles.container}>
      <QuestionHeader title="¿Cómo descubres música nueva?" />
      <View style={styles.row}>
        {DISCOVERY.map((option) => (
          <IconChoice
            key={option.id}
            emoji={option.emoji}
            label={option.label}
            image={DISCOVERY_IMAGES[option.id]}
            selected={answers.discoveryId === option.id}
            onPress={() => choose(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
