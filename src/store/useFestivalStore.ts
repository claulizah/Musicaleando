import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { fetchAllByIds } from '../lib/fetchInChunks';
import {
  ContentReportMotivo,
  FestivalReactionType,
  FestivalStatus,
  SurveyCalificacion,
  SurveyVolveria,
  Tables,
} from '../types/database';

export type FestivalReactionSummary = {
  likes: number;
  dislikes: number;
  mine: FestivalReactionType | null;
};

export type FestivalFeedbackSummary = {
  mine: Tables<'festival_feedback'> | null;
};

export type AnnouncementWithInterest = Tables<'announcements'> & {
  interestCount: number;
  mineInterested: boolean;
};

export type FestivalSurveyStatus = {
  mine: Tables<'festival_survey_responses'> | null;
  // Survey is only worth showing once the festival is actually over and the
  // user confirmed they went — no point asking "¿qué tal estuvo?" for a
  // festival someone marked "tal vez" or that hasn't happened yet.
  due: boolean;
};

export type FestivalWithIntent = {
  festival: Tables<'festivals'>;
  myStatus: FestivalStatus | null;
  squadGoingCount: number;
  // "Mapa social" (Sprint 6): who exactly, not just how many — resolved to
  // arquetipo/nombre in the UI via useSquadStore's already-loaded squads
  // (built from squad_members_with_profile), not a new query here.
  squadGoingIds: string[];
  lineup: Tables<'festival_lineup'>[];
  reactions: FestivalReactionSummary;
  feedback: FestivalFeedbackSummary;
  comments: Tables<'festival_comments'>[];
  announcements: AnnouncementWithInterest[];
  mapPins: Tables<'festival_map_pins'>[];
  survey: FestivalSurveyStatus;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

type FestivalState = {
  festivals: FestivalWithIntent[];
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
  setStatus: (userId: string, festivalId: string, newStatus: FestivalStatus) => Promise<void>;
  setReaction: (userId: string, festivalId: string, reaction: FestivalReactionType) => Promise<void>;
  submitFeedback: (
    userId: string,
    festivalId: string,
    tags: string[],
    comentario: string | null,
  ) => Promise<void>;
  postComment: (userId: string, festivalId: string, texto: string) => Promise<void>;
  deleteComment: (festivalId: string, commentId: string) => Promise<void>;
  reportComment: (userId: string, commentId: string, motivo: ContentReportMotivo) => Promise<void>;
  toggleInterest: (userId: string, festivalId: string, announcementId: string) => Promise<void>;
  submitSurvey: (
    userId: string,
    festivalId: string,
    calificacion: SurveyCalificacion,
    volveria: SurveyVolveria,
  ) => Promise<void>;
};

export const useFestivalStore = create<FestivalState>((set, get) => ({
  festivals: [],
  status: 'idle',
  error: null,

  fetch: async (userId) => {
    set({ status: 'loading', error: null });

    const { data: festivalRows, error: festErr } = await supabase
      .from('festivals')
      .select('*')
      .order('fecha_inicio');

    if (festErr) {
      set({ status: 'error', error: festErr.message });
      return;
    }

    const festivalIds = (festivalRows ?? []).map((f) => f.id);
    if (festivalIds.length === 0) {
      set({ festivals: [], status: 'ready' });
      return;
    }

    // RLS scopes this to my own rows + my squadmates' rows automatically.
    const { data: intentRows, error: intentErr } = await fetchAllByIds(festivalIds, (chunk) =>
      supabase.from('festival_intent').select('*').in('festival_id', chunk),
    );

    if (intentErr) {
      set({ status: 'error', error: intentErr.message });
      return;
    }

    const { data: lineupRows, error: lineupErr } = await fetchAllByIds(festivalIds, (chunk) =>
      supabase
        .from('festival_lineup')
        .select('*')
        .in('festival_id', chunk)
        .order('horario', { ascending: true, nullsFirst: false }),
    );

    if (lineupErr) {
      set({ status: 'error', error: lineupErr.message });
      return;
    }

    const { data: reactionRows, error: reactionErr } = await fetchAllByIds(festivalIds, (chunk) =>
      supabase.from('festival_reactions').select('*').in('festival_id', chunk),
    );

    if (reactionErr) {
      set({ status: 'error', error: reactionErr.message });
      return;
    }

    const { data: feedbackRows, error: feedbackErr } = await fetchAllByIds(festivalIds, (chunk) =>
      supabase.from('festival_feedback').select('*').in('festival_id', chunk).eq('user_id', userId),
    );

    if (feedbackErr) {
      set({ status: 'error', error: feedbackErr.message });
      return;
    }

    const { data: commentRows, error: commentErr } = await fetchAllByIds(festivalIds, (chunk) =>
      supabase.from('festival_comments').select('*').in('festival_id', chunk).order('created_at', { ascending: false }),
    );

    if (commentErr) {
      set({ status: 'error', error: commentErr.message });
      return;
    }

    const { data: rawAnnouncementRows, error: announcementErr } = await fetchAllByIds(festivalIds, (chunk) =>
      supabase.from('announcements').select('*').in('festival_id', chunk).order('created_at', { ascending: false }),
    );

    if (announcementErr) {
      set({ status: 'error', error: announcementErr.message });
      return;
    }

    // Segmentación básica: un anuncio con target_ciudad/target_genero solo
    // se muestra a quien califica — el filtro real (mínimo de agregación)
    // ya se aplicó al publicarlo desde el panel admin, esto es solo "¿me
    // toca verlo a mí?". Own row reads only (RLS select-own), nunca se leen
    // otros usuarios aquí.
    const [{ data: myUserRow }, { data: myProfileRow }] = await Promise.all([
      supabase.from('users').select('ciudad').eq('id', userId).maybeSingle(),
      supabase.from('music_profile').select('generos').eq('user_id', userId).maybeSingle(),
    ]);
    const myCiudad = myUserRow?.ciudad ?? null;
    const myGeneros = (myProfileRow?.generos as string[] | null) ?? [];

    const announcementRows = (rawAnnouncementRows ?? []).filter((a) => {
      if (a.target_ciudad && a.target_ciudad !== myCiudad) return false;
      if (a.target_genero && !myGeneros.includes(a.target_genero)) return false;
      return true;
    });

    const announcementIds = announcementRows.map((a) => a.id);
    const { data: interestRows, error: interestErr } = await fetchAllByIds(announcementIds, (chunk) =>
      supabase.from('announcement_interest').select('*').in('announcement_id', chunk),
    );

    if (interestErr) {
      set({ status: 'error', error: interestErr.message });
      return;
    }

    const { data: mapPinRows, error: mapPinErr } = await fetchAllByIds(festivalIds, (chunk) =>
      supabase.from('festival_map_pins').select('*').in('festival_id', chunk),
    );

    if (mapPinErr) {
      set({ status: 'error', error: mapPinErr.message });
      return;
    }

    const { data: surveyRows, error: surveyErr } = await fetchAllByIds(festivalIds, (chunk) =>
      supabase.from('festival_survey_responses').select('*').in('festival_id', chunk).eq('user_id', userId),
    );

    if (surveyErr) {
      set({ status: 'error', error: surveyErr.message });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const festivals: FestivalWithIntent[] = (festivalRows ?? []).map((festival) => {
      const rowsForFestival = (intentRows ?? []).filter((i) => i.festival_id === festival.id);
      const mine = rowsForFestival.find((i) => i.user_id === userId);
      const squadGoingIds = rowsForFestival
        .filter((i) => i.user_id !== userId && i.status === 'voy')
        .map((i) => i.user_id);
      const squadGoingCount = squadGoingIds.length;
      const lineup = (lineupRows ?? []).filter((l) => l.festival_id === festival.id);

      const reactionsForFestival = (reactionRows ?? []).filter((r) => r.festival_id === festival.id);
      const myReaction = reactionsForFestival.find((r) => r.user_id === userId);
      const reactions: FestivalReactionSummary = {
        likes: reactionsForFestival.filter((r) => r.reaction === 'like').length,
        dislikes: reactionsForFestival.filter((r) => r.reaction === 'dislike').length,
        mine: (myReaction?.reaction as FestivalReactionType) ?? null,
      };

      const myFeedback = (feedbackRows ?? []).find((f) => f.festival_id === festival.id) ?? null;
      const comments = (commentRows ?? []).filter((c) => c.festival_id === festival.id);

      const announcements: AnnouncementWithInterest[] = (announcementRows ?? [])
        .filter((a) => a.festival_id === festival.id)
        .map((a) => {
          const interestForAnnouncement = (interestRows ?? []).filter((i) => i.announcement_id === a.id);
          return {
            ...a,
            interestCount: interestForAnnouncement.length,
            mineInterested: interestForAnnouncement.some((i) => i.user_id === userId),
          };
        });

      const mapPins = (mapPinRows ?? []).filter((p) => p.festival_id === festival.id);

      const myStatus = (mine?.status as FestivalStatus) ?? null;
      const mySurvey = (surveyRows ?? []).find((s) => s.festival_id === festival.id) ?? null;
      const surveyDue = myStatus === 'voy' && festival.fecha_fin < today && !mySurvey;

      return {
        festival,
        myStatus,
        squadGoingCount,
        squadGoingIds,
        lineup,
        reactions,
        feedback: { mine: myFeedback },
        comments,
        announcements,
        mapPins,
        survey: { mine: mySurvey, due: surveyDue },
      };
    });

    set({ festivals, status: 'ready' });
  },

  setStatus: async (userId, festivalId, newStatus) => {
    const previous = get().festivals;
    set({
      festivals: previous.map((f) =>
        f.festival.id === festivalId ? { ...f, myStatus: newStatus } : f,
      ),
    });

    const { error } = await supabase
      .from('festival_intent')
      .upsert(
        { user_id: userId, festival_id: festivalId, status: newStatus },
        { onConflict: 'user_id,festival_id' },
      );

    if (error) {
      set({ festivals: previous, status: 'error', error: error.message });
    }
  },

  setReaction: async (userId, festivalId, reaction) => {
    const previous = get().festivals;
    const entry = previous.find((f) => f.festival.id === festivalId);
    if (!entry) return;
    const wasSame = entry.reactions.mine === reaction;

    // Tapping the same reaction again clears it (toggle), matching the
    // low-friction one-tap pattern used for community trend votes.
    set({
      festivals: previous.map((f) => {
        if (f.festival.id !== festivalId) return f;
        const r = { ...f.reactions };
        if (r.mine === 'like') r.likes -= 1;
        if (r.mine === 'dislike') r.dislikes -= 1;
        if (!wasSame) {
          if (reaction === 'like') r.likes += 1;
          if (reaction === 'dislike') r.dislikes += 1;
          r.mine = reaction;
        } else {
          r.mine = null;
        }
        return { ...f, reactions: r };
      }),
    });

    const { error } = wasSame
      ? await supabase
          .from('festival_reactions')
          .delete()
          .eq('festival_id', festivalId)
          .eq('user_id', userId)
      : await supabase
          .from('festival_reactions')
          .upsert(
            { festival_id: festivalId, user_id: userId, reaction, updated_at: new Date().toISOString() },
            { onConflict: 'festival_id,user_id' },
          );

    if (error) {
      set({ festivals: previous, status: 'error', error: error.message });
    }
  },

  submitFeedback: async (userId, festivalId, tags, comentario) => {
    const { data, error } = await supabase
      .from('festival_feedback')
      .upsert(
        {
          festival_id: festivalId,
          user_id: userId,
          tags,
          comentario,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'festival_id,user_id' },
      )
      .select('*')
      .single();

    if (error) throw error;

    set({
      festivals: get().festivals.map((f) =>
        f.festival.id === festivalId ? { ...f, feedback: { mine: data } } : f,
      ),
    });
  },

  postComment: async (userId, festivalId, texto) => {
    const trimmed = texto.trim();
    if (!trimmed) return;

    const { data, error } = await supabase
      .from('festival_comments')
      .insert({ festival_id: festivalId, user_id: userId, texto: trimmed })
      .select('*')
      .single();

    if (error) throw error;

    set({
      festivals: get().festivals.map((f) =>
        f.festival.id === festivalId ? { ...f, comments: [data, ...f.comments] } : f,
      ),
    });
  },

  reportComment: async (userId, commentId, motivo) => {
    const { error } = await supabase
      .from('content_reports')
      .insert({ content_type: 'festival_comment', content_id: commentId, reporter_user_id: userId, motivo });
    if (error) throw error;
  },

  deleteComment: async (festivalId, commentId) => {
    const previous = get().festivals;
    set({
      festivals: previous.map((f) =>
        f.festival.id === festivalId
          ? { ...f, comments: f.comments.filter((c) => c.id !== commentId) }
          : f,
      ),
    });

    const { error } = await supabase.from('festival_comments').delete().eq('id', commentId);
    if (error) {
      set({ festivals: previous, status: 'error', error: error.message });
    }
  },

  toggleInterest: async (userId, festivalId, announcementId) => {
    const previous = get().festivals;
    const entry = previous.find((f) => f.festival.id === festivalId);
    const announcement = entry?.announcements.find((a) => a.id === announcementId);
    if (!announcement) return;
    const wasInterested = announcement.mineInterested;

    set({
      festivals: previous.map((f) => {
        if (f.festival.id !== festivalId) return f;
        return {
          ...f,
          announcements: f.announcements.map((a) =>
            a.id === announcementId
              ? {
                  ...a,
                  mineInterested: !wasInterested,
                  interestCount: a.interestCount + (wasInterested ? -1 : 1),
                }
              : a,
          ),
        };
      }),
    });

    const { error } = wasInterested
      ? await supabase
          .from('announcement_interest')
          .delete()
          .eq('announcement_id', announcementId)
          .eq('user_id', userId)
      : await supabase.from('announcement_interest').insert({ announcement_id: announcementId, user_id: userId });

    if (error) {
      set({ festivals: previous, status: 'error', error: error.message });
    }
  },

  submitSurvey: async (userId, festivalId, calificacion, volveria) => {
    const { data, error } = await supabase
      .from('festival_survey_responses')
      .upsert(
        {
          festival_id: festivalId,
          user_id: userId,
          calificacion,
          volveria,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'festival_id,user_id' },
      )
      .select('*')
      .single();

    if (error) throw error;

    set({
      festivals: get().festivals.map((f) =>
        f.festival.id === festivalId ? { ...f, survey: { mine: data, due: false } } : f,
      ),
    });
  },
}));
