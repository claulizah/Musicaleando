import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Screen } from '../../components/Screen';
import { GradientTile } from '../../components/GradientTile';
import { ArchetypeCard } from '../../components/ArchetypeCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useSquadStore } from '../../store/useSquadStore';
import { useSquadTournamentStore } from '../../store/useSquadTournamentStore';
import { GENEROS } from '../../lib/archetypes';
import { fetchTournamentArtists, TournamentArtist } from '../../lib/spotify';
import { roundLabel } from '../../lib/tournament';
import { colors, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SquadTorneo'>;

function generoGradient(generoId: string): readonly [string, string] {
  return GENEROS.find((g) => g.id === generoId)?.gradient ?? (['#8B5CF6', '#4C3184'] as const);
}

export function SquadTorneoScreen({ route, navigation }: Props) {
  const { squadId } = route.params;
  const userId = useSessionStore((s) => s.userId);
  const squads = useSquadStore((s) => s.squads);
  const fetchMySquads = useSquadStore((s) => s.fetchMySquads);
  const stateBySquad = useSquadTournamentStore((s) => s.stateBySquad);
  const votesByTurn = useSquadTournamentStore((s) => s.votesByTurn);
  const fetchTournament = useSquadTournamentStore((s) => s.fetch);
  const start = useSquadTournamentStore((s) => s.start);
  const voteAction = useSquadTournamentStore((s) => s.vote);
  const advance = useSquadTournamentStore((s) => s.advance);

  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  const entry = squads.find((s) => s.squad.id === squadId);
  const tournament = stateBySquad[squadId];

  useEffect(() => {
    if (!entry && userId) fetchMySquads(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, entry]);

  useEffect(() => {
    fetchTournament(squadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId]);

  const isOwner = entry ? userId === entry.squad.owner_id : false;
  const votes = tournament ? votesByTurn[`${squadId}:${tournament.turn}`] ?? [] : [];
  const myVote = votes.find((v) => v.user_id === userId);

  const handleStart = async () => {
    if (!entry) return;
    setStarting(true);
    try {
      const unionGeneros = Array.from(new Set(entry.members.flatMap((m) => m.generos)));
      const generos = unionGeneros.length > 0 ? unionGeneros : ['pop'];
      const artists = await fetchTournamentArtists(generos);
      await start(squadId, artists);
    } catch (err) {
      Alert.alert('No se pudo iniciar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setStarting(false);
    }
  };

  const handleVote = async (artist: TournamentArtist) => {
    if (!userId || !tournament) return;
    Haptics.selectionAsync();
    try {
      await voteAction(squadId, tournament.turn, userId, artist.id);
    } catch (err) {
      Alert.alert('No se pudo votar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    }
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await advance(squadId);
    } catch (err) {
      Alert.alert('No se pudo avanzar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setAdvancing(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } else {
        Alert.alert('Compartir no disponible', 'Este dispositivo no soporta compartir archivos.');
      }
    } catch {
      Alert.alert('No se pudo generar la imagen', 'Intenta de nuevo en unos segundos.');
    } finally {
      setSharing(false);
    }
  };

  const remaining = useMemo(
    () => (tournament?.remaining as unknown as TournamentArtist[]) ?? [],
    [tournament],
  );
  const champion = tournament?.champion as unknown as TournamentArtist | null | undefined;

  if (!entry) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.hint}>Cargando squad...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Torneo del squad</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!tournament && (
        <View style={styles.center}>
          {isOwner ? (
            <>
              <Text style={styles.hint}>
                Vota entre todo el squad para elegir el himno oficial de &quot;{entry.squad.nombre}&quot;.
              </Text>
              <PrimaryButton
                label={starting ? 'Armando bracket...' : 'Iniciar torneo grupal'}
                onPress={handleStart}
                loading={starting}
              />
            </>
          ) : (
            <Text style={styles.hint}>
              Esperando a que el owner del squad inicie el torneo grupal.
            </Text>
          )}
        </View>
      )}

      {tournament && champion && (
        <View style={styles.center}>
          <View style={styles.cardWrap}>
            <ArchetypeCard
              ref={cardRef}
              archetype={{
                id: champion.id,
                label: `Himno: ${champion.name}`,
                emoji: '🏆',
                description: `El himno oficial de "${entry.squad.nombre}", elegido por votación del squad.`,
                gradient: generoGradient(champion.generoId),
              }}
              image={champion.imageUrl ? { uri: champion.imageUrl } : undefined}
            />
          </View>
          <View style={styles.actions}>
            <PrimaryButton label="Compartir" variant="secondary" onPress={handleShare} loading={sharing} />
            {isOwner && (
              <PrimaryButton
                label={starting ? 'Armando bracket...' : 'Jugar de nuevo'}
                variant="secondary"
                onPress={handleStart}
                loading={starting}
              />
            )}
            <PrimaryButton label="Listo" onPress={() => navigation.goBack()} />
          </View>
        </View>
      )}

      {tournament && !champion && remaining.length >= 2 && (
        <View style={styles.playArea}>
          <View style={styles.roundLabelWrap}>
            <Text style={styles.roundLabel}>{roundLabel(tournament.round)}</Text>
            <Text style={styles.title}>¿Cuál representa más al squad?</Text>
            <Text style={styles.voteCount}>
              {votes.length} {votes.length === 1 ? 'voto' : 'votos'} en este matchup
            </Text>
          </View>

          <View style={styles.duelRow}>
            {[remaining[0], remaining[1]].map((artist) => {
              const artistVotes = votes.filter((v) => v.artist_id === artist.id).length;
              const isMyVote = myVote?.artist_id === artist.id;
              return (
                <View key={artist.id} style={styles.tileWrap}>
                  <GradientTile
                    emoji="🎤"
                    label={artist.name}
                    gradient={generoGradient(artist.generoId)}
                    image={artist.imageUrl ? { uri: artist.imageUrl } : undefined}
                    onPress={() => handleVote(artist)}
                    style={styles.tile}
                  />
                  <Text style={styles.tileVotes}>
                    {isMyVote ? '✓ ' : ''}
                    {artistVotes} {artistVotes === 1 ? 'voto' : 'votos'}
                  </Text>
                </View>
              );
            })}
          </View>

          {isOwner && (
            <PrimaryButton
              label={advancing ? 'Avanzando...' : 'Avanzar ronda'}
              variant="secondary"
              onPress={handleAdvance}
              loading={advancing}
            />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  back: {
    ...type.h1,
    color: colors.textPrimary,
    width: 24,
  },
  headerTitle: {
    ...type.h2,
    color: colors.textPrimary,
    flex: 1,
  },
  headerSpacer: {
    width: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cardWrap: {
    width: '100%',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  playArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  roundLabelWrap: {
    gap: spacing.xs,
  },
  roundLabel: {
    ...type.label,
    color: colors.accentSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    ...type.h1,
    color: colors.textPrimary,
  },
  voteCount: {
    ...type.body,
    color: colors.textMuted,
  },
  duelRow: {
    flex: 1,
    gap: spacing.md,
  },
  tileWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  tile: {
    flex: 1,
  },
  tileVotes: {
    ...type.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
