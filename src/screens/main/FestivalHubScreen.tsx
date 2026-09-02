import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useFestivalStore, FestivalWithIntent } from '../../store/useFestivalStore';
import { FestivalStatus } from '../../types/database';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Festivals'>;

const STATUS_OPTIONS: { id: FestivalStatus; label: string }[] = [
  { id: 'voy', label: 'Voy' },
  { id: 'tal_vez', label: 'Tal vez' },
  { id: 'no_voy', label: 'No voy' },
];

function formatRange(inicio: string, fin: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return inicio === fin ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fin)}`;
}

export function FestivalHubScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const festivals = useFestivalStore((s) => s.festivals);
  const status = useFestivalStore((s) => s.status);
  const error = useFestivalStore((s) => s.error);
  const fetchFestivals = useFestivalStore((s) => s.fetch);
  const setFestivalStatus = useFestivalStore((s) => s.setStatus);

  useEffect(() => {
    if (userId) fetchFestivals(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Festivales</Text>
          <View style={styles.headerSpacer} />
        </View>

        {status === 'loading' && festivals.length === 0 && (
          <Text style={styles.hint}>Cargando festivales...</Text>
        )}
        {status === 'ready' && festivals.length === 0 && (
          <Text style={styles.hint}>Todavía no hay festivales cargados.</Text>
        )}
        {status === 'error' && (
          <Text style={styles.errorHint}>
            No se pudieron cargar los festivales{error ? `: ${error}` : '.'}
          </Text>
        )}

        {festivals.map((entry) => (
          <FestivalCard
            key={entry.festival.id}
            entry={entry}
            onSetStatus={(s) => userId && setFestivalStatus(userId, entry.festival.id, s)}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function FestivalCard({
  entry,
  onSetStatus,
}: {
  entry: FestivalWithIntent;
  onSetStatus: (status: FestivalStatus) => void;
}) {
  const { festival, myStatus, squadGoingCount, lineup } = entry;
  const [showLineup, setShowLineup] = useState(false);

  return (
    <View style={styles.card}>
      <Text style={styles.nombre}>{festival.nombre}</Text>
      <Text style={styles.meta}>
        {festival.ciudad} · {formatRange(festival.fecha_inicio, festival.fecha_fin)}
      </Text>

      {squadGoingCount > 0 && (
        <Text style={styles.squadHint}>
          👥 {squadGoingCount} {squadGoingCount === 1 ? 'de tu squad va' : 'de tu squad van'}
        </Text>
      )}

      {lineup.length > 0 && (
        <Pressable onPress={() => setShowLineup((v) => !v)}>
          <Text style={styles.lineupToggle}>
            {showLineup ? '▾' : '▸'} Line-up ({lineup.length})
          </Text>
        </Pressable>
      )}
      {showLineup &&
        lineup.map((artist) => (
          <Text key={artist.id} style={styles.lineupRow}>
            {artist.artista}
            {artist.escenario ? ` · ${artist.escenario}` : ''}
            {artist.horario
              ? ` · ${new Date(artist.horario).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : ''}
          </Text>
        ))}

      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((option) => {
          const selected = myStatus === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.statusPill, selected && styles.statusPillSelected]}
              onPress={() => onSetStatus(option.id)}
            >
              <Text style={[styles.statusPillText, selected && styles.statusPillTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {festival.link_boletos && (
        <Pressable
          style={styles.ticketsButton}
          onPress={() => Linking.openURL(festival.link_boletos!)}
        >
          <Text style={styles.ticketsButtonText}>Comprar boletos ↗</Text>
        </Pressable>
      )}
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
  hint: {
    ...type.body,
    color: colors.textSecondary,
  },
  errorHint: {
    ...type.body,
    color: colors.danger,
  },
  lineupToggle: {
    ...type.label,
    color: colors.textSecondary,
  },
  lineupRow: {
    ...type.label,
    color: colors.textSecondary,
    paddingLeft: spacing.sm,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  nombre: {
    ...type.h2,
    color: colors.textPrimary,
  },
  meta: {
    ...type.body,
    color: colors.textSecondary,
  },
  squadHint: {
    ...type.label,
    color: colors.accentPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statusPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statusPillSelected: {
    backgroundColor: colors.accentSecondary,
    borderColor: colors.accentSecondary,
  },
  statusPillText: {
    ...type.label,
    color: colors.textSecondary,
  },
  statusPillTextSelected: {
    color: colors.onAccent,
  },
  ticketsButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
  },
  ticketsButtonText: {
    ...type.label,
    color: colors.accentPrimary,
  },
});
