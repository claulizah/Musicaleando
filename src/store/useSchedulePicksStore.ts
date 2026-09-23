import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// "Mi horario": filas de festival_lineup que el usuario marcó como "quiero
// verlo" en un festival. Independiente de followed_artists (seguir para
// futuros eventos) y de Voy/Tal vez/No voy (estado del festival completo).
// Se cargan todas las marcas del usuario de una vez (son pocas) y se filtran
// por line-up en la vista; persisten en festival_schedule_picks.
type PicksState = {
  pickedIds: Set<string>; // lineup_id
  busy: Set<string>;
  load: (userId: string) => Promise<void>;
  toggle: (userId: string, festivalId: string, lineupId: string) => Promise<void>;
};

export const useSchedulePicksStore = create<PicksState>((set, get) => ({
  pickedIds: new Set(),
  busy: new Set(),

  load: async (userId) => {
    const { data, error } = await supabase.from('festival_schedule_picks').select('lineup_id').eq('user_id', userId);
    if (error) {
      console.error('No se pudo cargar Mi horario:', error);
      return;
    }
    set({ pickedIds: new Set((data ?? []).map((r) => r.lineup_id)) });
  },

  toggle: async (userId, festivalId, lineupId) => {
    if (get().busy.has(lineupId)) return;
    const wasPicked = get().pickedIds.has(lineupId);
    const setPicked = (picked: boolean) =>
      set((s) => {
        const next = new Set(s.pickedIds);
        if (picked) next.add(lineupId);
        else next.delete(lineupId);
        return { pickedIds: next };
      });
    const setBusy = (b: boolean) =>
      set((s) => {
        const next = new Set(s.busy);
        if (b) next.add(lineupId);
        else next.delete(lineupId);
        return { busy: next };
      });

    setBusy(true);
    setPicked(!wasPicked); // optimista; se revierte si falla
    try {
      const { error } = wasPicked
        ? await supabase.from('festival_schedule_picks').delete().eq('user_id', userId).eq('lineup_id', lineupId)
        : await supabase
            .from('festival_schedule_picks')
            .upsert(
              { user_id: userId, lineup_id: lineupId, festival_id: festivalId },
              { onConflict: 'user_id,lineup_id', ignoreDuplicates: true },
            );
      if (error) {
        console.error('No se pudo guardar la marca de Mi horario:', error);
        setPicked(wasPicked);
      }
    } finally {
      setBusy(false);
    }
  },
}));
