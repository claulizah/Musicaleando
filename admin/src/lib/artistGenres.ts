// Lista CONTROLADA de géneros (ids estables guardados en artists.genres). Base: la
// propuesta del ticket + 3 categorías que faltaban al revisar el catálogo real
// (Cultura Profética y Panteón Rococó -> Reggae / Ska; Marcos Witt y Marcos Vidal ->
// Cristiana / Gospel; Silvio Rodríguez, Nacho Vegas, Adanowsky -> Trova / Cantautor).
// "Otro" abre un texto libre aparte (artists.genre_other).
export const ARTIST_GENRES = [
  { id: 'regional_mexicano', label: 'Regional Mexicano', hint: 'banda, norteño, corridos, mariachi' },
  { id: 'pop', label: 'Pop', hint: '' },
  { id: 'rock', label: 'Rock', hint: '' },
  { id: 'balada', label: 'Balada / Romántico', hint: '' },
  { id: 'urbano', label: 'Urbano / Reggaetón', hint: '' },
  { id: 'rap', label: 'Rap / Hip-Hop', hint: '' },
  { id: 'cumbia', label: 'Cumbia / Tropical', hint: '' },
  { id: 'salsa', label: 'Salsa', hint: '' },
  { id: 'electronica', label: 'Electrónica', hint: '' },
  { id: 'metal', label: 'Metal', hint: '' },
  { id: 'indie', label: 'Indie / Alternativo', hint: '' },
  { id: 'jazz', label: 'Jazz / Blues', hint: '' },
  { id: 'clasica', label: 'Clásica / Sinfónico', hint: '' },
  { id: 'punk', label: 'Punk', hint: '' },
  { id: 'reggae', label: 'Reggae / Ska', hint: '' },
  { id: 'cristiana', label: 'Cristiana / Gospel', hint: '' },
  { id: 'trova', label: 'Trova / Cantautor', hint: '' },
  { id: 'otro', label: 'Otro', hint: 'texto libre aparte' },
] as const;

export type ArtistGenreId = (typeof ARTIST_GENRES)[number]['id'];

const VALID = new Set<string>(ARTIST_GENRES.map((g) => g.id));

export function genreLabel(id: string): string {
  return ARTIST_GENRES.find((g) => g.id === id)?.label ?? id;
}

// Solo ids de la lista, sin repetidos, en el orden de la lista; vacío -> null.
export function sanitizeGenres(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const chosen = new Set(input.filter((x): x is string => typeof x === 'string' && VALID.has(x)));
  const ordered = ARTIST_GENRES.map((g) => g.id as string).filter((id) => chosen.has(id));
  return ordered.length > 0 ? ordered : null;
}
