import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useSquadStore } from '../../store/useSquadStore';
import { useSquadPlaylistStore } from '../../store/useSquadPlaylistStore';
import { supabase } from '../../lib/supabase';
import { Tables } from '../../types/database';
import { ARCHETYPES } from '../../lib/archetypes';
import { compatScore } from '../../lib/compat';
import { colors, radii, spacing, type } from '../../theme';

type Song = Tables<'songs'>;

type Props = NativeStackScreenProps<RootStackParamList, 'SquadDetail'>;

export function SquadDetailScreen({ route, navigation }: Props) {
  const { squadId } = route.params;
  const userId = useSessionStore((s) => s.userId);
  const profile = useProfileStore((s) => s.profile);
  const squads = useSquadStore((s) => s.squads);
  const fetchMySquads = useSquadStore((s) => s.fetchMySquads);
  const leaveSquad = useSquadStore((s) => s.leaveSquad);

  const tracksBySquad = useSquadPlaylistStore((s) => s.tracksBySquad);
  const fetchPlaylist = useSquadPlaylistStore((s) => s.fetch);
  const addSong = useSquadPlaylistStore((s) => s.addSong);
  const removeTrack = useSquadPlaylistStore((s) => s.removeTrack);
  const tracks = tracksBySquad[squadId] ?? [];

  const [catalog, setCatalog] = useState<Song[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerGenre, setPickerGenre] = useState<string | null>(null);

  const entry = squads.find((s) => s.squad.id === squadId);

  useEffect(() => {
    if (!entry && userId) fetchMySquads(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, entry]);

  useEffect(() => {
    fetchPlaylist(squadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId]);

  const openPicker = async () => {
    setPickerOpen(true);
    if (catalog.length === 0) {
      const { data } = await supabase.from('songs').select('*').order('genero').order('orden');
      setCatalog(data ?? []);
    }
  };

  const handleAddSong = async (songId: string) => {
    if (!userId) return;
    try {
      await addSong(squadId, songId, userId);
      setPickerOpen(false);
      setPickerGenre(null);
    } catch (err) {
      Alert.alert('No se pudo agregar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    }
  };

  const handleRemoveTrack = (trackId: string) => {
    Alert.alert('Quitar canción', '¿Quitar esta canción de la playlist del squad?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTrack(squadId, trackId);
          } catch (err) {
            Alert.alert('No se pudo quitar', err instanceof Error ? err.message : 'Intenta de nuevo.');
          }
        },
      },
    ]);
  };

  const genres = [...new Set(catalog.map((s) => s.genero))];

  if (!entry) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.hint}>Cargando squad...</Text>
      </Screen>
    );
  }

  const { squad, members } = entry;
  const squadAverage =
    members.length === 0 ? 100 : Math.round(members.reduce((sum, m) => sum + m.compat_score, 0) / members.length);

  const handleShareCode = async () => {
    Haptics.selectionAsync();
    const available = await Sharing.isAvailableAsync();
    const message = `Únete a mi squad "${squad.nombre}" en Musicaleando. Código: ${squad.invite_code}`;
    if (available) {
      // expo-sharing shares files; for plain text we fall back to the Alert
      // so the user can copy it manually — no extra dependency needed for MVP.
      Alert.alert('Código de invitación', message);
    } else {
      Alert.alert('Código de invitación', message);
    }
  };

  const isOwner = userId === squad.owner_id;

  const handleRemoveMember = (memberUserId: string, memberLabel: string) => {
    Alert.alert('Quitar del squad', `¿Quitar a ${memberLabel} de "${squad.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            // Same delete leaveSquad already does — RLS decides who's allowed to
            // remove which row (self, or the squad owner removing anyone).
            await leaveSquad(squadId, memberUserId);
          } catch (err) {
            Alert.alert('No se pudo quitar', err instanceof Error ? err.message : 'Intenta de nuevo.');
          }
        },
      },
    ]);
  };

  const handleLeave = () => {
    Alert.alert('Salir del squad', `¿Seguro que quieres salir de "${squad.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          try {
            await leaveSquad(squadId, userId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('No se pudo salir', err instanceof Error ? err.message : 'Intenta de nuevo.');
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{squad.nombre}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryScore}>{squadAverage}%</Text>
          <Text style={styles.summaryLabel}>Compatibilidad promedio del squad</Text>
        </View>

        <Pressable style={styles.codeCard} onPress={handleShareCode}>
          <View>
            <Text style={styles.codeLabel}>Código de invitación</Text>
            <Text style={styles.codeValue}>{squad.invite_code}</Text>
          </View>
          <Text style={styles.codeShare}>Compartir ↗</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Miembros</Text>
          {members.map((member) => {
            const archetype = member.arquetipo ? ARCHETYPES[member.arquetipo as keyof typeof ARCHETYPES] : undefined;
            const isMe = member.user_id === userId;
            const contigo =
              !isMe && profile
                ? compatScore({ generos: profile.generos as string[], energia: profile.energia }, member)
                : null;

            const memberLabel = archetype?.label ?? 'Perfil incompleto';

            return (
              <View key={member.user_id} style={styles.memberRow}>
                <Text style={styles.memberEmoji}>{archetype?.emoji ?? '🎧'}</Text>
                <View style={styles.memberTextWrap}>
                  <Text style={styles.memberLabel}>
                    {memberLabel} {isMe ? '(tú)' : ''}
                  </Text>
                  <Text style={styles.memberMeta}>Compat. con el squad: {Math.round(member.compat_score)}%</Text>
                </View>
                {contigo !== null && <Text style={styles.memberContigo}>{contigo}% contigo</Text>}
                {isOwner && !isMe && (
                  <Pressable hitSlop={8} onPress={() => handleRemoveMember(member.user_id, memberLabel)}>
                    <Text style={styles.removeLink}>Quitar</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.playlistHeader}>
            <Text style={styles.sectionLabel}>Playlist del squad</Text>
            <Pressable onPress={openPicker}>
              <Text style={styles.addLink}>+ Agregar canción</Text>
            </Pressable>
          </View>

          {tracks.length === 0 && <Text style={styles.hint}>Nadie ha agregado canciones todavía.</Text>}

          {tracks.map((track) => (
            <Pressable key={track.id} style={styles.trackRow} onLongPress={() => handleRemoveTrack(track.id)}>
              <View style={styles.memberTextWrap}>
                <Text style={styles.memberLabel} numberOfLines={1}>
                  {track.song.titulo}
                </Text>
                <Text style={styles.memberMeta} numberOfLines={1}>
                  {track.song.artista}
                  {track.added_by === userId ? ' · agregada por ti' : ''}
                </Text>
              </View>
            </Pressable>
          ))}

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
                  <View style={styles.playlistHeader}>
                    <Text style={styles.formLabel}>{pickerGenre}</Text>
                    <Pressable onPress={() => setPickerGenre(null)}>
                      <Text style={styles.addLink}>‹ Géneros</Text>
                    </Pressable>
                  </View>
                  {catalog
                    .filter((s) => s.genero === pickerGenre)
                    .map((s) => (
                      <Pressable key={s.id} style={styles.trackRow} onPress={() => handleAddSong(s.id)}>
                        <View style={styles.memberTextWrap}>
                          <Text style={styles.memberLabel} numberOfLines={1}>
                            {s.titulo}
                          </Text>
                          <Text style={styles.memberMeta} numberOfLines={1}>
                            {s.artista}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                </>
              )}
              <Pressable onPress={() => { setPickerOpen(false); setPickerGenre(null); }}>
                <Text style={styles.cancelLink}>Cancelar</Text>
              </Pressable>
            </View>
          )}
        </View>

        <PrimaryButton label="Salir del squad" variant="secondary" onPress={handleLeave} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
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
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.accentPrimaryMuted,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  summaryScore: {
    ...type.display,
    color: colors.accentPrimary,
  },
  summaryLabel: {
    ...type.body,
    color: colors.textSecondary,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  codeLabel: {
    ...type.caption,
    color: colors.textSecondary,
  },
  codeValue: {
    ...type.h1,
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  codeShare: {
    ...type.label,
    color: colors.accentSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  memberEmoji: {
    fontSize: 28,
  },
  memberTextWrap: {
    flex: 1,
    gap: 2,
  },
  memberLabel: {
    ...type.body,
    color: colors.textPrimary,
  },
  memberMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  memberContigo: {
    ...type.label,
    color: colors.accentPrimary,
  },
  removeLink: {
    ...type.caption,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  playlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addLink: {
    ...type.label,
    color: colors.accentSecondary,
  },
  trackRow: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pickerCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  formLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genreChip: {
    backgroundColor: colors.bgElevated,
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
  cancelLink: {
    ...type.label,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
