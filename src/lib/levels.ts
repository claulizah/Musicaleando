// Level system: Iniciado → Habitual → Veterano → Leyenda del mosh → Alma de
// festival, based on how many distinct festivals a user confirmed ("Voy") to.
// festival_intent's primary key is (user_id, festival_id), so a count of
// status='voy' rows is already a count of distinct festivals — no extra
// "diversity" dimension needs computing on top of it.
//
// Thresholds are a judgment call, not from the spec: with only one real
// festival loaded today, most users will sit at Iniciado/Habitual for a
// while — that's expected at this stage, not a bug in the thresholds.

export type LevelId = 'iniciado' | 'habitual' | 'veterano' | 'leyenda_mosh' | 'alma_festival';

export type LevelDef = {
  id: LevelId;
  label: string;
  emoji: string;
  description: string;
  minFestivales: number;
  gradient: readonly [string, string];
};

export const LEVELS: LevelDef[] = [
  {
    id: 'iniciado',
    label: 'Iniciado',
    emoji: '🌱',
    description: 'Apenas empiezas a marcar festivales en tu radar.',
    minFestivales: 0,
    gradient: ['#4C3184', '#14111F'],
  },
  {
    id: 'habitual',
    label: 'Habitual',
    emoji: '🎫',
    description: 'Ya vas seguido — el festival es parte de tu rutina.',
    minFestivales: 1,
    gradient: ['#6D28D9', '#4C3184'],
  },
  {
    id: 'veterano',
    label: 'Veterano',
    emoji: '🏕️',
    description: 'Conoces el terreno: line-ups, escenarios, horarios.',
    minFestivales: 3,
    gradient: ['#8B5CF6', '#6D28D9'],
  },
  {
    id: 'leyenda_mosh',
    label: 'Leyenda del mosh',
    emoji: '🔥',
    description: 'No hay festival que se te escape ni pista que te dé miedo.',
    minFestivales: 5,
    gradient: ['#FF6B4A', '#8B5CF6'],
  },
  {
    id: 'alma_festival',
    label: 'Alma de festival',
    emoji: '👑',
    description: 'El festival vive en ti todo el año, no solo en temporada.',
    minFestivales: 8,
    gradient: ['#FF6B4A', '#B23A2A'],
  },
];

export function levelForFestivalCount(count: number): LevelDef {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (count >= level.minFestivales) current = level;
  }
  return current;
}

export function nextLevel(current: LevelDef): LevelDef | null {
  const idx = LEVELS.findIndex((l) => l.id === current.id);
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}
