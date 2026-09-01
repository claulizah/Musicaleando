import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tables } from '../types/database';
import { colors, radii, spacing, type } from '../theme';

type Song = Tables<'songs'>;

type Props = {
  songs: Song[];
};

export function PlaylistCard({ songs }: Props) {
  if (songs.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>TU PLAYLIST DE HOY</Text>
      <View style={styles.list}>
        {songs.map((song, i) => (
          <View key={song.id} style={styles.row}>
            <Text style={styles.rowIndex}>{i + 1}</Text>
            <View style={styles.rowText}>
              <Text style={styles.titulo} numberOfLines={1}>
                {song.titulo}
              </Text>
              <Text style={styles.artista} numberOfLines={1}>
                {song.artista}
              </Text>
            </View>
          </View>
        ))}
      </View>
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
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIndex: {
    ...type.label,
    color: colors.textMuted,
    width: 20,
  },
  rowText: {
    flex: 1,
  },
  titulo: {
    ...type.body,
    color: colors.textPrimary,
  },
  artista: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
