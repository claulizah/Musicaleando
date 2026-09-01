import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { colors, spacing, type } from '../theme';

type Props = {
  message: string;
  onRetry: () => void;
};

export function SessionErrorScreen({ message, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No pudimos conectar</Text>
      <Text style={styles.message}>{message}</Text>
      <PrimaryButton label="Reintentar" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...type.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
