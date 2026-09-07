import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Screen } from '../../components/Screen';
import { ArchetypeCard } from '../../components/ArchetypeCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useProfileStore, TorneoCampeon } from '../../store/useProfileStore';
import { useQuizStore } from '../../store/useQuizStore';
import { useSessionStore } from '../../store/useSessionStore';
import { ARCHETYPES, GENEROS, GUILTY_PLEASURES, SocialAxis, buildFlavorLine } from '../../lib/archetypes';
import { ARCHETYPE_IMAGES } from '../../lib/images';
import { parseListeningHistory, topArtists, fetchImportGenres } from '../../lib/musicImport';
import { colors, radii, spacing, type } from '../../theme';

// Older test data (before the tournament switched from genres to real
// artists) stored torneo_campeon as a plain genre id string — treat that
// shape as "no champion" instead of crashing on the new object fields.
function readTorneoCampeon(flavor: Record<string, unknown>): TorneoCampeon | undefined {
  const raw = flavor.torneo_campeon;
  if (raw && typeof raw === 'object' && 'artistName' in raw) {
    return raw as TorneoCampeon;
  }
  return undefined;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const profile = useProfileStore((s) => s.profile);
  const updateGuiltyPleasures = useProfileStore((s) => s.updateGuiltyPleasures);
  const applyImportResult = useProfileStore((s) => s.applyImportResult);
  const prefillFromProfile = useQuizStore((s) => s.prefillFromProfile);
  const goToStep = useQuizStore((s) => s.goToStep);
  const [importing, setImporting] = useState(false);

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
  const flavorData = (profile.flavor as Record<string, unknown>) ?? {};
  const champion = readTorneoCampeon(flavorData);

  const toggleGuilty = (id: string) => {
    if (!userId) return;
    const next = guiltyIds.includes(id) ? guiltyIds.filter((g) => g !== id) : [...guiltyIds, id];
    updateGuiltyPleasures(userId, next);
  };

  const flavor = buildFlavorLine({
    generoIds,
    energia: profile.energia,
    guiltyPleasureId: guiltyIds[0],
    eraId: (flavorData.era as string | null) ?? undefined,
    concertoId: (flavorData.concierto as string | null) ?? undefined,
  });

  const refine = () => {
    prefillFromProfile({
      generoIds,
      energia: profile.energia,
      social,
      eraId: (flavorData.era as string | null) ?? undefined,
      guiltyPleasureId: guiltyIds[0],
      concertoId: (flavorData.concierto as string | null) ?? undefined,
    });
    goToStep(0);
    navigation.navigate('Quiz');
  };

  const handleImport = async () => {
    if (!userId) return;
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (picked.canceled) return;

    setImporting(true);
    try {
      const raw = await new File(picked.assets[0].uri).text();
      const parsed = parseListeningHistory(raw);
      if (!parsed) {
        Alert.alert(
          'No pudimos leer ese archivo',
          'No parece un export reconocible de Spotify o Apple Music. Tu perfil por cuestionario sigue igual.',
        );
        return;
      }

      const result = await fetchImportGenres(topArtists(parsed, 30));
      if (result.generos.length === 0) {
        Alert.alert(
          'No reconocimos suficientes artistas',
          `Leímos ${parsed.recognizedEntries} entradas pero no encontramos géneros en común. Tu perfil por cuestionario sigue igual.`,
        );
        return;
      }

      await applyImportResult(userId, result);
      Alert.alert(
        'Importación lista',
        `Reforzamos tu perfil con ${result.generos.length} género(s) a partir de ${result.matchedArtists.length} artista(s) reconocidos.`,
      );
    } catch (err) {
      Alert.alert(
        'No se pudo importar',
        err instanceof Error ? err.message : 'Intenta de nuevo más tarde. Tu perfil por cuestionario sigue igual.',
      );
    } finally {
      setImporting(false);
    }
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
            <View style={styles.championRow}>
              {champion.artistImageUrl ? (
                <Image source={{ uri: champion.artistImageUrl }} style={styles.championImage} />
              ) : (
                <Text style={styles.championEmoji}>🎤</Text>
              )}
              <Text style={styles.chipText}>{champion.artistName}</Text>
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
        <PrimaryButton
          label={importing ? 'Importando...' : 'Importar de Spotify / Apple Music'}
          variant="secondary"
          onPress={handleImport}
          loading={importing}
        />
        {profile.origen === 'import' && (
          <Text style={styles.hintText}>Tu perfil incluye datos de una importación.</Text>
        )}
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
  championRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  championImage: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
  },
  championEmoji: {
    fontSize: 20,
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
