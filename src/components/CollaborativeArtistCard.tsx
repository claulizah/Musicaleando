import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RecommendationV2 } from '../store/useRecommendationsV2Store';
import { colors, radii, spacing, type } from '../theme';

type Props = {
  recommendations: RecommendationV2[];
};

// V2 · Colaborativo — deliberately a separate card from RecommendedArtistCard
// (V1): different data shape (no generoId, just an artist + a social-proof
// score), different reason copy, and keeping them visually distinct matters
// here since V1/V2 are explicitly different engines in the spec, not two
// views of the same thing.
export function CollaborativeArtistCard({ recommendations }: Props) {
  if (recommendations.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>GENTE COMO TÚ TAMBIÉN CORONA A...</Text>
      <View style={styles.row}>
        {recommendations.slice(0, 5).map((r) => (
          <View key={r.artista_id} style={styles.item}>
            {r.artista_imagen_url ? (
              <Image source={{ uri: r.artista_imagen_url }} style={styles.image} />
            ) : (
              <Text style={styles.emoji}>🎤</Text>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {r.artista_nombre}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>Basado en campeones del Torneo Sonoro de tu arquetipo y tu squad.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    ...type.label,
    color: colors.accentSecondary,
    letterSpacing: 1.5,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
  },
  emoji: {
    fontSize: 28,
    width: 48,
    height: 48,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  name: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hint: {
    ...type.caption,
    color: colors.textMuted,
  },
});
