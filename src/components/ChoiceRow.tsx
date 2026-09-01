import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, type } from '../theme';

type Props = {
  label: string;
  image?: ImageSourcePropType;
  selected?: boolean;
  onPress: () => void;
};

export function ChoiceRow({ label, image, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
    >
      {image ? <Image source={image} style={styles.thumb} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      <View style={[styles.radio, selected && styles.radioSelected]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: {
    borderColor: colors.accentSecondary,
    backgroundColor: colors.accentSecondaryMuted,
  },
  rowPressed: {
    opacity: 0.85,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    marginRight: spacing.md,
  },
  label: {
    ...type.body,
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.md,
  },
  labelSelected: {
    fontFamily: type.bodyLg.fontFamily,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
  radioSelected: {
    borderColor: colors.accentSecondary,
    backgroundColor: colors.accentSecondary,
  },
});
