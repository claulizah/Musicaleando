import React from 'react';
import { ImageBackground, ImageSourcePropType, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, radii, spacing, type } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  emoji: string;
  label: string;
  gradient: readonly [string, string];
  image?: ImageSourcePropType;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  size?: 'large' | 'medium';
};

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function GradientTile({
  emoji,
  label,
  gradient,
  image,
  selected,
  onPress,
  style,
  size = 'large',
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const tileStyle = [styles.tile, size === 'medium' && styles.tileMedium, selected && styles.tileSelected];

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 14 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12 });
      }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      {image ? (
        <ImageBackground source={image} style={[tileStyle, styles.imageTile]} imageStyle={styles.image}>
          <LinearGradient
            colors={['transparent', hexToRgba(gradient[1], 0.92)]}
            locations={[0.4, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.scrim}
          />
          <Text style={styles.label} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
            {label}
          </Text>
        </ImageBackground>
      ) : (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tileStyle}>
          <Text style={size === 'large' ? styles.emojiLarge : styles.emojiMedium}>{emoji}</Text>
          <Text style={styles.label} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
            {label}
          </Text>
        </LinearGradient>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.lg,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  // Con padding lateral de 24 (spacing.lg) el texto útil de una ficha de 2 columnas mide
  // ~95 dp en un teléfono de 360 dp: "Electrónica" (98 dp en Sora 17) y "Reggaetón" (96 dp)
  // no caben y se partían a media palabra. Con 8 dp por lado quedan ~127 dp.
  tileMedium: {
    minHeight: 128,
    paddingHorizontal: spacing.sm,
  },
  tileSelected: {
    borderColor: colors.textPrimary,
  },
  imageTile: {
    justifyContent: 'flex-end',
  },
  image: {
    borderRadius: radii.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  emojiLarge: {
    fontSize: 56,
  },
  emojiMedium: {
    fontSize: 36,
  },
  label: {
    ...type.bodyLg,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
