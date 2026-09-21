import { supabase } from './supabase';
import { createOnboardingTracker } from './onboardingTracking';

// Registro del avance del onboarding: un upsert que ignora duplicados (la
// llave es usuario + paso, así que solo queda la PRIMERA vez que llegó a cada
// paso). Ver onboardingTracking.ts para las reglas y el porqué de no esperar
// la respuesta.
export const trackOnboardingStep = createOnboardingTracker(async (userId, paso, nombre) => {
  const { error } = await supabase
    .from('onboarding_progress')
    .upsert({ user_id: userId, paso, paso_nombre: nombre }, { onConflict: 'user_id,paso', ignoreDuplicates: true });
  if (error) console.warn('No se pudo registrar el paso del onboarding (no bloqueante):', error.message);
  return { error };
});
