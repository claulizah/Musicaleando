import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useProfileStore } from '../../store/useProfileStore';
import { ESTADOS_MEXICO } from '../../lib/estadosMexico';
import { saveUserEstado } from '../../lib/userEstado';
import { trackOnboardingStep } from '../../lib/trackOnboarding';
import { PASO_COMPLETO, PASO_UBICACION } from '../../lib/onboardingTracking';
import { Dropdown } from '../../components/EventFilterBar';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EstadosInteres'>;

// Último paso de onboarding, claramente saltable — a diferencia del quiz de
// personalidad (Steps 1-10), esto no alimenta el arquetipo ni bloquea nada;
// es solo una preferencia geográfica que queda guardada para targeting
// futuro (ver useProfileStore.updateEstadosInteres). Por eso vive como
// pantalla propia después de MoodPick, no como un Step más del quiz.
export function EstadosInteresScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const updateEstadosInteres = useProfileStore((s) => s.updateEstadosInteres);
  const [selected, setSelected] = useState<string[]>([]);
  const [estadoResidencia, setEstadoResidencia] = useState('');

  useEffect(() => {
    trackOnboardingStep(userId, PASO_UBICACION);
  }, [userId]);
  const [saving, setSaving] = useState(false);

  const toggle = (estado: string) => {
    setSelected((prev) => (prev.includes(estado) ? prev.filter((e) => e !== estado) : [...prev, estado]));
  };

  const finish = async (estados: string[]) => {
    if (!userId) {
      navigation.replace('Home');
      return;
    }
    // Guardar o "Saltar" cuentan igual: el usuario terminó el onboarding.
    trackOnboardingStep(userId, PASO_COMPLETO);
    setSaving(true);
    try {
      if (estadoResidencia) await saveUserEstado(userId, estadoResidencia);
      await updateEstadosInteres(userId, estados);
    } catch {
      // No bloquear el onboarding por esto — es opcional, se puede volver a
      // intentar después desde el perfil si hace falta.
    } finally {
      setSaving(false);
      navigation.replace('Home');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>¿Dónde estás?</Text>
          <Pressable hitSlop={12} onPress={() => finish([])} disabled={saving}>
            <Text style={styles.skip}>Saltar</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Opcional. Nos ayuda a mostrarte lo que pasa cerca de ti.</Text>

        <Dropdown
          label="Estado donde vives"
          options={[{ id: '', label: 'Sin elegir' }, ...ESTADOS_MEXICO.map((e) => ({ id: e, label: e }))]}
          value={estadoResidencia}
          onChange={setEstadoResidencia}
        />

        <Text style={styles.sectionTitle}>¿Qué otros estados te interesa seguir?</Text>
        <Text style={styles.subtitle}>
          Te avisaremos de festivales y conciertos en estos estados aunque no vivas ahí.
        </Text>

        <View style={styles.chipWrap}>
          {ESTADOS_MEXICO.map((estado) => {
            const isSelected = selected.includes(estado);
            return (
              <Pressable
                key={estado}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggle(estado)}
              >
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>{estado}</Text>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton
          label={selected.length > 0 || estadoResidencia ? 'Guardar' : 'Continuar'}
          onPress={() => finish(selected)}
          loading={saving}
        />
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
  title: {
    ...type.h1,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  skip: {
    ...type.label,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...type.h2,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimaryMuted,
  },
  chipLabel: {
    ...type.body,
    color: colors.textPrimary,
  },
  chipLabelSelected: {
    color: colors.accentPrimary,
  },
});
