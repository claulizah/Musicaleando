import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MotiView } from 'moti';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { colors, spacing, type } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const reducedMotion = useReducedMotion();

  return (
    <Screen style={styles.container}>
      <LinearGradient
        colors={colors.gradientStage}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <View style={styles.content}>
        <MotiView
          from={reducedMotion ? undefined : { opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: reducedMotion ? 0 : 420 }}
        >
          <Text style={styles.eyebrow}>MUSICALEANDO</Text>
          <Text style={styles.title}>Descubre tu vibra de festival</Text>
          <Text style={styles.subtitle}>
            10 preguntas, menos de 2 minutos. Tap, swipe, y listo: tu arquetipo musical.
          </Text>
        </MotiView>
      </View>
      <PrimaryButton label="Empezar" onPress={() => navigation.navigate('Quiz')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  eyebrow: {
    ...type.label,
    color: colors.accentSecondary,
    letterSpacing: 2,
  },
  title: {
    ...type.display,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...type.bodyLg,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
