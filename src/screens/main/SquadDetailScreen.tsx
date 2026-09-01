import React, { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useSquadStore } from '../../store/useSquadStore';
import { ARCHETYPES } from '../../lib/archetypes';
import { compatScore } from '../../lib/compat';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SquadDetail'>;

export function SquadDetailScreen({ route, navigation }: Props) {
  const { squadId } = route.params;
  const userId = useSessionStore((s) => s.userId);
  const profile = useProfileStore((s) => s.profile);
  const squads = useSquadStore((s) => s.squads);
  const fetchMySquads = useSquadStore((s) => s.fetchMySquads);
  const leaveSquad = useSquadStore((s) => s.leaveSquad);

  const entry = squads.find((s) => s.squad.id === squadId);

  useEffect(() => {
    if (!entry && userId) fetchMySquads(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, entry]);

  if (!entry) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.hint}>Cargando squad...</Text>
      </Screen>
    );
  }

  const { squad, members } = entry;
  const squadAverage =
    members.length === 0 ? 100 : Math.round(members.reduce((sum, m) => sum + m.compat_score, 0) / members.length);

  const handleShareCode = async () => {
    Haptics.selectionAsync();
    const available = await Sharing.isAvailableAsync();
    const message = `Únete a mi squad "${squad.nombre}" en Musicaleando. Código: ${squad.invite_code}`;
    if (available) {
      // expo-sharing shares files; for plain text we fall back to the Alert
      // so the user can copy it manually — no extra dependency needed for MVP.
      Alert.alert('Código de invitación', message);
    } else {
      Alert.alert('Código de invitación', message);
    }
  };

  const handleLeave = () => {
    Alert.alert('Salir del squad', `¿Seguro que quieres salir de "${squad.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          try {
            await leaveSquad(squadId, userId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('No se pudo salir', err instanceof Error ? err.message : 'Intenta de nuevo.');
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{squad.nombre}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryScore}>{squadAverage}%</Text>
          <Text style={styles.summaryLabel}>Compatibilidad promedio del squad</Text>
        </View>

        <Pressable style={styles.codeCard} onPress={handleShareCode}>
          <View>
            <Text style={styles.codeLabel}>Código de invitación</Text>
            <Text style={styles.codeValue}>{squad.invite_code}</Text>
          </View>
          <Text style={styles.codeShare}>Compartir ↗</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Miembros</Text>
          {members.map((member) => {
            const archetype = member.arquetipo ? ARCHETYPES[member.arquetipo as keyof typeof ARCHETYPES] : undefined;
            const isMe = member.user_id === userId;
            const contigo =
              !isMe && profile
                ? compatScore({ generos: profile.generos as string[], energia: profile.energia }, member)
                : null;

            return (
              <View key={member.user_id} style={styles.memberRow}>
                <Text style={styles.memberEmoji}>{archetype?.emoji ?? '🎧'}</Text>
                <View style={styles.memberTextWrap}>
                  <Text style={styles.memberLabel}>
                    {archetype?.label ?? 'Perfil incompleto'} {isMe ? '(tú)' : ''}
                  </Text>
                  <Text style={styles.memberMeta}>Compat. con el squad: {Math.round(member.compat_score)}%</Text>
                </View>
                {contigo !== null && <Text style={styles.memberContigo}>{contigo}% contigo</Text>}
              </View>
            );
          })}
        </View>

        <PrimaryButton label="Salir del squad" variant="secondary" onPress={handleLeave} />
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
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.accentPrimaryMuted,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  summaryScore: {
    ...type.display,
    color: colors.accentPrimary,
  },
  summaryLabel: {
    ...type.body,
    color: colors.textSecondary,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  codeLabel: {
    ...type.caption,
    color: colors.textSecondary,
  },
  codeValue: {
    ...type.h1,
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  codeShare: {
    ...type.label,
    color: colors.accentSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  memberEmoji: {
    fontSize: 28,
  },
  memberTextWrap: {
    flex: 1,
    gap: 2,
  },
  memberLabel: {
    ...type.body,
    color: colors.textPrimary,
  },
  memberMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  memberContigo: {
    ...type.label,
    color: colors.accentPrimary,
  },
});
