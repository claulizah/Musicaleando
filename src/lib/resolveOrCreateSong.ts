import { supabase } from './supabase';
import { Tables } from '../types/database';

// songs.genero tiene un CHECK constraint a estos 8 valores fijos (los mismos
// que GENEROS en archetypes.ts, usados para los chips de filtro de Trends) —
// el género de iTunes (en inglés, ej. "Urbano latino", "Hip-Hop/Rap") nunca
// va a calzar exacto, así que se mapea por palabras clave con un fallback
// genérico en vez de fallar el insert.
const GENRE_KEYWORDS: [RegExp, string][] = [
  [/latin|urbano|reggaeton/i, 'latin'],
  [/rock|alternative/i, 'rock'],
  [/electronic|dance|techno|house/i, 'electronica'],
  [/indie/i, 'indie'],
  [/jazz|soul|r&b|rnb/i, 'jazz'],
  [/metal/i, 'metal'],
  [/lo-?fi|chill|ambient/i, 'lofi'],
];
const FALLBACK_GENERO = 'pop';

function mapGenero(itunesGenre: string | undefined): string {
  if (!itunesGenre) return FALLBACK_GENERO;
  const match = GENRE_KEYWORDS.find(([re]) => re.test(itunesGenre));
  return match ? match[1] : FALLBACK_GENERO;
}

// songs.mood es un enum viejo (fiesta/chill/electronica) de antes de que
// "Mood del día" se homologara a mood_catalog/mood_playlists — ya no se lee
// en ningún filtro real (ver ESTADO.md), pero la columna sigue NOT NULL con
// su propio CHECK, así que hace falta un valor cualquiera de los 3 válidos.
const LEGACY_MOOD_PLACEHOLDER = 'fiesta';

// Busca una canción ya existente por título+artista (case-insensitive) antes
// de crear una nueva — varias personas compartiendo la misma canción real no
// deben generar una fila duplicada por cada quien.
export async function resolveOrCreateSong(
  titulo: string,
  artista: string,
  itunesGenre: string | undefined,
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('songs')
    .select('id')
    .ilike('titulo', titulo)
    .ilike('artista', artista)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('songs')
    .insert({
      titulo,
      artista,
      genero: mapGenero(itunesGenre),
      mood: LEGACY_MOOD_PLACEHOLDER,
    })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return (created as Tables<'songs'>).id;
}
