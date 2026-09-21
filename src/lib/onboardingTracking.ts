// Registro de hasta qué paso del onboarding llega cada usuario (embudo de
// abandono). Los pasos son 15: la bienvenida, las 10 preguntas del quiz, la
// revelación del arquetipo, el mood, la pantalla de ubicación/estados y el
// final. Copia de la lista en admin/src/lib/onboardingSteps.ts (el panel de
// métricas la usa para poner nombre a cada paso; una prueba vigila que sean
// idénticas).
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

export const PASO_BIENVENIDA = 1;
export const PASO_REVELACION = 12;
export const PASO_MOOD = 13;
export const PASO_UBICACION = 14;
export const PASO_COMPLETO = 15;

// El quiz tiene 10 preguntas (índice 0-9) y ocupan los pasos 2 a 11.
export const pasoDeQuiz = (stepIndex: number): number => 2 + stepIndex;

type SendResult = { error?: unknown } | void;
export type SendOnboardingStep = (userId: string, paso: number, nombre: string) => Promise<SendResult> | SendResult;

// Fábrica del registrador: recibe CÓMO se envía (en la app, un upsert a
// Supabase; en las pruebas, un doble) y devuelve la función que las pantallas
// llaman. A propósito NO devuelve promesa ni se espera: el onboarding no debe
// tardar ni un instante más por esto, y si el envío falla (sin red, RLS) solo
// se pierde ese punto del embudo, nunca se bloquea ni se muestra nada.
// Cada (usuario, paso) se envía una sola vez por sesión de la app (volver
// atrás y avanzar no repite); si un envío falla, se reintenta la próxima vez
// que el usuario llegue a ese paso.
export function createOnboardingTracker(send: SendOnboardingStep) {
  const enviados = new Set<string>();
  return function trackOnboardingStep(userId: string | null | undefined, paso: number): void {
    if (!userId) return;
    const step = ONBOARDING_STEPS.find((s) => s.paso === paso);
    if (!step) return;
    const key = `${userId}:${paso}`;
    if (enviados.has(key)) return;
    enviados.add(key);
    const olvidar = () => enviados.delete(key);
    try {
      Promise.resolve(send(userId, step.paso, step.nombre)).then((res) => {
        if (res && res.error) olvidar();
      }, olvidar);
    } catch {
      olvidar();
    }
  };
}
