import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Pide permiso de notificaciones en un momento con contexto (se llama desde
// el botón "Seguir artista", nunca al abrir la app — ver ArtistDetailScreen)
// y, si se otorga, registra el token de Expo Push de este dispositivo contra
// el usuario actual. Devuelve false sin lanzar si el permiso se niega o el
// dispositivo no puede recibir push (ej. simulador/emulador) — el llamador
// simplemente no activa el toggle de "seguir" con notificaciones, no rompe
// el flujo.
export async function requestPushPermissionAndRegister(userId: string): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    // Config de EAS incompleta (ver app.json extra.eas.projectId) — no hay
    // token que pedir sin esto, pero no es motivo para tronar la app.
    console.error('No se pudo registrar push: falta extra.eas.projectId en app.json.');
    return false;
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (err) {
    // Simuladores/emuladores sin Google Play Services, o un build sin las
    // capacidades de push configuradas, lanzan acá — no es un error del
    // usuario, así que el toggle de "seguir" simplemente no queda con
    // notificaciones activas.
    console.error('No se pudo obtener el token de push de este dispositivo:', err);
    return false;
  }

  const { error } = await supabase
    .from('user_push_tokens')
    .upsert(
      { user_id: userId, push_token: token, platform: Platform.OS === 'ios' ? 'ios' : 'android', updated_at: new Date().toISOString() },
      { onConflict: 'push_token' },
    );
  if (error) {
    console.error('No se pudo guardar el token de push:', error);
    return false;
  }
  return true;
}

export async function hasPushPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
