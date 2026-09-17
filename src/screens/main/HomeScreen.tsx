import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { MoodSelector } from '../../components/MoodSelector';
import { TrendCard } from '../../components/TrendCard';
import { PlaylistCard } from '../../components/PlaylistCard';
import { RecommendedArtistCard } from '../../components/RecommendedArtistCard';
import { CollaborativeArtistCard } from '../../components/CollaborativeArtistCard';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useMoodStore } from '../../store/useMoodStore';
import { useProfileStore, readTorneoCampeon } from '../../store/useProfileStore';
import { useTrendStore } from '../../store/useTrendStore';
import { usePlaylistStore } from '../../store/usePlaylistStore';
import { useMoodPlaylistStore } from '../../store/useMoodPlaylistStore';
import { useContactsStore } from '../../store/useContactsStore';
import { useRecommendationsStore } from '../../store/useRecommendationsStore';
import { useRecommendationsV2Store } from '../../store/useRecommendationsV2Store';
import { useAchievementsStore } from '../../store/useAchievementsStore';
import { ARCHETYPES } from '../../lib/archetypes';
import { ARCHETYPE_IMAGES } from '../../lib/images';
import { formatTrend } from '../../lib/trends';
import { supabase } from '../../lib/supabase';
import { currentWeeklyChallenge, startOfWeekIso, WeeklyChallenge } from '../../lib/weeklyChallenge';
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
  const genericSongs = usePlaylistStore((s) => s.songs);
  const fetchGenericPlaylist = usePlaylistStore((s) => s.fetch);
  const moodSongs = useMoodPlaylistStore((s) => s.songs);
  const fetchMoodPlaylist = useMoodPlaylistStore((s) => s.fetch);
  const recommended = useRecommendationsStore((s) => s.artists);
  const fetchRecommended = useRecommendationsStore((s) => s.fetch);
  const recommendedV2 = useRecommendationsV2Store((s) => s.recommendations);
  const fetchRecommendedV2 = useRecommendationsV2Store((s) => s.fetch);
  const trendHistory = useTrendStore((s) => s.history);
  const fetchTrendHistory = useTrendStore((s) => s.fetchHistory);
  const [showHistory, setShowHistory] = useState(false);
  const fetchContacts = useContactsStore((s) => s.fetchAll);
  const festivalesConfirmados = useAchievementsStore((s) => s.festivalesConfirmados);
  const fetchAchievements = useAchievementsStore((s) => s.fetch);
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchLatestMood(userId);
    if (profileStatus === 'idle') fetchProfile(userId);
    fetchAchievements(userId);
    fetchContacts(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const sinceIso = startOfWeekIso();
      const [{ count: votesThisWeek }, { count: sharesThisWeek }] = await Promise.all([
        supabase
          .from('community_share_votes')
          .select('share_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', sinceIso),
        supabase
          .from('community_shares')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', sinceIso),
      ]);
      setChallenge(
        currentWeeklyChallenge({
          festivalesConfirmadosTotal: festivalesConfirmados,
          votesThisWeek: votesThisWeek ?? 0,
          sharesThisWeek: sharesThisWeek ?? 0,
        }),
      );
    })();
  }, [userId, festivalesConfirmados]);

  // profile.arquetipo can be a stale id from before an archetype-engine change
  // (or a refine in progress) — treat "no matching archetype" as "no profile yet",
  // not as "still loading", so the UI never hangs on a permanent loading state.
  const archetype = profile?.arquetipo ? ARCHETYPES[profile.arquetipo as keyof typeof ARCHETYPES] : undefined;
  const isLoading = profileStatus === 'idle' || profileStatus === 'loading';

  useEffect(() => {
    if (!userId || !archetype || !profile) return;
    fetchTrend(userId);
    fetchTrendHistory(userId);
    fetchGenericPlaylist(profile.generos as string[]);
    if (today) fetchMoodPlaylist(today, profile.generos as string[]);
    const champion = readTorneoCampeon((profile.flavor as Record<string, unknown>) ?? {});
    fetchRecommended((profile.generos as string[]) ?? [], champion?.generoId);
    fetchRecommendedV2(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, archetype, profile?.generos, profile?.flavor, today]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>MUSICALEANDO</Text>
            <Text style={styles.title}>Hola de nuevo</Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable style={styles.squadButton} onPress={() => navigation.navigate('Torneo')}>
              <Text style={styles.squadButtonText}>🏆</Text>
            </Pressable>
            <Pressable style={styles.squadButton} onPress={() => navigation.navigate('CommunityTrends')}>
              <Text style={styles.squadButtonText}>📈</Text>
            </Pressable>
            <Pressable style={styles.squadButton} onPress={() => navigation.navigate('Festivals')}>
              <Text style={styles.squadButtonText}>🎪</Text>
            </Pressable>
            <Pressable style={styles.squadButton} onPress={() => navigation.navigate('Squads')}>
              <Text style={styles.squadButtonText}>👥</Text>
            </Pressable>
            {/* "Tu red de conocidos" (Contacts) queda deliberadamente fuera
                de la navegación de este release — función diferida a una
                ronda futura. El código de la pantalla/store se deja intacto
                (ver ContactsScreen.tsx, useContactsStore) para retomarla
                más adelante; solo se le quitan los puntos de entrada. */}
          </View>
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

        {challenge && (
          <View style={styles.challengeCard}>
            <Text style={styles.challengeTitle}>
              {challenge.emoji} {challenge.label}
            </Text>
            <Text style={styles.challengeDesc}>{challenge.description}</Text>
            <View style={styles.challengeBarTrack}>
              <View
                style={[
                  styles.challengeBarFill,
                  { width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.challengeProgress}>
              {challenge.progress} / {challenge.target}
            </Text>
          </View>
        )}

        {trend && <TrendCard trend={formatTrend(trend)} />}

        {trendHistory.length > 0 && (
          <View style={styles.section}>
            <Pressable onPress={() => setShowHistory((v) => !v)}>
              <Text style={styles.historyToggle}>
                {showHistory ? '▾' : '▸'} Trends pasados ({trendHistory.length})
              </Text>
            </Pressable>
            {showHistory &&
              trendHistory.map((t) => {
                const formatted = formatTrend(t);
                return (
                  <View key={t.id} style={styles.historyRow}>
                    <Text style={styles.historyEmoji}>{formatted.emoji}</Text>
                    <View style={styles.historyTextWrap}>
                      <Text style={styles.historyTitle}>{formatted.title}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(t.fecha + 'T00:00:00').toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {moodSongs.length > 0 ? (
          <PlaylistCard songs={moodSongs} title="TU PLAYLIST DE HOY" />
        ) : (
          genericSongs.length > 0 && <PlaylistCard songs={genericSongs} />
        )}
        <RecommendedArtistCard artists={recommended} />
        <CollaborativeArtistCard recommendations={recommendedV2} />
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
    gap: spacing.md,
  },
  headerTextWrap: {
    flexShrink: 1,
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
  headerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  matchCard: {
    backgroundColor: colors.accentPrimaryMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  matchEyebrow: {
    ...type.label,
    color: colors.accentPrimary,
    letterSpacing: 1.5,
  },
  matchName: {
    ...type.h2,
    color: colors.textPrimary,
  },
  matchMeta: {
    ...type.body,
    color: colors.textSecondary,
  },
  challengeCard: {
    gap: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  challengeTitle: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  challengeDesc: {
    ...type.body,
    color: colors.textSecondary,
  },
  challengeBarTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  challengeBarFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accentPrimary,
  },
  challengeProgress: {
    ...type.caption,
    color: colors.textMuted,
  },
  historyToggle: {
    ...type.label,
    color: colors.textSecondary,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  historyEmoji: {
    fontSize: 20,
  },
  historyTextWrap: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    ...type.body,
    color: colors.textPrimary,
  },
  historyDate: {
    ...type.caption,
    color: colors.textMuted,
  },
});
