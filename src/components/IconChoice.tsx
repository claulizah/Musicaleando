import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, type } from '../theme';

type Props = {
  emoji: string;
  label: string;
  image?: ImageSourcePropType;
  selected?: boolean;
  onPress: () => void;
};

export function IconChoice({ emoji, label, image, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={styles.wrapper}
    >
      <View style={[styles.circle, selected && styles.circleSelected]}>
        {image ? (
          <Image source={image} style={styles.image} />
        ) : (
          <Text style={styles.emoji}>{emoji}</Text>
        )}
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '25%',
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circleSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimaryMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 30,
  },
  label: {
    ...type.caption,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.textPrimary,
  },
});
