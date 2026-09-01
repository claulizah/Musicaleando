import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';
import { MotiView } from 'moti';
import ConfettiCannon from 'react-native-confetti-cannon';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ArchetypeCard } from '../../components/ArchetypeCard';
import { RootStackParamList } from '../../navigation/types';
import { useQuizStore } from '../../store/useQuizStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useSessionStore } from '../../store/useSessionStore';
import { ARCHETYPES, ArchetypeId, buildFlavorLine } from '../../lib/archetypes';
import { ARCHETYPE_IMAGES } from '../../lib/images';
import { colors, spacing, type } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'Reveal'>;

const { width } = Dimensions.get('window');

export function RevealScreen({ navigation }: Props) {
  const reducedMotion = useReducedMotion();
  const userId = useSessionStore((s) => s.userId);
  const answers = useQuizStore((s) => s.answers);
  const resetDraft = useQuizStore((s) => s.resetDraft);
  const saveFromQuiz = useProfileStore((s) => s.saveFromQuiz);

  const [phase, setPhase] = useState<'calculating' | 'revealed' | 'error'>('calculating');
  const [archetypeId, setArchetypeId] = useState<ArchetypeId | null>(null);
  const [flavor, setFlavor] = useState('');
  const [sharing, setSharing] = useState(false);
  const confettiRef = useRef<ConfettiCannon>(null);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise((resolve) => setTimeout(resolve, reducedMotion ? 300 : 1400));

    (async () => {
      if (!userId) return;
      try {
        const [id] = await Promise.all([saveFromQuiz(userId, answers), minDelay]);
        if (cancelled) return;
        setArchetypeId(id);
        setFlavor(buildFlavorLine(answers));
        setPhase('revealed');
        resetDraft();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!reducedMotion) {
          setTimeout(() => confettiRef.current?.start(), 150);
        }
      } catch (err) {
        if (!cancelled) setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleShare = async () => {
    if (!cardRef.current) return;
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

  if (phase === 'error') {
    return (
      <Screen style={styles.center}>
        <Text style={styles.errorText}>No pudimos calcular tu arquetipo. Intenta de nuevo.</Text>
        <PrimaryButton label="Reintentar" onPress={() => navigation.replace('Quiz')} />
      </Screen>
    );
  }

  if (phase === 'calculating' || !archetypeId) {
    return (
      <Screen style={styles.center}>
        <LottieView
          source={require('../../../assets/lottie/pulse.json')}
          autoPlay
          loop
          style={styles.lottie}
        />
        <Text style={styles.calculatingText}>Calculando tu vibra...</Text>
      </Screen>
    );
  }

  const archetype = ARCHETYPES[archetypeId];

  return (
    <Screen style={styles.center}>
      <MotiView
        from={reducedMotion ? undefined : { opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 12, mass: 0.9 }}
        style={styles.cardWrap}
      >
        <ArchetypeCard
          ref={cardRef}
          archetype={archetype}
          flavor={flavor}
          image={ARCHETYPE_IMAGES[archetypeId]}
        />
      </MotiView>

      <View style={styles.actions}>
        <PrimaryButton label="Compartir" variant="secondary" onPress={handleShare} loading={sharing} />
        <PrimaryButton label="Continuar" onPress={() => navigation.replace('MoodPick')} />
      </View>

      {!reducedMotion && (
        <ConfettiCannon
          ref={confettiRef}
          count={90}
          origin={{ x: width / 2, y: -20 }}
          autoStart={false}
          fadeOut
          colors={[colors.accentPrimary, colors.accentSecondary, '#F5F3FA']}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  lottie: {
    width: 180,
    height: 180,
  },
  calculatingText: {
    ...type.bodyLg,
    color: colors.textSecondary,
  },
  cardWrap: {
    width: '100%',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  errorText: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
