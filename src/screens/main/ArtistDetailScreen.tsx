import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { RootStackParamList } from '../../navigation/types';
import { useFestivalStore } from '../../store/useFestivalStore';
import { useSessionStore } from '../../store/useSessionStore';
import { fetchFollowedArtistIds, followArtist, unfollowArtist } from '../../lib/followArtists';
import { hasPushPermission, requestPushPermissionAndRegister } from '../../lib/pushNotifications';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistDetail'>;

const TIPO_BADGE: Record<string, string> = {
  festival: '🎪 Festival',
  concierto: '🎤 Concierto',
};

function formatRange(inicio: string, fin: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  return inicio === fin ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fin)}`;
}

// Las apariciones de un artista se derivan de lo que useFestivalStore ya
// cargó (todos los festivales + su festival_lineup completo) — no hace
// falta una consulta nueva, solo filtrar por artist_id en lo que ya está en
// memoria. Igual que el panel admin, esta ficha no agrega ni un dato de
// artista que no viniera ya de un evento real (sin bio, sin imagen, sin
// redes — ver prompt-siguiente-ficha-artista.md).
export function ArtistDetailScreen({ route, navigation }: Props) {
  const { artistId, artistName } = route.params;
  const festivals = useFestivalStore((s) => s.festivals);
  const status = useFestivalStore((s) => s.status);
  const userId = useSessionStore((s) => s.userId);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchFollowedArtistIds(userId).then((ids) => setFollowing(ids.has(artistId)));
  }, [userId, artistId]);

  const handleToggleFollow = async () => {
    if (!userId || followLoading) return;
    setFollowLoading(true);
    try {
      if (following) {
        const ok = await unfollowArtist(userId, artistId);
        if (ok) setFollowing(false);
        return;
      }

      // El permiso de notificaciones se pide justo aquí — el primer momento
      // en que el usuario expresa intención real de recibir avisos — nunca
      // al abrir la app. Si lo niega, igual lo dejamos seguir al artista:
      // "seguir" y "recibir push" son cosas separadas, y no tener push no
      // debe bloquear la parte de seguimiento en sí.
      const alreadyGranted = await hasPushPermission();
      if (!alreadyGranted) {
        const granted = await requestPushPermissionAndRegister(userId);
        if (!granted) {
          Alert.alert(
            'Notificaciones desactivadas',
            'Puedes seguir al artista igual, pero no te avisaremos de nuevos eventos hasta que actives las notificaciones desde los ajustes de tu teléfono.',
          );
        }
      } else {
        await requestPushPermissionAndRegister(userId);
      }

      const ok = await followArtist(userId, artistId);
      if (ok) setFollowing(true);
    } finally {
      setFollowLoading(false);
    }
  };

  const appearances = festivals
    .filter((entry) => entry.festival.estado_evento !== 'archivado')
    .filter((entry) => entry.lineup.some((l) => l.artist_id === artistId))
    .slice()
    .sort((a, b) => a.festival.fecha_inicio.localeCompare(b.festival.fecha_inicio));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {artistName}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <Pressable
          style={[styles.followButton, following && styles.followButtonActive]}
          onPress={handleToggleFollow}
          disabled={followLoading || !userId}
        >
          <Text style={[styles.followButtonText, following && styles.followButtonTextActive]}>
            {following ? '🔕 Dejar de seguir' : '🔔 Seguir'}
          </Text>
        </Pressable>

        {status === 'loading' && festivals.length === 0 && (
          <Text style={styles.hint}>Cargando eventos...</Text>
        )}
        {status === 'ready' && appearances.length === 0 && (
          <Text style={styles.hint}>No encontramos próximos eventos de {artistName} todavía.</Text>
        )}

        {appearances.map((entry) => (
          <Pressable
            key={entry.festival.id}
            style={styles.card}
            onPress={() => navigation.navigate('Festivals', { highlightFestivalId: entry.festival.id })}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.nombre}>{entry.festival.nombre}</Text>
              <Text style={styles.tipoBadge}>{TIPO_BADGE[entry.festival.tipo] ?? '🎪 Festival'}</Text>
            </View>
            <Text style={styles.meta}>
              {entry.festival.ciudad} · {formatRange(entry.festival.fecha_inicio, entry.festival.fecha_fin)}
            </Text>
            <Text style={styles.linkHint}>Ver evento ›</Text>
          </Pressable>
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
    gap: spacing.sm,
  },
  back: {
    ...type.h1,
    color: colors.textPrimary,
    width: 32,
  },
  headerTitle: {
    ...type.h2,
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
  },
  followButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  followButtonActive: {
    borderColor: colors.accentSecondary,
    backgroundColor: colors.accentSecondaryMuted,
  },
  followButtonText: {
    ...type.label,
    color: colors.textPrimary,
  },
  followButtonTextActive: {
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nombre: {
    ...type.h2,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  tipoBadge: {
    ...type.caption,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  meta: {
    ...type.body,
    color: colors.textSecondary,
  },
  linkHint: {
    ...type.label,
    color: colors.accentPrimary,
  },
});
