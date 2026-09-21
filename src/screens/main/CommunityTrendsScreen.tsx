import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useCommunityStore, CommunityShareWithSongs } from '../../store/useCommunityStore';
import { supabase } from '../../lib/supabase';
import { GENEROS } from '../../lib/archetypes';
import { promptReportContent } from '../../lib/moderation';
import { openListenLink } from '../../lib/musicLinks';
import { resolveOrCreateSong } from '../../lib/resolveOrCreateSong';
import { ContentReportMotivo } from '../../types/database';
import { colors, radii, spacing, type } from '../../theme';
import { WhatsNewCard } from '../../components/WhatsNewCard';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityTrends'>;

// La iTunes Search API es pública, sin API key — se llama directo, sin CORS
// que resolver (a diferencia del panel admin en navegador, aquí es una app
// nativa). Mismo endpoint que se usó para el buscador de canciones del panel.
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

type ItunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  primaryGenreName?: string;
  artworkUrl60?: string;
};

type StagedTrack = { trackId: number; titulo: string; artista: string; genero?: string };

export function CommunityTrendsScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const shares = useCommunityStore((s) => s.shares);
  const scope = useCommunityStore((s) => s.scope);
  const setScope = useCommunityStore((s) => s.setScope);
  const status = useCommunityStore((s) => s.status);
  const fetchShares = useCommunityStore((s) => s.fetch);
  const shareSongs = useCommunityStore((s) => s.shareSongs);
  const toggleVote = useCommunityStore((s) => s.toggleVote);
  const reportShare = useCommunityStore((s) => s.reportShare);

  const [ciudad, setCiudad] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ItunesTrack[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [stagedTracks, setStagedTracks] = useState<StagedTrack[]>([]);
  const [sharing, setSharing] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);

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

  const openPicker = () => {
    setPickerOpen(true);
    setStagedTracks([]);
    setQuery('');
    setResults([]);
    setSearchError('');
  };

  const closePicker = () => {
    setPickerOpen(false);
    setStagedTracks([]);
    setQuery('');
    setResults([]);
    setSearchError('');
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearchError('');
    }
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return;

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError('');
      try {
        const url = `${ITUNES_SEARCH_URL}?media=music&entity=song&limit=8&term=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('bad status');
        const data = (await res.json()) as { results?: ItunesTrack[] };
        setResults(data.results ?? []);
      } catch {
        setSearchError('No se pudo buscar. Intenta de nuevo.');
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const stageTrack = (track: ItunesTrack) => {
    Haptics.selectionAsync();
    setStagedTracks((prev) =>
      prev.some((t) => t.trackId === track.trackId)
        ? prev
        : [...prev, { trackId: track.trackId, titulo: track.trackName, artista: track.artistName, genero: track.primaryGenreName }],
    );
  };

  const unstageTrack = (trackId: number) => {
    setStagedTracks((prev) => prev.filter((t) => t.trackId !== trackId));
  };

  const confirmShare = async () => {
    if (!userId || stagedTracks.length === 0) return;
    setSharing(true);
    try {
      const songIds = await Promise.all(
        stagedTracks.map((t) => resolveOrCreateSong(t.titulo, t.artista, t.genero)),
      );
      await shareSongs(userId, songIds, ciudad);
      closePicker();
    } catch (err) {
      Alert.alert('No se pudo compartir', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setSharing(false);
    }
  };

  // "Trends avanzados" (Sprint 5): filter the ranking by género — data was
  // already loaded client-side (every share's songs come with the fetch),
  // this is purely a display filter, no new query.
  const filteredShares = genreFilter
    ? shares.filter((s) => s.songs.some((song) => song.genero === genreFilter))
    : shares;
  const top = filteredShares[0];
  const rest = filteredShares.slice(1);

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
        <WhatsNewCard screen="CommunityTrends" />

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
              Mi estado{ciudad ? ` (${ciudad})` : ''}
            </Text>
          </Pressable>
        </View>

        {scope === 'ciudad' && !ciudad && (
          <Text style={styles.hint}>Elige tu estado en Perfil para ver lo que comparte tu gente — por ahora no habrá resultados.</Text>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreFilterRow}>
          <Pressable
            style={[styles.genreFilterChip, genreFilter === null && styles.genreFilterChipSelected]}
            onPress={() => setGenreFilter(null)}
          >
            <Text
              style={[styles.genreFilterChipText, genreFilter === null && styles.genreFilterChipTextSelected]}
            >
              Todos
            </Text>
          </Pressable>
          {GENEROS.map((g) => (
            <Pressable
              key={g.id}
              style={[styles.genreFilterChip, genreFilter === g.id && styles.genreFilterChipSelected]}
              onPress={() => setGenreFilter(g.id)}
            >
              <Text
                style={[
                  styles.genreFilterChipText,
                  genreFilter === g.id && styles.genreFilterChipTextSelected,
                ]}
              >
                {g.emoji} {g.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={styles.shareButton} onPress={openPicker}>
          <Text style={styles.shareButtonText}>+ Compartir canción o playlist</Text>
        </Pressable>

        {pickerOpen && (
          <View style={styles.pickerCard}>
            <Text style={styles.formLabel}>Buscar canción o artista</Text>
            <TextInput
              value={query}
              onChangeText={handleQueryChange}
              placeholder="ej. Bad Bunny, Nueva York…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />

            {searchLoading && <Text style={styles.hint}>Buscando…</Text>}
            {searchError && <Text style={styles.errorText}>{searchError}</Text>}

            {results.length > 0 && (
              <View style={styles.resultsWrap}>
                {results.map((r) => {
                  const alreadyStaged = stagedTracks.some((t) => t.trackId === r.trackId);
                  return (
                    <Pressable
                      key={r.trackId}
                      style={[styles.trackRow, alreadyStaged && styles.trackRowSelected]}
                      disabled={alreadyStaged}
                      onPress={() => stageTrack(r)}
                    >
                      {r.artworkUrl60 && <Image source={{ uri: r.artworkUrl60 }} style={styles.artwork} />}
                      <View style={styles.trackTextWrap}>
                        <Text style={styles.trackTitle} numberOfLines={1}>
                          {r.trackName}
                        </Text>
                        <Text style={styles.trackMeta} numberOfLines={1}>
                          {r.artistName}
                        </Text>
                      </View>
                      <Text style={styles.trackCheck}>{alreadyStaged ? '✓' : '+'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {stagedTracks.length > 0 && (
              <View style={styles.stagedWrap}>
                <Text style={styles.formLabel}>Seleccionadas ({stagedTracks.length})</Text>
                {stagedTracks.map((t) => (
                  <View key={t.trackId} style={styles.stagedRow}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {t.titulo} <Text style={styles.trackMeta}>— {t.artista}</Text>
                    </Text>
                    <Pressable hitSlop={8} onPress={() => unstageTrack(t.trackId)}>
                      <Text style={styles.removeLink}>Quitar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.pickerActions}>
              <Pressable onPress={closePicker}>
                <Text style={styles.cancelLink}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, stagedTracks.length === 0 && styles.confirmButtonDisabled]}
                disabled={stagedTracks.length === 0 || sharing}
                onPress={confirmShare}
              >
                <Text style={styles.confirmButtonText}>
                  {sharing ? 'Compartiendo...' : `Compartir (${stagedTracks.length})`}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {status === 'loading' && shares.length === 0 && <Text style={styles.hint}>Cargando...</Text>}
        {status === 'ready' && shares.length === 0 && (
          <Text style={styles.hint}>Nadie ha compartido nada esta semana todavía.</Text>
        )}
        {status === 'ready' && shares.length > 0 && filteredShares.length === 0 && (
          <Text style={styles.hint}>Nadie compartió este género esta semana.</Text>
        )}

        {top && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trend comunitario de la semana</Text>
            <ShareCard
              entry={top}
              highlighted
              userId={userId}
              onVote={() => userId && toggleVote(userId, top.share_id)}
              onReport={(motivo) => userId && reportShare(userId, top.share_id, motivo)}
            />
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
                onReport={(motivo) => userId && reportShare(userId, entry.share_id, motivo)}
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
  onReport,
}: {
  entry: CommunityShareWithSongs;
  highlighted?: boolean;
  userId: string | null;
  onVote: () => void;
  onReport: (motivo: ContentReportMotivo) => void;
}) {
  const isMine = entry.user_id === userId;
  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      {entry.songs.map((song) => (
        <View key={song.id} style={styles.songRow}>
          <View style={styles.songTextWrap}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {song.titulo}
            </Text>
            <Text style={styles.songArtist} numberOfLines={1}>
              {song.artista}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            style={styles.listenButton}
            onPress={() => {
              openListenLink(song.artista, song.titulo).catch(() =>
                Alert.alert('No se pudo abrir', 'Intenta de nuevo en un momento.'),
              );
            }}
          >
            <Text style={styles.listenButtonText}>Escuchar ↗</Text>
          </Pressable>
        </View>
      ))}
      {entry.caption && <Text style={styles.caption}>"{entry.caption}"</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.meta}>{isMine ? 'Compartido por ti' : 'Compartido por alguien más'}</Text>
        <View style={styles.cardFooterActions}>
          {!isMine && (
            <Pressable hitSlop={8} onPress={() => promptReportContent(onReport)}>
              <Text style={styles.reportLink}>Reportar</Text>
            </Pressable>
          )}
          <Pressable style={styles.voteButton} onPress={onVote}>
            <Text style={[styles.voteButtonText, entry.iVoted && styles.voteButtonTextActive]}>
              {entry.iVoted ? '❤️' : '🤍'} {entry.vote_count}
            </Text>
          </Pressable>
        </View>
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
  genreFilterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  genreFilterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  genreFilterChipSelected: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  genreFilterChipText: {
    ...type.label,
    color: colors.textSecondary,
  },
  genreFilterChipTextSelected: {
    color: colors.onAccent,
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
  formLabel: {
    ...type.label,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  searchInput: {
    ...type.body,
    color: colors.textPrimary,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...type.caption,
    color: colors.danger,
  },
  resultsWrap: {
    gap: spacing.xs,
  },
  artwork: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    marginRight: spacing.sm,
  },
  stagedWrap: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  stagedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  removeLink: {
    ...type.caption,
    color: colors.textMuted,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  songTextWrap: {
    flex: 1,
    gap: 2,
  },
  songTitle: {
    ...type.body,
    color: colors.textPrimary,
  },
  songArtist: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  listenButton: {
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
  },
  listenButtonText: {
    ...type.caption,
    color: colors.accentPrimary,
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
  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reportLink: {
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
