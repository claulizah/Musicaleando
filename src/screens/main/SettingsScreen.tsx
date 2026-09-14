import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useAccountStore } from '../../store/useAccountStore';
import { colors, radii, spacing, type } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const DELETE_CONFIRM_WORD = 'ELIMINAR';

export function SettingsScreen({ navigation }: Props) {
  const userId = useSessionStore((s) => s.userId);
  const signOut = useAccountStore((s) => s.signOut);
  const deleteAccount = useAccountStore((s) => s.deleteAccount);

  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const goToWelcome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar sesión',
      'Musicaleando no usa correo ni contraseña — esta sesión vive solo en este dispositivo. Si cierras sesión, no hay forma de volver a entrar a esta cuenta desde otro dispositivo ni recuperarla después. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
              goToWelcome();
            } catch (err) {
              Alert.alert('No se pudo cerrar sesión', err instanceof Error ? err.message : 'Intenta de nuevo.');
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
    );
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      Alert.alert('Cuenta eliminada', 'Tu cuenta y tus datos personales se eliminaron permanentemente.');
      goToWelcome();
    } catch (err) {
      Alert.alert('No se pudo eliminar la cuenta', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Configuración</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cuenta</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>ID de cuenta</Text>
            <Text style={styles.cardValue}>{userId ?? '—'}</Text>
            <Text style={styles.hintText}>
              Musicaleando no pide correo ni contraseña — tu cuenta es anónima y vive en este
              dispositivo.
            </Text>
          </View>
          <PrimaryButton
            label="Cerrar sesión"
            variant="secondary"
            onPress={handleSignOut}
            loading={signingOut}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, styles.dangerLabel]}>Zona de peligro</Text>
          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.dangerTitle}>Eliminar mi cuenta</Text>
            <Text style={styles.hintText}>
              Esto borra tu perfil musical, tu historial de moods, tus membresías de squad y tus
              solicitudes de contacto de forma permanente e inmediata — no hay periodo de gracia
              ni forma de recuperarlos después. Tus comentarios y reacciones en festivales
              permanecen visibles para no romper la conversación, pero dejan de estar ligados a ti
              (se muestran como &quot;Usuario eliminado&quot;).
            </Text>

            {!confirmingDelete ? (
              <Pressable style={styles.dangerButton} onPress={() => setConfirmingDelete(true)}>
                <Text style={styles.dangerButtonText}>Eliminar mi cuenta</Text>
              </Pressable>
            ) : (
              <View style={styles.confirmBlock}>
                <Text style={styles.hintText}>
                  Esta acción es permanente e irreversible. Escribe{' '}
                  <Text style={styles.confirmWord}>{DELETE_CONFIRM_WORD}</Text> para confirmar.
                </Text>
                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={DELETE_CONFIRM_WORD}
                  placeholderTextColor={colors.textMuted}
                  style={styles.confirmInput}
                  editable={!deleting}
                />
                <View style={styles.confirmActions}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => {
                      setConfirmingDelete(false);
                      setConfirmText('');
                    }}
                    disabled={deleting}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.dangerButton,
                      styles.confirmDeleteButton,
                      (confirmText !== DELETE_CONFIRM_WORD || deleting) && styles.dangerButtonDisabled,
                    ]}
                    onPress={handleDeleteAccount}
                    disabled={confirmText !== DELETE_CONFIRM_WORD || deleting}
                  >
                    <Text style={styles.dangerButtonText}>
                      {deleting ? 'Eliminando…' : 'Eliminar permanentemente'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
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
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  dangerLabel: {
    color: colors.danger,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  cardValue: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  hintText: {
    ...type.body,
    color: colors.textMuted,
  },
  dangerCard: {
    borderColor: 'rgba(248, 113, 113, 0.3)',
    gap: spacing.sm,
  },
  dangerTitle: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  dangerButton: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    marginTop: spacing.xs,
  },
  dangerButtonDisabled: {
    opacity: 0.4,
  },
  dangerButtonText: {
    ...type.bodyLg,
    color: colors.onAccent,
  },
  confirmBlock: {
    gap: spacing.sm,
  },
  confirmWord: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  confirmInput: {
    ...type.bodyLg,
    color: colors.textPrimary,
    backgroundColor: colors.bgElevatedHigh,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  confirmDeleteButton: {
    flex: 1,
    marginTop: 0,
  },
  cancelButton: {
    flex: 1,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevatedHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
});
