import React, { useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { MoodSelector } from '../../components/MoodSelector';
import { TrendCard } from '../../components/TrendCard';
import { PlaylistCard } from '../../components/PlaylistCard';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useTrendStore } from '../../store/useTrendStore';
import { usePlaylistStore } from '../../store/usePlaylistStore';
import { ARCHETYPES } from '../../lib/archetypes';
import { ARCHETYPE_IMAGES } from '../../lib/images';
import { formatTrend } from '../../lib/trends';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const today = useMoodStore((s) => s.today);
  const fetchLatestMood = useMoodStore((s) => s.fetchLatest);
  const setMood = useMoodStore((s) => s.setMood);
  const profile = useProfileStore((s) => s.profile);
  const profileStatus = useProfileStore((s) => s.status);
  const fetchProfile = useProfileStore((s) => s.fetch);
  const trend = useTrendStore((s) => s.trend);
  const fetchTrend = useTrendStore((s) => s.fetch);
  const songs = usePlaylistStore((s) => s.songs);
  const fetchPlaylist = usePlaylistStore((s) => s.fetch);

  useEffect(() => {
    if (!userId) return;
    fetchLatestMood(userId);
    if (profileStatus === 'idle') fetchProfile(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // profile.arquetipo can be a stale id from before an archetype-engine change
  // (or a refine in progress) — treat "no matching archetype" as "no profile yet",
  // not as "still loading", so the UI never hangs on a permanent loading state.
  const archetype = profile?.arquetipo ? ARCHETYPES[profile.arquetipo as keyof typeof ARCHETYPES] : undefined;
  const isLoading = profileStatus === 'idle' || profileStatus === 'loading';

  useEffect(() => {
    if (!userId || !archetype || !profile) return;
    fetchTrend(userId);
    fetchPlaylist(profile.generos as string[], today ?? 'fiesta');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, archetype, today]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>MUSICALEANDO</Text>
            <Text style={styles.title}>Hola de nuevo</Text>
          </View>
          <Pressable style={styles.squadButton} onPress={() => navigation.navigate('Squads')}>
            <Text style={styles.squadButtonText}>👥</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tu mood de hoy</Text>
          <MoodSelector
            value={today}
            onChange={(mood) => userId && setMood(userId, mood)}
          />
        </View>

        <Pressable
          style={styles.profileCard}
          onPress={() => navigation.navigate(archetype ? 'Profile' : 'Quiz')}
        >
          {isLoading ? (
            <Text style={styles.profileHint}>Cargando tu perfil...</Text>
          ) : archetype ? (
            <>
              {profile?.arquetipo && ARCHETYPE_IMAGES[profile.arquetipo] ? (
                <Image source={ARCHETYPE_IMAGES[profile.arquetipo]} style={styles.profileImage} />
              ) : (
                <Text style={styles.profileEmoji}>{archetype.emoji}</Text>
              )}
              <View style={styles.profileTextWrap}>
                <Text style={styles.profileLabel}>{archetype.label}</Text>
                <Text style={styles.profileHint}>Ver tu perfil musical →</Text>
              </View>
            </>
          ) : (
            <Text style={styles.profileHint}>Completa tu perfil musical →</Text>
          )}
        </Pressable>

        {trend && <TrendCard trend={formatTrend(trend)} />}
        {songs.length > 0 && <PlaylistCard songs={songs} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flexShrink: 1,
    flex: 1,
    paddingRight: spacing.sm,
  },
  eyebrow: {
    ...type.label,
    color: colors.accentSecondary,
    letterSpacing: 2,
  },
  title: {
    ...type.display,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  squadButton: {
    flexShrink: 0,
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squadButtonText: {
    fontSize: 20,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  profileEmoji: {
    fontSize: 40,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
  },
  profileTextWrap: {
    flex: 1,
    gap: 2,
  },
  profileLabel: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  profileHint: {
    ...type.body,
    color: colors.textSecondary,
  },
});
