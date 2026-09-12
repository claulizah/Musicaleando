import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useContactsStore, UserSearchResult } from '../../store/useContactsStore';
import { ARCHETYPES } from '../../lib/archetypes';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

export function ContactsScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const incoming = useContactsStore((s) => s.incoming);
  const outgoing = useContactsStore((s) => s.outgoing);
  const accepted = useContactsStore((s) => s.accepted);
  const feed = useContactsStore((s) => s.feed);
  const bestMatch = useContactsStore((s) => s.bestMatch);
  const status = useContactsStore((s) => s.status);
  const fetchAll = useContactsStore((s) => s.fetchAll);
  const sendRequest = useContactsStore((s) => s.sendRequest);
  const respond = useContactsStore((s) => s.respond);
  const search = useContactsStore((s) => s.search);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (userId) fetchAll(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await search(query.trim()));
    } catch (err) {
      Alert.alert('No se pudo buscar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setSearching(false);
    }
  };

  const handleSend = async (contactId: string) => {
    try {
      await sendRequest(contactId);
      setResults((r) => r.filter((u) => u.user_id !== contactId));
    } catch (err) {
      Alert.alert('No se pudo enviar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await respond(requestId, accept);
    } catch (err) {
      Alert.alert('No se pudo responder', err instanceof Error ? err.message : 'Intenta de nuevo.');
    }
  };

  const nameFor = (row: { user_id: string }) => {
    const fromFeed = feed.find((f) => f.contact_user_id === row.user_id);
    return fromFeed?.nombre ?? 'Sin nombre';
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Tu red de conocidos</Text>
          <View style={styles.headerSpacer} />
        </View>

        {bestMatch && (
          <View style={styles.matchCard}>
            <Text style={styles.matchEyebrow}>COMPAÑERO IDEAL</Text>
            <Text style={styles.matchName}>{bestMatch.nombre ?? 'Sin nombre'}</Text>
            <Text style={styles.matchMeta}>
              {bestMatch.arquetipo ? ARCHETYPES[bestMatch.arquetipo as keyof typeof ARCHETYPES]?.label : 'Perfil incompleto'}
              {' · '}
              {bestMatch.compat_score ?? 0}% compatible
            </Text>
          </View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Buscar por nombre</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nombre de la persona"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            onSubmitEditing={handleSearch}
          />
          <PrimaryButton label="Buscar" variant="secondary" onPress={handleSearch} loading={searching} disabled={!query.trim()} />
          {results.map((u) => (
            <View key={u.user_id} style={styles.resultRow}>
              <Text style={styles.memberLabel}>{u.nombre ?? 'Sin nombre'}</Text>
              <Pressable onPress={() => handleSend(u.user_id)}>
                <Text style={styles.addLink}>Enviar solicitud</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {incoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Solicitudes recibidas</Text>
            {incoming.map((r) => (
              <View key={r.id} style={styles.memberRow}>
                <Text style={styles.memberLabel}>{nameFor({ user_id: r.user_id })}</Text>
                <View style={styles.requestActions}>
                  <Pressable onPress={() => handleRespond(r.id, true)}>
                    <Text style={styles.addLink}>Aceptar</Text>
                  </Pressable>
                  <Pressable onPress={() => handleRespond(r.id, false)}>
                    <Text style={styles.removeLink}>Rechazar</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {outgoing.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Solicitudes enviadas</Text>
            {outgoing.map((r) => (
              <View key={r.id} style={styles.memberRow}>
                <Text style={styles.memberLabel}>{nameFor({ user_id: r.contact_id })}</Text>
                <Text style={styles.memberMeta}>Esperando respuesta</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tus conocidos</Text>
          {status === 'loading' && accepted.length === 0 && (
            <Text style={styles.hint}>Cargando...</Text>
          )}
          {accepted.length === 0 && status === 'ready' && (
            <Text style={styles.hint}>Todavía no tienes conocidos — búscalos arriba.</Text>
          )}
          {accepted.map((r) => {
            const otherId = r.user_id === userId ? r.contact_id : r.user_id;
            const entry = feed.find((f) => f.contact_user_id === otherId);
            const archetype = entry?.arquetipo ? ARCHETYPES[entry.arquetipo as keyof typeof ARCHETYPES] : undefined;
            return (
              <View key={r.id} style={styles.memberRow}>
                <Text style={styles.memberEmoji}>{archetype?.emoji ?? '🎧'}</Text>
                <View style={styles.memberTextWrap}>
                  <Text style={styles.memberLabel}>{entry?.nombre ?? 'Sin nombre'}</Text>
                  <Text style={styles.memberMeta}>
                    {archetype?.label ?? 'Perfil incompleto'}
                    {entry?.ultimo_campeon_nombre ? ` · último campeón: ${entry.ultimo_campeon_nombre}` : ''}
                  </Text>
                </View>
                <Text style={styles.memberContigo}>{r.compat_score ?? 0}%</Text>
              </View>
            );
          })}
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
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
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
    flex: 1,
  },
  memberMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  memberContigo: {
    ...type.label,
    color: colors.accentPrimary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addLink: {
    ...type.label,
    color: colors.accentSecondary,
  },
  removeLink: {
    ...type.label,
    color: colors.textMuted,
  },
});
