import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useCommunityStore, CommunityShareWithSongs } from '../../store/useCommunityStore';
import { supabase } from '../../lib/supabase';
import { Tables } from '../../types/database';
import { colors, radii, spacing, type } from '../../theme';

type Song = Tables<'songs'>;
type Props = NativeStackScreenProps<RootStackParamList, 'CommunityTrends'>;

export function CommunityTrendsScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const shares = useCommunityStore((s) => s.shares);
  const scope = useCommunityStore((s) => s.scope);
  const setScope = useCommunityStore((s) => s.setScope);
  const status = useCommunityStore((s) => s.status);
  const fetchShares = useCommunityStore((s) => s.fetch);
  const shareSongs = useCommunityStore((s) => s.shareSongs);
  const toggleVote = useCommunityStore((s) => s.toggleVote);

  const [ciudad, setCiudad] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerGenre, setPickerGenre] = useState<string | null>(null);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('users')
      .select('ciudad')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setCiudad(data?.ciudad ?? null));
  }, [userId]);

  useEffect(() => {
    if (userId) fetchShares(userId, ciudad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ciudad, scope]);

  const openPicker = async () => {
    setPickerOpen(true);
    setSelectedSongIds([]);
    if (catalog.length === 0) {
      const { data } = await supabase.from('songs').select('*').order('genero').order('orden');
      setCatalog(data ?? []);
    }
  };

  const toggleSongPick = (songId: string) => {
    Haptics.selectionAsync();
    setSelectedSongIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId],
    );
  };

  const confirmShare = async () => {
    if (!userId || selectedSongIds.length === 0) return;
    setSharing(true);
    try {
      await shareSongs(userId, selectedSongIds, ciudad);
      setPickerOpen(false);
      setPickerGenre(null);
      setSelectedSongIds([]);
    } catch (err) {
      Alert.alert('No se pudo compartir', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setSharing(false);
    }
  };

  const genres = [...new Set(catalog.map((s) => s.genero))];
  const top = shares[0];
  const rest = shares.slice(1);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Trends comunitarios</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.scopeRow}>
          <Pressable
            style={[styles.scopeChip, scope === 'global' && styles.scopeChipSelected]}
            onPress={() => setScope('global')}
          >
            <Text style={[styles.scopeChipText, scope === 'global' && styles.scopeChipTextSelected]}>
              Global
            </Text>
          </Pressable>
          <Pressable
            style={[styles.scopeChip, scope === 'ciudad' && styles.scopeChipSelected]}
            onPress={() => setScope('ciudad')}
          >
            <Text style={[styles.scopeChipText, scope === 'ciudad' && styles.scopeChipTextSelected]}>
              Mi ciudad{ciudad ? ` (${ciudad})` : ''}
            </Text>
          </Pressable>
        </View>

        {scope === 'ciudad' && !ciudad && (
          <Text style={styles.hint}>Tu perfil todavía no tiene ciudad guardada — no habrá resultados.</Text>
        )}

        <Pressable style={styles.shareButton} onPress={openPicker}>
          <Text style={styles.shareButtonText}>+ Compartir canción o playlist</Text>
        </Pressable>

        {pickerOpen && (
          <View style={styles.pickerCard}>
            {pickerGenre === null ? (
              <>
                <Text style={styles.formLabel}>Elige un género</Text>
                <View style={styles.genreWrap}>
                  {genres.map((g) => (
                    <Pressable key={g} style={styles.genreChip} onPress={() => setPickerGenre(g)}>
                      <Text style={styles.genreChipLabel}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.pickerHeader}>
                  <Text style={styles.formLabel}>{pickerGenre}</Text>
                  <Pressable onPress={() => setPickerGenre(null)}>
                    <Text style={styles.addLink}>‹ Géneros</Text>
                  </Pressable>
                </View>
                {catalog
                  .filter((s) => s.genero === pickerGenre)
                  .map((s) => {
                    const selected = selectedSongIds.includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.trackRow, selected && styles.trackRowSelected]}
                        onPress={() => toggleSongPick(s.id)}
                      >
                        <View style={styles.trackTextWrap}>
                          <Text style={styles.trackTitle} numberOfLines={1}>
                            {s.titulo}
                          </Text>
                          <Text style={styles.trackMeta} numberOfLines={1}>
                            {s.artista}
                          </Text>
                        </View>
                        <Text style={styles.trackCheck}>{selected ? '✓' : ''}</Text>
                      </Pressable>
                    );
                  })}
              </>
            )}

            <View style={styles.pickerActions}>
              <Pressable
                onPress={() => {
                  setPickerOpen(false);
                  setPickerGenre(null);
                  setSelectedSongIds([]);
                }}
              >
                <Text style={styles.cancelLink}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, selectedSongIds.length === 0 && styles.confirmButtonDisabled]}
                disabled={selectedSongIds.length === 0 || sharing}
                onPress={confirmShare}
              >
                <Text style={styles.confirmButtonText}>
                  {sharing ? 'Compartiendo...' : `Compartir (${selectedSongIds.length})`}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {status === 'loading' && shares.length === 0 && <Text style={styles.hint}>Cargando...</Text>}
        {status === 'ready' && shares.length === 0 && (
          <Text style={styles.hint}>Nadie ha compartido nada esta semana todavía.</Text>
        )}

        {top && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trend comunitario de la semana</Text>
            <ShareCard entry={top} highlighted userId={userId} onVote={() => userId && toggleVote(userId, top.share_id)} />
          </View>
        )}

        {rest.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Más compartidos</Text>
            {rest.map((entry) => (
              <ShareCard
                key={entry.share_id}
                entry={entry}
                userId={userId}
                onVote={() => userId && toggleVote(userId, entry.share_id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function ShareCard({
  entry,
  highlighted,
  userId,
  onVote,
}: {
  entry: CommunityShareWithSongs;
  highlighted?: boolean;
  userId: string | null;
  onVote: () => void;
}) {
  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      {entry.songs.map((song) => (
        <View key={song.id} style={styles.songRow}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {song.titulo}
          </Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {song.artista}
          </Text>
        </View>
      ))}
      {entry.caption && <Text style={styles.caption}>"{entry.caption}"</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.meta}>
          {entry.user_id === userId ? 'Compartido por ti' : 'Compartido por alguien más'}
        </Text>
        <Pressable style={styles.voteButton} onPress={onVote}>
          <Text style={[styles.voteButtonText, entry.iVoted && styles.voteButtonTextActive]}>
            {entry.iVoted ? '❤️' : '🤍'} {entry.vote_count}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
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
  scopeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scopeChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  scopeChipSelected: {
    backgroundColor: colors.accentSecondary,
    borderColor: colors.accentSecondary,
  },
  scopeChipText: {
    ...type.label,
    color: colors.textSecondary,
  },
  scopeChipTextSelected: {
    color: colors.onAccent,
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
  },
  shareButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
  },
  shareButtonText: {
    ...type.label,
    color: colors.accentPrimary,
  },
  pickerCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formLabel: {
    ...type.label,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  addLink: {
    ...type.label,
    color: colors.accentSecondary,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genreChip: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  genreChipLabel: {
    ...type.body,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  trackRowSelected: {
    borderColor: colors.accentSecondary,
    backgroundColor: colors.accentSecondaryMuted,
  },
  trackTextWrap: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    ...type.body,
    color: colors.textPrimary,
  },
  trackMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  trackCheck: {
    ...type.h2,
    color: colors.accentSecondary,
    width: 24,
    textAlign: 'center',
  },
  pickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  cancelLink: {
    ...type.label,
    color: colors.textMuted,
  },
  confirmButton: {
    backgroundColor: colors.accentSecondary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    ...type.label,
    color: colors.onAccent,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  cardHighlighted: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimaryMuted,
  },
  songRow: {
    gap: 2,
  },
  songTitle: {
    ...type.body,
    color: colors.textPrimary,
  },
  songArtist: {
    ...type.caption,
    color: colors.textSecondary,
  },
  caption: {
    ...type.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  meta: {
    ...type.caption,
    color: colors.textMuted,
  },
  voteButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  voteButtonText: {
    ...type.label,
    color: colors.textSecondary,
  },
  voteButtonTextActive: {
    color: colors.accentPrimary,
  },
});
