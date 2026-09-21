import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSessionStore } from '../store/useSessionStore';
import { useWhatsNewStore } from '../store/useWhatsNewStore';
import { pickPendingNews } from '../lib/whatsNew';
import { colors, radii, spacing, type } from '../theme';

// Aviso de "Nuevo" reutilizable: se pone una vez arriba de cualquier
// pantalla con su nombre de ruta (<WhatsNewCard screen="Squads" />). Qué
// mostrar y hasta cuándo se maneja desde el admin (tabla novedades), no en
// código — lanzar una función nueva no requiere tocar la app.
export function WhatsNewCard({ screen }: { screen: string }) {
  const userId = useSessionStore((s) => s.userId);
  const novedades = useWhatsNewStore((s) => s.novedades);
  const seenIds = useWhatsNewStore((s) => s.seenIds);
  const load = useWhatsNewStore((s) => s.load);
  const dismiss = useWhatsNewStore((s) => s.dismiss);

  useEffect(() => {
    if (userId) load(userId);
  }, [userId, load]);

  if (!userId) return null;
  const news = pickPendingNews(novedades, seenIds, screen);
  if (!news) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.badge}>NUEVO</Text>
        <Text style={styles.title}>{news.titulo}</Text>
      </View>
      <Text style={styles.body}>{news.cuerpo}</Text>
      <Pressable
        style={styles.button}
        onPress={() => {
          Haptics.selectionAsync();
          dismiss(userId, news.id);
        }}
      >
        <Text style={styles.buttonText}>Entendido</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentPrimaryMuted,
    borderColor: colors.accentPrimary,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    ...type.caption,
    color: colors.onAccent,
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  title: {
    ...type.label,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
  },
  button: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonText: {
    ...type.label,
    color: colors.accentPrimary,
  },
});
