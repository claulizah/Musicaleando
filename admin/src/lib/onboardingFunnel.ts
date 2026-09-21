// Embudo de abandono del onboarding para el panel de métricas.
//
// ONBOARDING_STEPS es copia idéntica de la de la app (src/lib/onboardingTracking.ts);
// tests/unit/onboardingTracking.test.mts vigila que no se desincronicen.
export type OnboardingStep = { paso: number; nombre: string; etiqueta: string };

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { paso: 1, nombre: 'bienvenida', etiqueta: 'Bienvenida' },
  { paso: 2, nombre: 'quiz_01_duelo_visual', etiqueta: 'Quiz 1 · Duelo visual' },
  { paso: 3, nombre: 'quiz_02_generos', etiqueta: 'Quiz 2 · Géneros' },
  { paso: 4, nombre: 'quiz_03_energia', etiqueta: 'Quiz 3 · Energía' },
  { paso: 5, nombre: 'quiz_04_era', etiqueta: 'Quiz 4 · Era' },
  { paso: 6, nombre: 'quiz_05_guilty', etiqueta: 'Quiz 5 · Guilty pleasure' },
  { paso: 7, nombre: 'quiz_06_letra_beat', etiqueta: 'Quiz 6 · Letra o beat' },
  { paso: 8, nombre: 'quiz_07_descubrimiento', etiqueta: 'Quiz 7 · Descubrimiento' },
  { paso: 9, nombre: 'quiz_08_concierto', etiqueta: 'Quiz 8 · Concierto' },
  { paso: 10, nombre: 'quiz_09_social', etiqueta: 'Quiz 9 · Social' },
  { paso: 11, nombre: 'quiz_10_duelo_final', etiqueta: 'Quiz 10 · Duelo final' },
  { paso: 12, nombre: 'revelacion', etiqueta: 'Revelación del arquetipo' },
  { paso: 13, nombre: 'mood', etiqueta: 'Mood de hoy' },
  { paso: 14, nombre: 'ubicacion', etiqueta: 'Ubicación (opcional)' },
  { paso: 15, nombre: 'completo', etiqueta: 'Onboarding completo' },
];

// Con menos usuarios que esto el embudo es anecdótico: un solo usuario que
// cierra la app mueve un paso varios puntos porcentuales.
export const MIN_USUARIOS_PARA_CONCLUIR = 30;

export type FunnelInput = { paso: number; llegaron: number }[];

export type FunnelRow = {
  paso: number;
  etiqueta: string;
  llegaron: number;
  // % de los que empezaron (paso 1) que llegaron a este paso.
  pctDelInicio: number | null;
  // Cuántos llegaron a este paso y no pasaron al siguiente ("se quedaron aquí").
  seFueronAqui: number | null;
  // % de los que llegaron a este paso que se quedaron aquí. null en el último
  // paso (no hay "siguiente") y cuando nadie llegó.
  pctAbandonoAqui: number | null;
};

export type Funnel = {
  rows: FunnelRow[];
  empezaron: number;
  completaron: number;
  pctCompletaron: number | null;
  // Paso con más gente perdida (por cantidad, no por %), solo si hay pérdida.
  pasoMasAbandono: FunnelRow | null;
  pocoVolumen: boolean;
};

const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

// Convierte "cuántos llegaron a cada paso" (ya monótono: llegaron a N = paso
// máximo >= N) en la tabla del embudo. Los pasos que la base no devuelve se
// toman como 0 llegados.
export function buildFunnel(input: FunnelInput): Funnel {
  const byPaso = new Map(input.map((r) => [r.paso, r.llegaron]));
  const rows: FunnelRow[] = ONBOARDING_STEPS.map((step, i) => {
    const llegaron = byPaso.get(step.paso) ?? 0;
    const siguiente = ONBOARDING_STEPS[i + 1] ? (byPaso.get(ONBOARDING_STEPS[i + 1].paso) ?? 0) : null;
    const empezaron = byPaso.get(1) ?? 0;
    const seFueronAqui = siguiente === null ? null : Math.max(0, llegaron - siguiente);
    return {
      paso: step.paso,
      etiqueta: step.etiqueta,
      llegaron,
      pctDelInicio: pct(llegaron, empezaron),
      seFueronAqui,
      pctAbandonoAqui: seFueronAqui === null ? null : pct(seFueronAqui, llegaron),
    };
  });
  const empezaron = rows[0].llegaron;
  const completaron = rows[rows.length - 1].llegaron;
  const conPerdida = rows.filter((r) => (r.seFueronAqui ?? 0) > 0);
  const pasoMasAbandono = conPerdida.reduce<FunnelRow | null>(
    (best, r) => (best === null || (r.seFueronAqui ?? 0) > (best.seFueronAqui ?? 0) ? r : best),
    null,
  );
  return {
    rows,
    empezaron,
    completaron,
    pctCompletaron: pct(completaron, empezaron),
    pasoMasAbandono,
    pocoVolumen: empezaron < MIN_USUARIOS_PARA_CONCLUIR,
  };
}
