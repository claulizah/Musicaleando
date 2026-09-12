import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useSquadStore } from '../../store/useSquadStore';
import { supabase } from '../../lib/supabase';
import { Tables } from '../../types/database';
import { colors, radii, spacing, type } from '../../theme';

type FestivalOption = Pick<Tables<'festivals'>, 'id' | 'nombre'>;

type Props = NativeStackScreenProps<RootStackParamList, 'Squads'>;

function squadAverage(members: { compat_score: number }[]): number {
  if (members.length === 0) return 100;
  return Math.round(members.reduce((sum, m) => sum + m.compat_score, 0) / members.length);
}

export function SquadsScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const squads = useSquadStore((s) => s.squads);
  const status = useSquadStore((s) => s.status);
  const fetchMySquads = useSquadStore((s) => s.fetchMySquads);
  const createSquad = useSquadStore((s) => s.createSquad);
  const joinSquad = useSquadStore((s) => s.joinSquad);
  const setSquadFestival = useSquadStore((s) => s.setSquadFestival);

  const [nombre, setNombre] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [festivals, setFestivals] = useState<FestivalOption[]>([]);
  const [festivalId, setFestivalId] = useState<string | null>(null);
  const [pendingPickerFor, setPendingPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (userId) fetchMySquads(userId);
    supabase
      .from('festivals')
      .select('id, nombre')
      .order('fecha_inicio')
      .then(({ data }) => setFestivals(data ?? []));
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
          <View style={styles.genreWrap}>
            {festivals.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.genreChip, festivalId === f.id && styles.genreChipSelected]}
                onPress={() => setFestivalId(f.id)}
              >
                <Text style={styles.genreChipLabel}>{f.nombre}</Text>
              </Pressable>
            ))}
            {festivals.length === 0 && <Text style={styles.hint}>No hay festivales cargados todavía.</Text>}
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
    ...type.bodyLg,
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
