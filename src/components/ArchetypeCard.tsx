import React, { forwardRef } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArchetypeDef } from '../lib/archetypes';
import { colors, radii, spacing, type } from '../theme';

type Props = {
  // Also used for the Torneo Sonoro champion card, which isn't one of the 12
  // fixed archetypes — id only needs to be a string there, not ArchetypeId.
  archetype: Omit<ArchetypeDef, 'id'> & { id: string };
  flavor?: string;
  image?: ImageSourcePropType;
};

export const ArchetypeCard = forwardRef<View, Props>(({ archetype, flavor, image }, ref) => {
  return (
    <View ref={ref} collapsable={false} style={styles.wrapper}>
      <LinearGradient
        colors={archetype.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {image ? (
          <Image source={image} style={styles.image} />
        ) : (
          <Text style={styles.emoji}>{archetype.emoji}</Text>
        )}
        <Text style={styles.label}>{archetype.label}</Text>
        <Text style={styles.description}>{archetype.description}</Text>
        {flavor ? <Text style={styles.flavor}>{flavor}</Text> : null}
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Musicaleando</Text>
        </View>
      </LinearGradient>
    </View>
  );
});
ArchetypeCard.displayName = 'ArchetypeCard';

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  card: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 340,
    justifyContent: 'center',
  },
  image: {
    width: 140,
    height: 140,
    borderRadius: radii.lg,
  },
  emoji: {
    fontSize: 72,
  },
  label: {
    ...type.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...type.bodyLg,
    color: 'rgba(245, 243, 250, 0.85)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  flavor: {
    ...type.body,
    color: 'rgba(245, 243, 250, 0.75)',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  brandRow: {
    marginTop: spacing.lg,
  },
  brand: {
    ...type.label,
    color: 'rgba(245, 243, 250, 0.7)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
