// Display metadata for rows in `user_badges`. The awarding logic itself lives
// in Postgres (migrations sprint7_founder_badge / sprint7_rare_combo_badges) —
// this file only needs to mirror badge_id -> label/emoji/description so the
// client never has to re-derive eligibility, just render what the DB already
// decided.

export type BadgeDef = {
  id: string;
  label: string;
  emoji: string;
  description: string;
};

export const FOUNDER_BADGE: BadgeDef = {
  id: 'founder',
  label: 'Miembro fundador',
  emoji: '🌟',
  description: 'Uno de los primeros 500 en unirse a Musicaleando.',
};

// Hand-curated on purpose, not statistically derived — see the migration
// comment in sprint7_rare_combo_badges for why: with only a handful of real
// users so far, "rare in this user base" doesn't mean anything yet. This is
// a fixed v1 list; swap for a real rarity computation once there's volume.
export const RARE_COMBO_BADGES: BadgeDef[] = [
  {
    id: 'rare_metal_boyband',
    label: 'Metalero de closet',
    emoji: '🤘',
    description: 'Metal de los 80s por fuera, boy band por dentro.',
  },
  {
    id: 'rare_jazz_reggaeton',
    label: 'El Jazzista Reggaetonero',
    emoji: '🎷',
    description: 'Jazz de ahora mismo, pero baila reggaetón viejo a solas.',
  },
  {
    id: 'rare_lofi_anime',
    label: 'El Chill Otaku',
    emoji: '☁️',
    description: 'Lo-fi de los 2000s con openings de anime a todo volumen.',
  },
  {
    id: 'rare_latin_metal',
    label: 'El Cumbianchero Headbanger',
    emoji: '🌴',
    description: 'Reggaetón/Latin de los 80s, fiel al mismo álbum de metal desde los 15.',
  },
  {
    id: 'rare_indie_pop2010',
    label: 'El Indie Nostálgico Confundido',
    emoji: '🎹',
    description: 'Indie de los 90s con un playlist secreto de pop de los 2010.',
  },
  {
    id: 'rare_rock_anime',
    label: 'El Rockero Otaku Moderno',
    emoji: '🎸',
    description: 'Rock de lo que suena ahora, openings de anime a todo volumen.',
  },
];

export const ALL_BADGES: BadgeDef[] = [FOUNDER_BADGE, ...RARE_COMBO_BADGES];

export const BADGES_BY_ID: Record<string, BadgeDef> = Object.fromEntries(
  ALL_BADGES.map((b) => [b.id, b]),
);

export function badgeFor(badgeId: string): BadgeDef | undefined {
  return BADGES_BY_ID[badgeId];
}
