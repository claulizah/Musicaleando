import type { ImageSourcePropType } from 'react-native';

// Static require() calls only — Metro resolves these at bundle time, so every
// path here must exist on disk. Missing options (e.g. an archetype whose image
// hasn't been generated yet) are simply omitted; consumers fall back to emoji.

export const DUELO_VISUAL_IMAGES: Record<string, ImageSourcePropType> = {
  mosh_pit: require('../../assets/quiz/duelo_visual/mosh_pit.png'),
  manta_pasto: require('../../assets/quiz/duelo_visual/manta_pasto.png'),
};

export const GENEROS_IMAGES: Record<string, ImageSourcePropType> = {
  rock: require('../../assets/quiz/generos/rock.png'),
  electronica: require('../../assets/quiz/generos/electronica.png'),
  pop: require('../../assets/quiz/generos/pop.png'),
  latin: require('../../assets/quiz/generos/latin.png'),
  indie: require('../../assets/quiz/generos/indie.png'),
  lofi: require('../../assets/quiz/generos/lofi.png'),
  jazz: require('../../assets/quiz/generos/jazz.png'),
  metal: require('../../assets/quiz/generos/metal.png'),
};

export const ERA_IMAGES: Record<string, ImageSourcePropType> = {
  '80s': require('../../assets/quiz/epoca/80s.png'),
  '90s': require('../../assets/quiz/epoca/90s.png'),
  '2000s': require('../../assets/quiz/epoca/2000s.png'),
  '2010s': require('../../assets/quiz/epoca/2010s.png'),
  ahora: require('../../assets/quiz/epoca/ahora.png'),
};

export const GUILTY_PLEASURE_IMAGES: Record<string, ImageSourcePropType> = {
  boyband: require('../../assets/quiz/guilty_pleasure/boyband.png'),
  ballad_cry: require('../../assets/quiz/guilty_pleasure/ballad_cry.png'),
  reggaeton_solo: require('../../assets/quiz/guilty_pleasure/reggaeton_solo.png'),
  anime: require('../../assets/quiz/guilty_pleasure/anime.png'),
  pop2010: require('../../assets/quiz/guilty_pleasure/pop2010.png'),
  metal_teen: require('../../assets/quiz/guilty_pleasure/metal_teen.png'),
};

export const LETRA_BEAT_IMAGES: Record<string, ImageSourcePropType> = {
  letra: require('../../assets/quiz/letra_beat/letra.png'),
  beat: require('../../assets/quiz/letra_beat/beat.png'),
};

export const DISCOVERY_IMAGES: Record<string, ImageSourcePropType> = {
  tiktok: require('../../assets/quiz/discovery/tiktok.png'),
  amigos: require('../../assets/quiz/discovery/amigos.png'),
  algoritmo: require('../../assets/quiz/discovery/algoritmo.png'),
  radio: require('../../assets/quiz/discovery/radio.png'),
};

export const CONCIERTO_IMAGES: Record<string, ImageSourcePropType> = {
  grabo: require('../../assets/quiz/concierto/grabo.png'),
  canto: require('../../assets/quiz/concierto/canto.png'),
  vivo: require('../../assets/quiz/concierto/vivo.png'),
  stories: require('../../assets/quiz/concierto/stories.png'),
};

export const SOCIAL_IMAGES: Record<string, ImageSourcePropType> = {
  solo: require('../../assets/quiz/social/solo.png'),
  duo: require('../../assets/quiz/social/duo.png'),
  grupo: require('../../assets/quiz/social/grupo.png'),
  lider: require('../../assets/quiz/social/lider.png'),
};

export const DUELO_FINAL_IMAGES: Record<string, ImageSourcePropType> = {
  mosh_pit: require('../../assets/quiz/duelo_final/mosh_pit.png'),
  graba: require('../../assets/quiz/duelo_final/graba.png'),
  baila_solo: require('../../assets/quiz/duelo_final/baila_solo.png'),
  grita_letra: require('../../assets/quiz/duelo_final/grita_letra.png'),
};

export const ARCHETYPE_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  baja_solo: require('../../assets/archetypes/baja_solo.png'),
  baja_duo: require('../../assets/archetypes/baja_duo.png'),
  baja_grupo: require('../../assets/archetypes/baja_grupo.png'),
  baja_lider: require('../../assets/archetypes/baja_lider.png'),
  media_solo: require('../../assets/archetypes/media_solo.png'),
  media_duo: require('../../assets/archetypes/media_duo.png'),
  media_grupo: require('../../assets/archetypes/media_grupo.png'),
  media_lider: require('../../assets/archetypes/media_lider.png'),
  alta_solo: require('../../assets/archetypes/alta_solo.png'),
  alta_duo: require('../../assets/archetypes/alta_duo.png'),
  alta_grupo: require('../../assets/archetypes/alta_grupo.png'),
  alta_lider: require('../../assets/archetypes/alta_lider.jpeg'),
};
