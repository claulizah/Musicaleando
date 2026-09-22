import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { fetchFollowedArtistsWithNames, unfollowArtist, type FollowedArtist } from '../../lib/followArtists';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FollowedArtists'>;

// Lista simple en Perfil de a quién sigues, con opción de dejar de seguir
// sin tener que ir ficha por ficha (ver ArtistDetailScreen para el toggle
// original). No agrega ningún dato nuevo — reusa followed_artists + artists.
export function FollowedArtistsScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const [artists, setArtists] = useState<FollowedArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchFollowedArtistsWithNames(userId).then((result) => {
      setArtists(result);
      setLoading(false);
    });
  }, [userId]);

  const handleUnfollow = async (artistId: string) => {
    if (!userId) return;
    const previous = artists;
    setArtists((current) => current.filter((a) => a.artist_id !== artistId));
    const ok = await unfollowArtist(userId, artistId);
    if (!ok) setArtists(previous);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Artistas seguidos</Text>
          <View style={styles.headerSpacer} />
        </View>

        {!loading && artists.length === 0 && (
          <Text style={styles.hint}>
            No sigues a ningún artista todavía. Sigue a uno desde su ficha para que te avisemos de sus próximos eventos.
          </Text>
        )}

        {artists.map((a) => (
          <View key={a.artist_id} style={styles.row}>
            <Pressable
              style={styles.rowNameArea}
              onPress={() => navigation.navigate('ArtistDetail', { artistId: a.artist_id, artistName: a.name })}
            >
              <Text style={styles.rowName}>{a.name}</Text>
            </Pressable>
            <Pressable onPress={() => handleUnfollow(a.artist_id)} hitSlop={8}>
              <Text style={styles.unfollow}>Dejar de seguir</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    ...type.h1,
    color: colors.textPrimary,
    width: 32,
  },
  headerTitle: {
    ...type.h2,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 32,
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rowNameArea: {
    flexShrink: 1,
  },
  rowName: {
    ...type.body,
    color: colors.textPrimary,
  },
  unfollow: {
    ...type.caption,
    color: colors.accentSecondary,
  },
});
