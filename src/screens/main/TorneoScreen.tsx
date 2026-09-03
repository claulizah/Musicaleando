import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Screen } from '../../components/Screen';
import { QuizProgressBar } from '../../components/QuizProgressBar';
import { GradientTile } from '../../components/GradientTile';
import { ArchetypeCard } from '../../components/ArchetypeCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useProfileStore } from '../../store/useProfileStore';
import { GENEROS } from '../../lib/archetypes';
import { fetchTournamentArtists, TournamentArtist } from '../../lib/spotify';
import { TOURNAMENT_DUEL_COUNT, roundLabel, shuffled } from '../../lib/tournament';
import { colors, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Torneo'>;
type LoadStatus = 'loading' | 'ready' | 'error';

function generoGradient(generoId: string): readonly [string, string] {
  return GENEROS.find((g) => g.id === generoId)?.gradient ?? (['#8B5CF6', '#4C3184'] as const);
}

export function TorneoScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const profile = useProfileStore((s) => s.profile);
  const applyTournamentChampion = useProfileStore((s) => s.applyTournamentChampion);

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [pool, setPool] = useState<TournamentArtist[]>([]);
  const [queue, setQueue] = useState<TournamentArtist[]>([]);
  const [winners, setWinners] = useState<TournamentArtist[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [duelIndex, setDuelIndex] = useState(0);
  const [champion, setChampion] = useState<TournamentArtist | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  const loadArtists = async () => {
    setLoadStatus('loading');
    try {
      const generos = (profile?.generos as string[] | undefined) ?? [];
      const artists = await fetchTournamentArtists(generos);
      setPool(artists);
      setQueue(shuffled(artists));
      setLoadStatus('ready');
    } catch {
      setLoadStatus('error');
    }
  };

  useEffect(() => {
    loadArtists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pairA = queue[0];
  const pairB = queue[1];

  const choose = async (winner: TournamentArtist) => {
    Haptics.selectionAsync();
    const restOfQueue = queue.slice(2);
    const nextWinners = [...winners, winner];
    const nextDuelIndex = duelIndex + 1;

    if (restOfQueue.length >= 2) {
      setQueue(restOfQueue);
      setWinners(nextWinners);
      setDuelIndex(nextDuelIndex);
      return;
    }

    if (nextWinners.length === 1) {
      setChampion(nextWinners[0]);
      setDuelIndex(nextDuelIndex);
      if (userId) {
        setSaving(true);
        try {
          await applyTournamentChampion(userId, nextWinners[0]);
        } catch {
          Alert.alert('No se pudo guardar', 'Tu campeón se calculó pero no se guardó en tu perfil. Intenta de nuevo más tarde.');
        } finally {
          setSaving(false);
        }
      }
      return;
    }

    setQueue(nextWinners);
    setWinners([]);
    setRoundIndex(roundIndex + 1);
    setDuelIndex(nextDuelIndex);
  };

  const playAgain = () => {
    setQueue(shuffled(pool));
    setWinners([]);
    setRoundIndex(0);
    setDuelIndex(0);
    setChampion(null);
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

  if (loadStatus === 'loading') {
    return (
      <Screen style={styles.center}>
        <Text style={styles.calculatingText}>Armando el bracket con artistas reales...</Text>
      </Screen>
    );
  }

  if (loadStatus === 'error') {
    return (
      <Screen style={styles.center}>
        <Text style={styles.errorText}>
          No pudimos cargar artistas para el torneo. Revisa tu conexión e intenta de nuevo.
        </Text>
        <PrimaryButton label="Reintentar" onPress={loadArtists} />
        <PrimaryButton label="Volver" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  if (champion) {
    return (
      <Screen style={styles.center}>
        <View style={styles.cardWrap}>
          <ArchetypeCard
            ref={cardRef}
            archetype={{
              id: champion.id,
              label: `Campeón: ${champion.name}`,
              emoji: '🎤',
              description: 'De 8 artistas en pista, este ganó el Torneo Sonoro.',
              gradient: generoGradient(champion.generoId),
            }}
            image={champion.imageUrl ? { uri: champion.imageUrl } : undefined}
          />
        </View>
        {saving && <Text style={styles.savingHint}>Guardando en tu perfil...</Text>}
        <View style={styles.actions}>
          <PrimaryButton label="Compartir" variant="secondary" onPress={handleShare} loading={sharing} />
          <PrimaryButton label="Jugar de nuevo" variant="secondary" onPress={playAgain} />
          <PrimaryButton label="Listo" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.progressWrap}>
          <QuizProgressBar count={TOURNAMENT_DUEL_COUNT} activeIndex={duelIndex} />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.roundLabelWrap}>
        <Text style={styles.roundLabel}>{roundLabel(roundIndex)}</Text>
        <Text style={styles.title}>¿Cuál te representa más?</Text>
      </View>

      <View style={styles.duelRow}>
        <GradientTile
          emoji="🎤"
          label={pairA.name}
          gradient={generoGradient(pairA.generoId)}
          image={pairA.imageUrl ? { uri: pairA.imageUrl } : undefined}
          onPress={() => choose(pairA)}
          style={styles.tile}
        />
        <GradientTile
          emoji="🎤"
          label={pairB.name}
          gradient={generoGradient(pairB.generoId)}
          image={pairB.imageUrl ? { uri: pairB.imageUrl } : undefined}
          onPress={() => choose(pairB)}
          style={styles.tile}
        />
      </View>
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
  progressWrap: {
    flex: 1,
  },
  headerSpacer: {
    width: 24,
  },
  roundLabelWrap: {
    marginBottom: spacing.lg,
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
  duelRow: {
    flex: 1,
    gap: spacing.md,
  },
  tile: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  cardWrap: {
    width: '100%',
  },
  savingHint: {
    ...type.body,
    color: colors.textSecondary,
  },
  calculatingText: {
    ...type.bodyLg,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
});
