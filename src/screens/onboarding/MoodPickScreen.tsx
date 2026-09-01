import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { MoodSelector } from '../../components/MoodSelector';
import { RootStackParamList } from '../../navigation/types';
import { useMoodStore } from '../../store/useMoodStore';
import { useSessionStore } from '../../store/useSessionStore';
import { Mood } from '../../types/database';
import { colors, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MoodPick'>;

export function MoodPickScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const today = useMoodStore((s) => s.today);
  const setMood = useMoodStore((s) => s.setMood);

  const choose = async (mood: Mood) => {
    if (!userId) return;
    await setMood(userId, mood);
    navigation.replace('Home');
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>¿Cómo te sientes hoy?</Text>
        <Text style={styles.subtitle}>Puedes cambiarlo cuando quieras desde tu Home.</Text>
        <View style={styles.selectorWrap}>
          <MoodSelector value={today} onChange={choose} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  content: {
    gap: spacing.sm,
  },
  title: {
    ...type.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
  },
  selectorWrap: {
    marginTop: spacing.xl,
  },
});
