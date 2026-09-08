import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useFestivalStore } from '../../store/useFestivalStore';
import { useConcertAlbumStore } from '../../store/useConcertAlbumStore';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ConcertAlbum'>;

export function ConcertAlbumScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const festivals = useFestivalStore((s) => s.festivals);
  const fetchFestivals = useFestivalStore((s) => s.fetch);
  const entries = useConcertAlbumStore((s) => s.entries);
  const status = useConcertAlbumStore((s) => s.status);
  const fetchAlbum = useConcertAlbumStore((s) => s.fetch);
  const addPhoto = useConcertAlbumStore((s) => s.addPhoto);
  const deletePhoto = useConcertAlbumStore((s) => s.deletePhoto);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchAlbum(userId);
    fetchFestivals(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Solo festivales donde ya marcaste "Voy" — el álbum es evidencia de
  // asistencia real, no de cualquier festival cargado en la app (la RLS de
  // concert_album ya lo exige del lado del servidor; esto solo evita que el
  // usuario intente con un festival que la base va a rechazar de todos modos).
  const attendedFestivals = festivals.filter((f) => f.myStatus === 'voy');

  const handlePickFestival = async (festivalId: string, festivalNombre: string) => {
    setPickerOpen(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !userId) return;

    const asset = result.assets[0];

    Alert.alert(
      '¿Usar esta foto como evidencia para patrocinadores?',
      'Si aceptas, esta foto puede contar (de forma agregada, nunca individual) como evidencia de asistencia real en reportes futuros para marcas y festivales. Puedes subir la foto de cualquier forma.',
      [
        {
          text: 'No usar',
          onPress: () => uploadPhoto(festivalId, festivalNombre, asset, false),
        },
        {
          text: 'Sí, autorizo',
          onPress: () => uploadPhoto(festivalId, festivalNombre, asset, true),
        },
      ],
    );
  };

  const uploadPhoto = async (
    festivalId: string,
    festivalNombre: string,
    asset: ImagePicker.ImagePickerAsset,
    consent: boolean,
  ) => {
    if (!userId) return;
    setUploading(true);
    try {
      await addPhoto(userId, festivalId, festivalNombre, asset.uri, asset.mimeType, asset.fileSize, consent);
    } catch (err) {
      Alert.alert('No se pudo subir la foto', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (entryId: string, fotoPath: string) => {
    Alert.alert('Quitar foto', '¿Quitar esta foto de tu álbum?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => deletePhoto(entryId, fotoPath),
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
          <Text style={styles.headerTitle}>Mi álbum de conciertos</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.hint}>
          Solo tú y tu squad pueden ver estas fotos — nunca son públicas para el resto de la
          app.
        </Text>

        {attendedFestivals.length === 0 ? (
          <Text style={styles.hint}>
            Marca &quot;Voy&quot; en un festival del Hub para poder agregar fotos de esa noche.
          </Text>
        ) : (
          <PrimaryButton
            label={uploading ? 'Subiendo...' : '+ Agregar foto'}
            onPress={() => setPickerOpen((v) => !v)}
            loading={uploading}
          />
        )}

        {pickerOpen && (
          <View style={styles.pickerCard}>
            <Text style={styles.formLabel}>¿De qué festival es la foto?</Text>
            {attendedFestivals.map((f) => (
              <Pressable
                key={f.festival.id}
                style={styles.festivalRow}
                onPress={() => handlePickFestival(f.festival.id, f.festival.nombre)}
              >
                <Text style={styles.festivalRowText}>{f.festival.nombre}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {status === 'loading' && entries.length === 0 && <Text style={styles.hint}>Cargando álbum...</Text>}
        {status === 'ready' && entries.length === 0 && (
          <Text style={styles.hint}>Todavía no has agregado ninguna foto.</Text>
        )}

        <View style={styles.grid}>
          {entries.map((entry) => (
            <Pressable
              key={entry.id}
              style={styles.photoCard}
              onLongPress={() => handleDelete(entry.id, entry.foto_path)}
            >
              {entry.signedUrl ? (
                <Image source={{ uri: entry.signedUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Text style={styles.hint}>Sin vista previa</Text>
                </View>
              )}
              <Text style={styles.photoCaption} numberOfLines={1}>
                {entry.festivalNombre}
              </Text>
              {entry.consentimiento_patrocinadores && (
                <Text style={styles.consentBadge}>✓ Autorizada para reportes</Text>
              )}
            </Pressable>
          ))}
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
  pickerCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  formLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  festivalRow: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  festivalRowText: {
    ...type.body,
    color: colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoCard: {
    width: '47%',
    gap: 4,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.bgElevated,
  },
  photoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCaption: {
    ...type.caption,
    color: colors.textSecondary,
  },
  consentBadge: {
    ...type.caption,
    color: colors.accentPrimary,
  },
});
