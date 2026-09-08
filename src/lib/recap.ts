// Recap anual (Backlog v2): shapes returned by the get_recap_anual(p_anio)
// RPC, which does all the aggregation server-side (calendar year, confirmed
// with the user — see ESTADO.md) and returns one jsonb object.

export type RecapFestival = {
  nombre: string;
  ciudad: string;
  fecha_inicio: string;
};

export type RecapCampeon = {
  artist_id: string;
  artist_nombre: string;
  artist_imagen_url: string | null;
  veces: number;
} | null;

export type RecapFoto = {
  foto_path: string;
  festival_nombre: string;
};

export type RecapData = {
  anio: number;
  festivales_count: number;
  festivales: RecapFestival[];
  campeon: RecapCampeon;
  fotos: RecapFoto[];
  generos: string[];
  arquetipo: string | null;
};

export function isRecapEmpty(recap: RecapData): boolean {
  return recap.festivales_count === 0 && recap.campeon === null && recap.fotos.length === 0;
}
