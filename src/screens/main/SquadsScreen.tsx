import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { EventFilterBar } from '../../components/EventFilterBar';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useSquadStore } from '../../store/useSquadStore';
import { useFestivalStore } from '../../store/useFestivalStore';
import { useEventFilters } from '../../hooks/useEventFilters';
import { Tables } from '../../types/database';
import { colors, radii, spacing, type } from '../../theme';
import { WhatsNewCard } from '../../components/WhatsNewCard';

type FestivalOption = Pick<Tables<'festivals'>, 'id' | 'nombre'>;

type Props = NativeStackScreenProps<RootStackParamList, 'Squads'>;

function squadAverage(members: { compat_score: number }[]): number {
  if (members.length === 0) return 100;
  return Math.round(members.reduce((sum, m) => sum + m.compat_score, 0) / members.length);
}

export function SquadsScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const generos = useProfileStore((s) => (s.profile?.generos as string[] | undefined) ?? []);
  const squads = useSquadStore((s) => s.squads);
  const status = useSquadStore((s) => s.status);
  const fetchMySquads = useSquadStore((s) => s.fetchMySquads);
  const createSquad = useSquadStore((s) => s.createSquad);
  const joinSquad = useSquadStore((s) => s.joinSquad);
  const setSquadFestival = useSquadStore((s) => s.setSquadFestival);
  // useFestivalStore ya carga todos los festivales + su line-up completo
  // (lo usa FestivalHubScreen) — se reusa aquí en vez de un select propio de
  // solo id/nombre, porque el selector de "Festival" al crear un squad
  // sufre exactamente el mismo problema de lista plana sin buscador, y
  // reusar el mismo filtro (useEventFilters/EventFilterBar) requiere el
  // mismo shape de datos que el catálogo principal.
  const richFestivals = useFestivalStore((s) => s.festivals);
  const fetchFestivals = useFestivalStore((s) => s.fetch);
  const filters = useEventFilters(richFestivals, generos);

  const [nombre, setNombre] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [festivalId, setFestivalId] = useState<string | null>(null);
  const [pendingPickerFor, setPendingPickerFor] = useState<string | null>(null);

  // Lista plana simple id/nombre, derivada de lo mismo — solo para el picker
  // chico de "reasignar festival" de un squad ya existente (caso raro, no
  // necesita buscador propio).
  const festivals: FestivalOption[] = richFestivals.map((e) => ({ id: e.festival.id, nombre: e.festival.nombre }));

  useEffect(() => {
    if (userId) {
      fetchMySquads(userId);
      fetchFestivals(userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleCreate = async () => {
    if (!nombre.trim() || !festivalId) return;
    setCreating(true);
    try {
      await createSquad(nombre.trim(), festivalId);
      setNombre('');
      setFestivalId(null);
      if (userId) await fetchMySquads(userId);
    } catch (err) {
      Alert.alert('No se pudo crear el squad', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const handlePickFestival = async (squadId: string, chosenId: string) => {
    try {
      await setSquadFestival(squadId, chosenId);
      setPendingPickerFor(null);
    } catch (err) {
      Alert.alert('No se pudo asignar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setJoining(true);
    try {
      await joinSquad(code.trim());
      setCode('');
      if (userId) await fetchMySquads(userId);
    } catch (err) {
      Alert.alert('No se pudo unir', err instanceof Error ? err.message : 'Código inválido.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Tus squads</Text>
          <View style={styles.headerSpacer} />
        </View>
        <WhatsNewCard screen="Squads" />

        {status === 'loading' && squads.length === 0 && (
          <Text style={styles.hint}>Cargando tus squads...</Text>
        )}

        {squads.map(({ squad, members }) => {
          const needsFestival = !squad.festival_id && squad.owner_id === userId;
          return (
            <View key={squad.id}>
              <Pressable
                style={styles.squadCard}
                onPress={() => navigation.navigate('SquadDetail', { squadId: squad.id })}
              >
                <View style={styles.squadTextWrap}>
                  <Text style={styles.squadName}>{squad.nombre}</Text>
                  <Text style={styles.squadMeta}>
                    {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
                  </Text>
                </View>
                <Text style={styles.squadScore}>{squadAverage(members)}%</Text>
              </Pressable>

              {needsFestival && (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>
                    Este squad todavía no tiene festival asociado — elige uno para que siga
                    funcionando como squad por festival.
                  </Text>
                  {pendingPickerFor === squad.id ? (
                    <View style={styles.genreWrap}>
                      {festivals.map((f) => (
                        <Pressable
                          key={f.id}
                          style={styles.genreChip}
                          onPress={() => handlePickFestival(squad.id, f.id)}
                        >
                          <Text style={styles.genreChipLabel}>{f.nombre}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Pressable onPress={() => setPendingPickerFor(squad.id)}>
                      <Text style={styles.addLink}>Elegir festival</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Crear un squad</Text>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del squad"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.formLabel}>Festival</Text>
          <EventFilterBar
            query={filters.query}
            onQueryChange={filters.setQuery}
            ciudad={filters.ciudad}
            onCiudadChange={filters.setCiudad}
            ciudades={filters.ciudades}
            dateFilter={filters.dateFilter}
            onDateFilterChange={filters.setDateFilter}
            tipoFilter={filters.tipoFilter}
            onTipoFilterChange={filters.setTipoFilter}
            soloMisGeneros={filters.soloMisGeneros}
            onToggleSoloMisGeneros={filters.toggleSoloMisGeneros}
            generoLoading={filters.generoLoading}
            showGeneroFilter={generos.length > 0}
          />
          <View style={styles.genreWrap}>
            {filters.filtered.map((e) => (
              <Pressable
                key={e.festival.id}
                style={[styles.genreChip, festivalId === e.festival.id && styles.genreChipSelected]}
                onPress={() => setFestivalId(e.festival.id)}
              >
                <Text style={styles.genreChipLabel}>{e.festival.nombre}</Text>
              </Pressable>
            ))}
            {richFestivals.length === 0 && <Text style={styles.hint}>No hay festivales cargados todavía.</Text>}
            {richFestivals.length > 0 && filters.filtered.length === 0 && (
              <Text style={styles.hint}>Nada coincide con esa búsqueda.</Text>
            )}
          </View>
          <PrimaryButton
            label="Crear"
            onPress={handleCreate}
            loading={creating}
            disabled={!nombre.trim() || !festivalId}
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Unirme con un código</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Código de 6 caracteres"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={6}
            style={styles.input}
          />
          <PrimaryButton
            label="Unirme"
            variant="secondary"
            onPress={handleJoin}
            loading={joining}
            disabled={!code.trim()}
          />
        </View>
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
  squadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  squadTextWrap: {
    gap: 2,
  },
  squadName: {
    ...type.body,
    fontFamily: type.bodyLg.fontFamily,
    color: colors.textPrimary,
  },
  squadMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  squadScore: {
    ...type.h2,
    color: colors.accentPrimary,
  },
  banner: {
    marginTop: -spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bannerText: {
    ...type.caption,
    color: colors.textSecondary,
  },
  addLink: {
    ...type.label,
    color: colors.accentSecondary,
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
  genreChipSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimaryMuted,
  },
  genreChipLabel: {
    ...type.body,
    color: colors.textPrimary,
  },
  formCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  input: {
    ...type.bodyLg,
    color: colors.textPrimary,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
