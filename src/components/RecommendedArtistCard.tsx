import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RecommendedArtist } from '../lib/spotify';
import { GENEROS } from '../lib/archetypes';
import { colors, radii, spacing, type } from '../theme';

type Props = {
  artists: RecommendedArtist[];
};

export function RecommendedArtistCard({ artists }: Props) {
  if (artists.length === 0) return null;
  const [featured, ...rest] = artists;
  const genero = GENEROS.find((g) => g.id === featured.generoId);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>ARTISTA RECOMENDADO</Text>
      <View style={styles.featuredRow}>
        {featured.imageUrl ? (
          <Image source={{ uri: featured.imageUrl }} style={styles.featuredImage} />
        ) : (
          <Text style={styles.featuredEmoji}>🎤</Text>
        )}
        <View style={styles.featuredText}>
          <Text style={styles.featuredName}>{featured.name}</Text>
          <Text style={styles.reason}>
            {featured.matchedChampion
              ? `Porque tu campeón del Torneo Sonoro también es ${genero?.label ?? featured.generoId}`
              : `Porque te gusta ${genero?.label ?? featured.generoId}`}
          </Text>
        </View>
      </View>
      {rest.length > 0 && (
        <View style={styles.restRow}>
          {rest.slice(0, 4).map((a) => (
            <View key={a.id} style={styles.restItem}>
              {a.imageUrl ? (
                <Image source={{ uri: a.imageUrl }} style={styles.restImage} />
              ) : (
                <Text style={styles.restEmoji}>🎤</Text>
              )}
              <Text style={styles.restName} numberOfLines={1}>
                {a.name}
              </Text>
            </View>
          ))}
        </View>
      )}
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
    color: colors.accentPrimary,
    letterSpacing: 1.5,
  },
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featuredImage: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
  },
  featuredEmoji: {
    fontSize: 40,
    width: 64,
    textAlign: 'center',
  },
  featuredText: {
    flex: 1,
    gap: 2,
  },
  featuredName: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  reason: {
    ...type.caption,
    color: colors.textSecondary,
  },
  restRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  restItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  restImage: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
  },
  restEmoji: {
    fontSize: 28,
    width: 44,
    height: 44,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  restName: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
