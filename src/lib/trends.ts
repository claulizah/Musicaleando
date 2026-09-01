import { ARCHETYPES } from './archetypes';
import { GENEROS } from './archetypes';
import { Tables, TrendTipo } from '../types/database';

export type TrendRow = Tables<'trends'>;

export type FormattedTrend = {
  emoji: string;
  title: string;
  body: string;
};

export function formatTrend(trend: TrendRow): FormattedTrend {
  const tipo = trend.tipo as TrendTipo;
  const payload = (trend.payload as Record<string, unknown>) ?? {};

  if (tipo === 'energia_vs_ciudad') {
    const diferencia = Number(payload.diferencia ?? 0);
    const ciudad = String(payload.ciudad ?? 'tu ciudad');
    const arriba = diferencia >= 0;
    return {
      emoji: arriba ? '⚡' : '🌙',
      title: arriba ? 'Traes más energía que tu ciudad' : 'Vas más tranqui que tu ciudad',
      body: `Tu energía está ${Math.round(Math.abs(diferencia) * 100)} puntos ${arriba ? 'arriba' : 'abajo'} del promedio de ${ciudad}.`,
    };
  }

  if (tipo === 'genero_dominante') {
    const generoId = String(payload.genero ?? '');
    const genero = GENEROS.find((g) => g.id === generoId);
    return {
      emoji: genero?.emoji ?? '🎧',
      title: 'Tu género de la semana',
      body: genero ? `Le estás entrando fuerte al ${genero.label}.` : 'Sigues explorando nuevos sonidos.',
    };
  }

  // dato_arquetipo (and fallback)
  const arquetipoId = String(payload.arquetipo ?? '');
  const archetype = ARCHETYPES[arquetipoId as keyof typeof ARCHETYPES];
  return {
    emoji: archetype?.emoji ?? '✨',
    title: archetype ? `Dato de ${archetype.label}` : 'Dato del día',
    body: String(payload.dato ?? 'Tu vibra musical es única — sigue explorando.'),
  };
}
