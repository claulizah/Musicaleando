import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Screen } from '../../components/Screen';
import { ArchetypeCard } from '../../components/ArchetypeCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { QuizProgressBar } from '../../components/QuizProgressBar';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useRecapStore } from '../../store/useRecapStore';
import { ARCHETYPES } from '../../lib/archetypes';
import { levelForFestivalCount } from '../../lib/levels';
import { isRecapEmpty } from '../../lib/recap';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Recap'>;

const CURRENT_YEAR = new Date().getFullYear();

export function RecapScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const recap = useRecapStore((s) => s.recap);
  const fotosResolved = useRecapStore((s) => s.fotosResolved);
  const status = useRecapStore((s) => s.status);
  const fetchRecap = useRecapStore((s) => s.fetch);

  const [slideIndex, setSlideIndex] = useState(0);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (userId) fetchRecap(CURRENT_YEAR);
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

  if (status === 'loading' || !recap) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.hint}>Armando tu {CURRENT_YEAR}...</Text>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.center}>
        <Text style={styles.hint}>No pudimos armar tu recap. Intenta de nuevo.</Text>
        <PrimaryButton label="Reintentar" onPress={() => fetchRecap(CURRENT_YEAR)} />
        <PrimaryButton label="Volver" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const archetype = recap.arquetipo ? ARCHETYPES[recap.arquetipo as keyof typeof ARCHETYPES] : undefined;
  const nivel = levelForFestivalCount(recap.festivales_count);
  const empty = isRecapEmpty(recap);

  // Caso límite (poco historial este año): un recap corto y amable en vez de
  // un carrusel de slides mayormente vacíos.
  if (empty) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.title}>Tu {CURRENT_YEAR} apenas empieza</Text>
        <Text style={styles.hint}>
          Todavía no tienes festivales confirmados, campeón del Torneo Sonoro, ni fotos este
          año — pero {archetype ? `sigues siendo ${archetype.label} ${archetype.emoji}` : 'tu perfil ya está listo'}.
          Marca &quot;Voy&quot; en un festival, juega el Torneo Sonoro, o sube una foto para
          que tu próximo recap tenga mucho más que contar.
        </Text>
        <PrimaryButton label="Listo" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const slides = [
    // 0: Intro
    () => (
      <View style={styles.slide}>
        <Text style={styles.eyebrow}>TU AÑO EN MUSICALEANDO</Text>
        <Text style={styles.bigTitle}>{CURRENT_YEAR}</Text>
        {archetype && (
          <Text style={styles.hint}>
            {archetype.emoji} Sigues siendo {archetype.label}
          </Text>
        )}
      </View>
    ),
    // 1: Festivales
    () => (
      <View style={styles.slide}>
        <Text style={styles.eyebrow}>FESTIVALES</Text>
        <Text style={styles.bigNumber}>{recap.festivales_count}</Text>
        <Text style={styles.hint}>
          {recap.festivales_count === 1 ? 'festival confirmado' : 'festivales confirmados'} en{' '}
          {CURRENT_YEAR}
        </Text>
        {recap.festivales.map((f) => (
          <Text key={f.nombre + f.fecha_inicio} style={styles.listRow}>
            🎪 {f.nombre} · {f.ciudad}
          </Text>
        ))}
      </View>
    ),
    // 2: Campeón del año
    () => (
      <View style={styles.slide}>
        <Text style={styles.eyebrow}>ARTISTA DEL AÑO</Text>
        {recap.campeon ? (
          <>
            {recap.campeon.artist_imagen_url ? (
              <Image source={{ uri: recap.campeon.artist_imagen_url }} style={styles.campeonImage} />
            ) : (
              <Text style={styles.campeonEmoji}>🎤</Text>
            )}
            <Text style={styles.bigTitle}>{recap.campeon.artist_nombre}</Text>
            <Text style={styles.hint}>
              Campeón del Torneo Sonoro {recap.campeon.veces > 1 ? `${recap.campeon.veces} veces` : ''} este año
            </Text>
          </>
        ) : (
          <Text style={styles.hint}>Todavía no coronaste un campeón del Torneo Sonoro este año.</Text>
        )}
      </View>
    ),
    // 3: Fotos
    () => (
      <View style={styles.slide}>
        <Text style={styles.eyebrow}>MOMENTOS DEL AÑO</Text>
        {fotosResolved.length === 0 ? (
          <Text style={styles.hint}>Sube fotos a tu álbum de conciertos para que aparezcan aquí.</Text>
        ) : (
          <View style={styles.photoGrid}>
            {fotosResolved.map((f) =>
              f.signedUrl ? (
                <Image key={f.foto_path} source={{ uri: f.signedUrl }} style={styles.photo} />
              ) : null,
            )}
          </View>
        )}
      </View>
    ),
    // 4: Nivel
    () => (
      <View style={styles.slide}>
        <Text style={styles.eyebrow}>TU NIVEL</Text>
        <Text style={styles.campeonEmoji}>{nivel.emoji}</Text>
        <Text style={styles.bigTitle}>{nivel.label}</Text>
        <Text style={styles.hint}>{nivel.description}</Text>
      </View>
    ),
    // 5: Cierre / compartible
    () => (
      <View style={styles.slide}>
        <View style={styles.cardWrap}>
          <ArchetypeCard
            ref={cardRef}
            archetype={{
              id: `recap-${recap.anio}`,
              label: `Mi ${recap.anio}`,
              emoji: nivel.emoji,
              description: `${nivel.label} · ${recap.festivales_count} festival(es)${
                recap.campeon ? ` · Artista del año: ${recap.campeon.artist_nombre}` : ''
              }`,
              gradient: nivel.gradient,
            }}
          />
        </View>
        <PrimaryButton label="Compartir mi recap" variant="secondary" onPress={handleShare} loading={sharing} />
        <PrimaryButton label="Listo" onPress={() => navigation.goBack()} />
      </View>
    ),
  ];

  const isLast = slideIndex === slides.length - 1;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.progressWrap}>
          <QuizProgressBar count={slides.length} activeIndex={slideIndex} />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {slides[slideIndex]()}

      {!isLast && (
        <View style={styles.navRow}>
          {slideIndex > 0 && (
            <View style={styles.navButton}>
              <PrimaryButton label="‹ Anterior" variant="ghost" onPress={() => setSlideIndex((i) => i - 1)} />
            </View>
          )}
          <View style={styles.navButton}>
            <PrimaryButton label="Siguiente ›" onPress={() => setSlideIndex((i) => i + 1)} />
          </View>
        </View>
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
    paddingHorizontal: spacing.lg,
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  title: {
    ...type.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  back: {
    ...type.h1,
    color: colors.textPrimary,
    width: 24,
  },
  progressWrap: {
    flex: 1,
  },
  headerSpacer: {
    width: 24,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  eyebrow: {
    ...type.label,
    color: colors.accentSecondary,
    letterSpacing: 2,
  },
  bigTitle: {
    ...type.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  bigNumber: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  listRow: {
    ...type.body,
    color: colors.textSecondary,
  },
  campeonImage: {
    width: 120,
    height: 120,
    borderRadius: radii.lg,
  },
  campeonEmoji: {
    fontSize: 56,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: radii.md,
  },
  cardWrap: {
    width: '100%',
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  navButton: {
    flex: 1,
  },
});
