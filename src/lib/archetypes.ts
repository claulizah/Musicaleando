// 12 fixed archetypes on a 2-axis grid: energia (baja/media/alta, from the slider) x
// social (solo/duo/grupo/lider, from "¿con quién llegas al festival?"). Every other
// answer (género, década, guilty pleasure, cómo vives el concierto, letra/beat,
// descubrimiento, los dos duelos) is flavor only — it never changes which of the 12
// archetypes you land on, it just decorates the result card.

export type EnergyBucket = 'baja' | 'media' | 'alta';
export type SocialAxis = 'solo' | 'duo' | 'grupo' | 'lider';
export type ArchetypeId = `${EnergyBucket}_${SocialAxis}`;

export type ArchetypeDef = {
  id: ArchetypeId;
  label: string;
  emoji: string;
  description: string;
  gradient: readonly [string, string];
};

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
  baja_solo: {
    id: 'baja_solo',
    label: 'El Oyente Silencioso',
    emoji: '🎧',
    description: 'Encuentras tu paz entre canciones, con los audífonos como refugio.',
    gradient: ['#4C3184', '#14111F'],
  },
  baja_duo: {
    id: 'baja_duo',
    label: 'El Acompañante Zen',
    emoji: '🌙',
    description: 'Tu festival ideal es compartir el silencio bueno con una sola persona.',
    gradient: ['#4C3184', '#2A1B4A'],
  },
  baja_grupo: {
    id: 'baja_grupo',
    label: 'El Ancla del Squad',
    emoji: '⚓',
    description: 'Mientras el grupo se dispersa, tú sostienes el punto de encuentro.',
    gradient: ['#3B2D6B', '#1E1830'],
  },
  baja_lider: {
    id: 'baja_lider',
    label: 'El Curador Tranquilo',
    emoji: '🗺️',
    description: 'Armas el plan perfecto sin necesitar estar en el centro del escenario.',
    gradient: ['#4C3184', '#6D28D9'],
  },
  media_solo: {
    id: 'media_solo',
    label: 'El Explorador Independiente',
    emoji: '🧭',
    description: 'Te mueves solo/a entre escenarios, siguiendo tu propio mapa sonoro.',
    gradient: ['#8B5CF6', '#4C3184'],
  },
  media_duo: {
    id: 'media_duo',
    label: 'El Dúo Dinámico',
    emoji: '🤝',
    description: 'Ustedes dos contra el festival: mismo playlist, mismo paso.',
    gradient: ['#8B5CF6', '#B24A78'],
  },
  media_grupo: {
    id: 'media_grupo',
    label: 'El Alma del Grupo',
    emoji: '🎉',
    description: 'Mantienes viva la energía del squad de escenario en escenario.',
    gradient: ['#8B5CF6', '#FF6B4A'],
  },
  media_lider: {
    id: 'media_lider',
    label: 'El Estratega del Festival',
    emoji: '📋',
    description: 'Tienes el itinerario, los horarios y el plan B. Todos te siguen.',
    gradient: ['#6D28D9', '#8B5CF6'],
  },
  alta_solo: {
    id: 'alta_solo',
    label: 'El Caos Controlado',
    emoji: '🌀',
    description: 'Te entregas a la música sin necesitar a nadie más para hacerlo bien.',
    gradient: ['#FF6B4A', '#6D28D9'],
  },
  alta_duo: {
    id: 'alta_duo',
    label: 'Los Incendiarios',
    emoji: '🔥',
    description: 'Ustedes dos prenden cada pista a la que llegan, sin excepción.',
    gradient: ['#FF6B4A', '#B23A2A'],
  },
  alta_grupo: {
    id: 'alta_grupo',
    label: 'El Corazón del Mosh Pit',
    emoji: '💥',
    description: 'El squad entero gira a tu alrededor cuando sube la energía.',
    gradient: ['#FF6B4A', '#8B5CF6'],
  },
  alta_lider: {
    id: 'alta_lider',
    label: 'El General de la Fiesta',
    emoji: '👑',
    description: 'Comandas al grupo entero directo al centro de la pista.',
    gradient: ['#FF6B4A', '#B24A78'],
  },
};

export function energiaBucket(value: number): EnergyBucket {
  if (value < 0.4) return 'baja';
  if (value < 0.75) return 'media';
  return 'alta';
}

export function computeArchetype(energia: number, social: SocialAxis): ArchetypeId {
  return `${energiaBucket(energia)}_${social}`;
}

// ---- Question option data -------------------------------------------------

export type DuelOption = {
  id: string;
  label: string;
  emoji: string;
  gradient: readonly [string, string];
};

export type TileOption = {
  id: string;
  label: string;
  emoji: string;
  gradient: readonly [string, string];
  flavorLabel?: string; // used when this question feeds the flavor line
};

export type IconOption = {
  id: string;
  label: string;
  emoji: string;
};

export type FlavorOption = {
  id: string;
  label: string;
  emoji?: string;
  flavorPhrase: string; // fragment, lowercase, ready to drop into the flavor line
};

export const DUELO_VISUAL: [DuelOption, DuelOption] = [
  { id: 'mosh_pit', label: 'Primera fila, mosh pit', emoji: '🤘', gradient: ['#FF6B4A', '#B23A2A'] },
  { id: 'manta_pasto', label: 'Manta en el pasto, luces lejanas', emoji: '✨', gradient: ['#8B5CF6', '#2A1B4A'] },
];

export const GENEROS: TileOption[] = [
  { id: 'rock', label: 'Rock', emoji: '🎸', gradient: ['#B23A2A', '#14111F'], flavorLabel: 'rock' },
  { id: 'electronica', label: 'Electrónica', emoji: '🎧', gradient: ['#8B5CF6', '#14111F'], flavorLabel: 'electrónica' },
  { id: 'pop', label: 'Pop', emoji: '🎤', gradient: ['#FF6B4A', '#14111F'], flavorLabel: 'pop' },
  { id: 'latin', label: 'Reggaetón / Latin', emoji: '🌴', gradient: ['#FF6B4A', '#8B5CF6'], flavorLabel: 'reggaetón' },
  { id: 'indie', label: 'Indie / Alternativo', emoji: '🎹', gradient: ['#6D28D9', '#14111F'], flavorLabel: 'indie' },
  { id: 'lofi', label: 'Chill / Lo-fi', emoji: '☁️', gradient: ['#4C3184', '#1E1830'], flavorLabel: 'lo-fi' },
  { id: 'jazz', label: 'Jazz / Soul', emoji: '🎷', gradient: ['#B24A78', '#1E1830'], flavorLabel: 'jazz' },
  { id: 'metal', label: 'Metal', emoji: '🔥', gradient: ['#14111F', '#B23A2A'], flavorLabel: 'metal' },
];

export const ERA: FlavorOption[] = [
  { id: '80s', label: '80s', emoji: '📼', flavorPhrase: 'de los 80s' },
  { id: '90s', label: '90s', emoji: '📻', flavorPhrase: 'de los 90s' },
  { id: '2000s', label: '2000s', emoji: '💿', flavorPhrase: 'de los 2000s' },
  { id: '2010s', label: '2010s', emoji: '🎧', flavorPhrase: 'de los 2010s' },
  { id: 'ahora', label: 'Ahora', emoji: '⚡', flavorPhrase: 'de lo que suena ahora mismo' },
];

export const GUILTY_PLEASURES: FlavorOption[] = [
  { id: 'boyband', label: 'Me sé el playlist completo de un boy band', flavorPhrase: 'ama a un boy band en secreto' },
  { id: 'ballad_cry', label: 'Lloro con baladas manejando', flavorPhrase: 'llora con baladas manejando' },
  { id: 'reggaeton_solo', label: 'Bailo reggaetón viejo yo solo/a', flavorPhrase: 'baila reggaetón viejo a solas' },
  { id: 'anime', label: 'Grito openings de anime a todo volumen', flavorPhrase: 'grita openings de anime a todo volumen' },
  { id: 'pop2010', label: 'Tengo un playlist solo de pop de los 2010', flavorPhrase: 'vive en su playlist de pop de los 2010' },
  { id: 'metal_teen', label: 'Sigo con el mismo álbum de metal desde los 15', flavorPhrase: 'sigue fiel al mismo álbum de metal desde los 15' },
];

export const LETRA_BEAT: [DuelOption, DuelOption] = [
  { id: 'letra', label: 'La letra', emoji: '📝', gradient: ['#8B5CF6', '#2A1B4A'] },
  { id: 'beat', label: 'El beat', emoji: '🥁', gradient: ['#FF6B4A', '#B23A2A'] },
];

export const DISCOVERY: IconOption[] = [
  { id: 'tiktok', label: 'TikTok', emoji: '📱' },
  { id: 'amigos', label: 'Amigos', emoji: '👯' },
  { id: 'algoritmo', label: 'Algoritmo', emoji: '🤖' },
  { id: 'radio', label: 'Radio', emoji: '📻' },
];

export const CONCIERTO: FlavorOption[] = [
  { id: 'grabo', label: 'Grabo todo', emoji: '📹', flavorPhrase: 'vive el show detrás de la cámara' },
  { id: 'canto', label: 'Canto cada palabra', emoji: '🎤', flavorPhrase: 'se sabe cada palabra del setlist' },
  { id: 'vivo', label: 'Vivo el momento', emoji: '✨', flavorPhrase: 'vive el momento sin pantallas de por medio' },
  { id: 'stories', label: 'Hago stories', emoji: '📲', flavorPhrase: 'narra el show en tiempo real' },
];

export const SOCIAL: { id: SocialAxis; label: string; emoji: string }[] = [
  { id: 'solo', label: 'Solo', emoji: '🧍' },
  { id: 'duo', label: 'En dúo', emoji: '👯' },
  { id: 'grupo', label: 'Con mi squad', emoji: '👥' },
  { id: 'lider', label: 'Yo organizo a todos', emoji: '👑' },
];

export const DUELO_FINAL: TileOption[] = [
  { id: 'mosh_pit', label: 'Armo el mosh pit', emoji: '🤘', gradient: ['#FF6B4A', '#B23A2A'] },
  { id: 'graba', label: 'Grabo todo para la story', emoji: '📱', gradient: ['#8B5CF6', '#4C3184'] },
  { id: 'baila_solo', label: 'Bailo solo/a sin pena', emoji: '💃', gradient: ['#8B5CF6', '#FF6B4A'] },
  { id: 'grita_letra', label: 'Grito cada letra', emoji: '🎤', gradient: ['#B24A78', '#2A1B4A'] },
];

// ---- Answers ----------------------------------------------------------------

export type QuizAnswers = {
  duelVisualId?: string;
  generoIds: string[];
  energia?: number; // 0..1
  eraId?: string;
  guiltyPleasureId?: string;
  letraBeatId?: string;
  discoveryId?: string;
  concertoId?: string;
  socialId?: SocialAxis;
  duelFinalId?: string;
};

export const EMPTY_QUIZ_ANSWERS: QuizAnswers = {
  generoIds: [],
};

export function isQuizComplete(answers: QuizAnswers): boolean {
  return Boolean(
    answers.duelVisualId &&
      answers.generoIds.length > 0 &&
      answers.energia !== undefined &&
      answers.eraId &&
      answers.guiltyPleasureId &&
      answers.letraBeatId &&
      answers.discoveryId &&
      answers.concertoId &&
      answers.socialId &&
      answers.duelFinalId,
  );
}

export function hasAnyAnswer(answers: QuizAnswers): boolean {
  return Boolean(
    answers.duelVisualId ||
      answers.generoIds.length > 0 ||
      answers.energia !== undefined ||
      answers.eraId ||
      answers.guiltyPleasureId ||
      answers.letraBeatId ||
      answers.discoveryId ||
      answers.concertoId ||
      answers.socialId ||
      answers.duelFinalId,
  );
}

export function energiaEmoji(value: number): string {
  if (value < 0.2) return '😴';
  if (value < 0.4) return '😌';
  if (value < 0.6) return '🙂';
  if (value < 0.8) return '😃';
  if (value < 0.95) return '🤩';
  return '🔥';
}

// género + década + cómo vives el concierto + guilty pleasure -> one flavor line,
// shown under the archetype description. Purely decorative, never affects scoring.
export function buildFlavorLine(answers: QuizAnswers): string {
  const fragments: string[] = [];

  const genero = GENEROS.find((g) => g.id === answers.generoIds[0]);
  const era = ERA.find((e) => e.id === answers.eraId);
  if (genero && era) {
    fragments.push(`le entra al ${genero.flavorLabel} ${era.flavorPhrase}`);
  } else if (genero) {
    fragments.push(`le entra al ${genero.flavorLabel}`);
  }

  const concierto = CONCIERTO.find((c) => c.id === answers.concertoId);
  if (concierto) fragments.push(concierto.flavorPhrase);

  const guilty = GUILTY_PLEASURES.find((g) => g.id === answers.guiltyPleasureId);
  if (guilty) fragments.push(`confiesa que ${guilty.flavorPhrase}`);

  return fragments.join(' · ');
}
