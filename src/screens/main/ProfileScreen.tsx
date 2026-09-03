import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { ArchetypeCard } from '../../components/ArchetypeCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../store/useProfileStore';
import { useQuizStore } from '../../store/useQuizStore';
import { useSessionStore } from '../../store/useSessionStore';
import { ARCHETYPES, GENEROS, GUILTY_PLEASURES, SocialAxis, buildFlavorLine } from '../../lib/archetypes';
import { ARCHETYPE_IMAGES, GENEROS_IMAGES } from '../../lib/images';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const profile = useProfileStore((s) => s.profile);
  const updateGuiltyPleasures = useProfileStore((s) => s.updateGuiltyPleasures);
  const prefillFromProfile = useQuizStore((s) => s.prefillFromProfile);
  const goToStep = useQuizStore((s) => s.goToStep);

  // profile.arquetipo can be an id from a retired archetype set (e.g. a profile
  // saved before an archetype-engine change) — guard the lookup, not just presence.
  const archetype = profile?.arquetipo
    ? ARCHETYPES[profile.arquetipo as keyof typeof ARCHETYPES]
    : undefined;

  if (!profile || !archetype) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.hint}>Todavía no tienes un perfil musical.</Text>
        <PrimaryButton label="Hacer el cuestionario" onPress={() => navigation.navigate('Quiz')} />
      </Screen>
    );
  }

  const generoIds = (profile.generos as string[]) ?? [];
  const guiltyIds = (profile.guilty_pleasures as string[]) ?? [];
  const social = profile.social as SocialAxis;
  const flavorData = (profile.flavor as Record<string, string | null>) ?? {};
  const championId = flavorData.torneo_campeon ?? undefined;
  const champion = championId ? GENEROS.find((g) => g.id === championId) : undefined;

  const toggleGuilty = (id: string) => {
    if (!userId) return;
    const next = guiltyIds.includes(id) ? guiltyIds.filter((g) => g !== id) : [...guiltyIds, id];
    updateGuiltyPleasures(userId, next);
  };

  const flavor = buildFlavorLine({
    generoIds,
    energia: profile.energia,
    guiltyPleasureId: guiltyIds[0],
    eraId: flavorData.era ?? undefined,
    concertoId: flavorData.concierto ?? undefined,
  });

  const refine = () => {
    prefillFromProfile({
      generoIds,
      energia: profile.energia,
      social,
      eraId: flavorData.era ?? undefined,
      guiltyPleasureId: guiltyIds[0],
      concertoId: flavorData.concierto ?? undefined,
    });
    goToStep(0);
    navigation.navigate('Quiz');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Tu perfil musical</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ArchetypeCard
          archetype={archetype}
          flavor={flavor}
          image={ARCHETYPE_IMAGES[archetype.id]}
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Géneros</Text>
          <View style={styles.chipRow}>
            {generoIds.map((id) => {
              const genero = GENEROS.find((g) => g.id === id);
              if (!genero) return null;
              return (
                <View key={id} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {genero.emoji} {genero.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {champion && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Campeón del Torneo Sonoro</Text>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {champion.emoji} {champion.label}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Guilty pleasures</Text>
          <Text style={styles.hintText}>Marca los que se te apliquen — puedes elegir varios.</Text>
          <View style={styles.chipRow}>
            {GUILTY_PLEASURES.map((option) => {
              const selected = guiltyIds.includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  onPress={() => toggleGuilty(option.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <PrimaryButton label="Jugar Torneo Sonoro" variant="secondary" onPress={() => navigation.navigate('Torneo')} />
        <PrimaryButton label="Retomar y refinar cuestionario" variant="secondary" onPress={refine} />
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
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
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
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    ...type.body,
    color: colors.textPrimary,
  },
  chipSelected: {
    borderColor: colors.accentSecondary,
    backgroundColor: colors.accentSecondaryMuted,
  },
  chipTextSelected: {
    color: colors.textPrimary,
  },
  hintText: {
    ...type.body,
    color: colors.textMuted,
  },
  bodyText: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
});
