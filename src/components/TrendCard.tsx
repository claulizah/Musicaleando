import React, { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { FormattedTrend } from '../lib/trends';
import { colors, radii, spacing, type } from '../theme';

type Props = {
  trend: FormattedTrend;
};

export function TrendCard({ trend }: Props) {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!cardRef.current) return;
    Haptics.selectionAsync();
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } else {
        Alert.alert('Compartir no disponible', 'Este dispositivo no soporta compartir archivos.');
      }
    } catch {
      Alert.alert('No se pudo generar la imagen', 'Intenta de nuevo en unos segundos.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View ref={cardRef} collapsable={false}>
      <LinearGradient
        colors={[colors.bgElevated, colors.bgElevatedHigh]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TU TREND DE HOY</Text>
          <Pressable hitSlop={10} onPress={handleShare} disabled={sharing}>
            <Text style={styles.shareIcon}>{sharing ? '…' : '↗'}</Text>
          </Pressable>
        </View>
        <Text style={styles.emoji}>{trend.emoji}</Text>
        <Text style={styles.title}>{trend.title}</Text>
        <Text style={styles.body}>{trend.body}</Text>
        <Text style={styles.brand}>Musicaleando</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    ...type.label,
    color: colors.accentSecondary,
    letterSpacing: 1.5,
  },
  shareIcon: {
    ...type.h2,
    color: colors.textSecondary,
  },
  emoji: {
    fontSize: 36,
    marginTop: spacing.xs,
  },
  title: {
    ...type.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  body: {
    ...type.body,
    color: colors.textSecondary,
  },
  brand: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
