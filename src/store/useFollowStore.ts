import { create } from 'zustand';
import { Alert } from 'react-native';
import { fetchFollowedArtistIds, followArtist, unfollowArtist } from '../lib/followArtists';
import { requestPushPermissionAndRegister } from '../lib/pushNotifications';

// Estado único de "artistas que sigo", compartido por TODOS los lugares desde
// donde se puede seguir (ficha del artista, line-up de la tarjeta del
// catálogo): así el ícono se actualiza al instante en cualquier pantalla y
// hay una sola implementación de la lógica (permiso de push + escritura en
// followed_artists), no una copia por pantalla.
type FollowState = {
  followedIds: Set<string>;
  loaded: boolean;
  busy: Set<string>; // artistas con una escritura en curso (evita doble toque)
  load: (userId: string) => Promise<void>;
  toggle: (userId: string, artistId: string) => Promise<void>;
};

export const useFollowStore = create<FollowState>((set, get) => ({
  followedIds: new Set(),
  loaded: false,
  busy: new Set(),

  load: async (userId) => {
    const ids = await fetchFollowedArtistIds(userId);
    set({ followedIds: ids, loaded: true });
  },

  toggle: async (userId, artistId) => {
    if (get().busy.has(artistId)) return;
    const wasFollowing = get().followedIds.has(artistId);

    const setFollowed = (following: boolean) =>
      set((s) => {
        const next = new Set(s.followedIds);
        if (following) next.add(artistId);
        else next.delete(artistId);
        return { followedIds: next };
      });
    const setBusy = (isBusy: boolean) =>
      set((s) => {
        const next = new Set(s.busy);
        if (isBusy) next.add(artistId);
        else next.delete(artistId);
        return { busy: next };
      });

    setBusy(true);
    // Optimista: el ícono cambia al tocar; si la escritura falla, se revierte.
    setFollowed(!wasFollowing);
    try {
      if (wasFollowing) {
        const ok = await unfollowArtist(userId, artistId);
        if (!ok) setFollowed(true);
        return;
      }

      // El permiso de notificaciones se pide aquí — el primer momento en que
      // el usuario expresa intención real de recibir avisos — nunca al abrir
      // la app. Negarlo no bloquea seguir: "seguir" y "recibir push" son
      // cosas separadas.
      // También re-registra el token si el permiso ya estaba dado (upsert).
      const granted = await requestPushPermissionAndRegister(userId);
      if (!granted) {
        Alert.alert(
          'Notificaciones desactivadas',
          'Puedes seguir al artista igual, pero no te avisaremos de nuevos eventos hasta que actives las notificaciones desde los ajustes de tu teléfono.',
        );
      }

      const ok = await followArtist(userId, artistId);
      if (!ok) setFollowed(false);
    } finally {
      setBusy(false);
    }
  },
}));
