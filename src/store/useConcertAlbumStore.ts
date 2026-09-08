import { create } from 'zustand';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { ContentReportMotivo, Tables } from '../types/database';

export type ConcertAlbumEntry = Tables<'concert_album'> & {
  festivalNombre: string;
  signedUrl: string | null;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

const SIGNED_URL_TTL_SECONDS = 3600;
const MAX_BYTES = 8 * 1024 * 1024; // mirrors the bucket's file_size_limit
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function extensionFor(mimeType: string | null | undefined): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

type ConcertAlbumState = {
  entries: ConcertAlbumEntry[];
  entriesBySquad: Record<string, ConcertAlbumEntry[]>;
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
  // "Álbum del squad" (SquadDetailScreen) — la única superficie donde tiene
  // sentido un botón de reportar, ya que el álbum propio no muestra fotos
  // ajenas. Ejercita la misma RLS de squadmate ya verificada con cuentas
  // reales (ver ESTADO.md).
  fetchSquad: (squadId: string, memberUserIds: string[]) => Promise<void>;
  addPhoto: (
    userId: string,
    festivalId: string,
    festivalNombre: string,
    localUri: string,
    mimeType: string | null | undefined,
    fileSize: number | null | undefined,
  ) => Promise<void>;
  deletePhoto: (entryId: string, fotoPath: string) => Promise<void>;
  reportPhoto: (userId: string, entryId: string, motivo: ContentReportMotivo) => Promise<void>;
};

// Album privado + squad (confirmado con el usuario, ver ESTADO.md): esta
// pantalla solo muestra el álbum PROPIO — el bucket/tabla ya soportan que un
// squadmate lea las fotos de otro (RLS verificada con cuentas reales), pero
// una UI para navegar el álbum de squadmates no se pidió esta sesión.
export const useConcertAlbumStore = create<ConcertAlbumState>((set, get) => ({
  entries: [],
  entriesBySquad: {},
  status: 'idle',
  error: null,

  fetch: async (userId) => {
    set({ status: 'loading', error: null });

    const { data, error } = await supabase
      .from('concert_album')
      .select('*, festivals(nombre)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    const rows = (data ?? []) as (Tables<'concert_album'> & { festivals: { nombre: string } | null })[];

    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from('concert-album')
          .createSignedUrl(row.foto_path, SIGNED_URL_TTL_SECONDS);
        return {
          ...row,
          festivalNombre: row.festivals?.nombre ?? 'Festival',
          signedUrl: signed?.signedUrl ?? null,
        };
      }),
    );

    set({ entries: withUrls, status: 'ready' });
  },

  addPhoto: async (userId, festivalId, festivalNombre, localUri, mimeType, fileSize) => {
    const mime = mimeType ?? 'image/jpeg';
    if (!ALLOWED_MIME.includes(mime)) {
      throw new Error('Formato no soportado — usa JPG, PNG o WEBP.');
    }
    if (fileSize && fileSize > MAX_BYTES) {
      throw new Error('La foto pesa más de 8MB — elige una más ligera o deja que la app la comprima.');
    }

    const ext = extensionFor(mime);
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const bytes = await new File(localUri).bytes();
    const { error: uploadError } = await supabase.storage
      .from('concert-album')
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error: insertError } = await supabase
      .from('concert_album')
      .insert({
        user_id: userId,
        festival_id: festivalId,
        foto_path: path,
      })
      .select('*')
      .single();

    if (insertError) {
      // Don't leave an orphaned file if the metadata row couldn't be saved
      // (e.g. the user never actually marked "voy" for this festival).
      await supabase.storage.from('concert-album').remove([path]);
      throw insertError;
    }

    const { data: signed } = await supabase.storage
      .from('concert-album')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    set({
      entries: [{ ...data, festivalNombre, signedUrl: signed?.signedUrl ?? null }, ...get().entries],
    });
  },

  fetchSquad: async (squadId, memberUserIds) => {
    if (memberUserIds.length === 0) {
      set({ entriesBySquad: { ...get().entriesBySquad, [squadId]: [] } });
      return;
    }

    const { data, error } = await supabase
      .from('concert_album')
      .select('*, festivals(nombre)')
      .in('user_id', memberUserIds)
      .order('created_at', { ascending: false });

    if (error) {
      set({ error: error.message });
      return;
    }

    const rows = (data ?? []) as (Tables<'concert_album'> & { festivals: { nombre: string } | null })[];
    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from('concert-album')
          .createSignedUrl(row.foto_path, SIGNED_URL_TTL_SECONDS);
        return {
          ...row,
          festivalNombre: row.festivals?.nombre ?? 'Festival',
          signedUrl: signed?.signedUrl ?? null,
        };
      }),
    );

    set({ entriesBySquad: { ...get().entriesBySquad, [squadId]: withUrls } });
  },

  deletePhoto: async (entryId, fotoPath) => {
    const previous = get().entries;
    set({ entries: previous.filter((e) => e.id !== entryId) });

    const { error: dbError } = await supabase.from('concert_album').delete().eq('id', entryId);
    if (dbError) {
      set({ entries: previous, error: dbError.message });
      return;
    }
    await supabase.storage.from('concert-album').remove([fotoPath]);
  },

  reportPhoto: async (userId, entryId, motivo) => {
    const { error } = await supabase
      .from('content_reports')
      .insert({ content_type: 'concert_photo', content_id: entryId, reporter_user_id: userId, motivo });
    if (error) throw error;
  },
}));
