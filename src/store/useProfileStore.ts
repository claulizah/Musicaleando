import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';
import { ArchetypeId, QuizAnswers, computeArchetype } from '../lib/archetypes';
import { TournamentArtist } from '../lib/spotify';
import { ImportGenreResult } from '../lib/musicImport';

type MusicProfile = Tables<'music_profile'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

export type TorneoCampeon = {
  generoId: string;
  artistId: string;
  artistName: string;
  artistImageUrl?: string;
};

type ProfileState = {
  profile: MusicProfile | null;
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
  saveFromQuiz: (userId: string, answers: QuizAnswers) => Promise<ArchetypeId>;
  applyTournamentChampion: (userId: string, champion: TournamentArtist) => Promise<void>;
  updateGuiltyPleasures: (userId: string, ids: string[]) => Promise<void>;
  applyImportResult: (userId: string, result: ImportGenreResult) => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  status: 'idle',
  error: null,

  fetch: async (userId) => {
    set({ status: 'loading', error: null });
    const { data, error } = await supabase
      .from('music_profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }
    set({ profile: data, status: 'ready' });
  },

  saveFromQuiz: async (userId, answers) => {
    if (!answers.socialId || answers.energia === undefined) {
      throw new Error('El cuestionario no está completo: falta energía o el eje social.');
    }
    const arquetipo = computeArchetype(answers.energia, answers.socialId);
    const guiltyPleasures = answers.guiltyPleasureId ? [answers.guiltyPleasureId] : [];

    const { data, error } = await supabase
      .from('music_profile')
      .upsert(
        {
          user_id: userId,
          generos: answers.generoIds,
          energia: answers.energia,
          guilty_pleasures: guiltyPleasures,
          social: answers.socialId,
          flavor: {
            era: answers.eraId ?? null,
            concierto: answers.concertoId ?? null,
            letra_beat: answers.letraBeatId ?? null,
            duelo_visual: answers.duelVisualId ?? null,
            duelo_final: answers.duelFinalId ?? null,
            discovery: answers.discoveryId ?? null,
          },
          arquetipo,
          origen: 'quiz',
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (error) throw error;
    set({ profile: data, status: 'ready' });
    return arquetipo;
  },

  applyTournamentChampion: async (userId, champion) => {
    const current = get().profile;
    // Crowning an artist champion reinforces the genre it came from — touching
    // `generos` is also what re-triggers the compat_score recompute trigger
    // (music_profile_recompute_compat fires on UPDATE OF generos, energia).
    const generos = Array.from(
      new Set([...(((current?.generos as string[]) ?? [])), champion.generoId]),
    );
    const torneoCampeon: TorneoCampeon = {
      generoId: champion.generoId,
      artistId: champion.id,
      artistName: champion.name,
      artistImageUrl: champion.imageUrl,
    };
    const flavor = {
      ...((current?.flavor as Record<string, unknown>) ?? {}),
      torneo_campeon: torneoCampeon,
      torneo_fecha: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('music_profile')
      .update({ generos, flavor })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    set({ profile: data, status: 'ready' });
  },

  updateGuiltyPleasures: async (userId, ids) => {
    const { data, error } = await supabase
      .from('music_profile')
      .update({ guilty_pleasures: ids })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    set({ profile: data, status: 'ready' });
  },

  applyImportResult: async (userId, result) => {
    if (result.generos.length === 0) {
      throw new Error('No reconocimos suficientes artistas de tu historial para inferir géneros.');
    }
    const current = get().profile;
    // Merge, don't replace — an import refines the profile, it shouldn't
    // erase what the quiz already established.
    const generos = Array.from(
      new Set([...(((current?.generos as string[]) ?? [])), ...result.generos]),
    );
    const flavor = {
      ...((current?.flavor as Record<string, unknown>) ?? {}),
      import_fecha: new Date().toISOString(),
      import_top_artists: result.matchedArtists.slice(0, 5).map((a) => a.name),
    };

    const { data, error } = await supabase
      .from('music_profile')
      .update({ generos, flavor, origen: 'import' })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    set({ profile: data, status: 'ready' });
  },
}));
