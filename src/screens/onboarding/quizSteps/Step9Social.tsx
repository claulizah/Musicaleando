import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconChoice } from '../../../components/IconChoice';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { useQuizStore } from '../../../store/useQuizStore';
import { SOCIAL } from '../../../lib/archetypes';
import { SOCIAL_IMAGES } from '../../../lib/images';
import { colors, spacing, type } from '../../../theme';

export function Step9Social({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setSocial = useQuizStore((s) => s.setSocial);

  const choose = (id: (typeof SOCIAL)[number]['id']) => {
    setSocial(id);
    setTimeout(onAdvance, 320);
  };

  return (
    <View style={styles.container}>
      <QuestionHeader title="¿Con quién llegas al festival?" />
      <View style={styles.row}>
        {SOCIAL.map((option) => (
          <IconChoice
            key={option.id}
            emoji={option.emoji}
            label={option.label}
            image={SOCIAL_IMAGES[option.id]}
            selected={answers.socialId === option.id}
            onPress={() => choose(option.id)}
          />
        ))}
      </View>
      <Text style={styles.hint}>Esta respuesta define tu arquetipo, junto con tu energía.</Text>
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
  hint: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
