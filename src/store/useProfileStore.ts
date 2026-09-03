import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';
import { ArchetypeId, QuizAnswers, computeArchetype } from '../lib/archetypes';

type MusicProfile = Tables<'music_profile'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type ProfileState = {
  profile: MusicProfile | null;
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
  saveFromQuiz: (userId: string, answers: QuizAnswers) => Promise<ArchetypeId>;
  applyTournamentChampion: (userId: string, championId: string) => Promise<void>;
  updateGuiltyPleasures: (userId: string, ids: string[]) => Promise<void>;
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

  applyTournamentChampion: async (userId, championId) => {
    const current = get().profile;
    const generos = Array.from(new Set([...(((current?.generos as string[]) ?? [])), championId]));
    const flavor = {
      ...((current?.flavor as Record<string, unknown>) ?? {}),
      torneo_campeon: championId,
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
}));
