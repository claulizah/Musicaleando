import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tables } from '../types/database';
import {
  formatRango,
  groupByNivel,
  groupLineupByDay,
  hasRealHorario,
  hasSchedule,
  sortByHorario,
  type Nivel,
} from '../lib/lineupSchedule';
import { colors, radii, spacing, type } from '../theme';

type LineupRow = Tables<'festival_lineup'>;
type LineupView = 'nivel' | 'horario';

const NIVEL_TITLE: Record<Nivel, string> = {
  estelar: '⭐ Estelares',
  destacado: 'Destacados',
  general: 'Más artistas',
};

// Line-up de un evento en dos vistas:
//  - "Por nivel": como el cartel — estelares arriba, luego destacados y el
//    resto. Es la vista por defecto porque no necesita horas.
//  - "Por horario": por hora de inicio (24 h). Solo se ofrece si al menos un
//    artista trae hora real; los que no la tienen quedan al final.
// En eventos de varios días ambas vistas se agrupan por día (colapsable).
// Ver lineupSchedule.ts para la convención de hora.
export function LineupSection({
  lineup,
  fechaInicio,
  fechaFin,
  initiallyOpen,
  onArtistPress,
}: {
  lineup: LineupRow[];
  fechaInicio: string | null;
  fechaFin: string | null;
  initiallyOpen: boolean;
  onArtistPress: (artist: LineupRow) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [view, setView] = useState<LineupView>('nivel');
  const [openDays, setOpenDays] = useState<Set<string>>(new Set(['0']));

  if (lineup.length === 0) return null;

  const schedule = hasSchedule(lineup);
  const activeView: LineupView = schedule ? view : 'nivel';
  const byDay = groupLineupByDay(lineup, fechaInicio, fechaFin);

  const toggleDay = (key: string) =>
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderArtist = (artist: LineupRow, opts: { big?: boolean; showTime?: boolean } = {}) => {
    const rango = formatRango(artist.horario, artist.horario_fin);
    const meta = [artist.escenario, opts.showTime ? null : rango].filter((p): p is string => Boolean(p)).join(' · ');
    return (
      <Pressable
        key={artist.id}
        disabled={!artist.artist_id}
        style={styles.row}
        onPress={() => onArtistPress(artist)}
      >
        {opts.showTime && <Text style={styles.time}>{rango ?? '—'}</Text>}
        <Text style={[styles.name, opts.big && styles.nameBig]} numberOfLines={1}>
          {artist.artista}
        </Text>
        {meta.length > 0 && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderByNivel = (items: LineupRow[]) => {
    const groups = groupByNivel(items);
    const onlyGeneral = groups.length === 1 && groups[0].nivel === 'general';
    return groups.map((g) => (
      <View key={g.nivel}>
        {!onlyGeneral && <Text style={styles.groupTitle}>{NIVEL_TITLE[g.nivel]}</Text>}
        {g.items.map((a) => renderArtist(a, { big: g.nivel === 'estelar' }))}
      </View>
    ));
  };

  const renderBySchedule = (items: LineupRow[]) => {
    const sorted = sortByHorario(items);
    const timed = sorted.filter((a) => hasRealHorario(a.horario));
    const untimed = sorted.filter((a) => !hasRealHorario(a.horario));
    return (
      <View>
        {timed.map((a) => renderArtist(a, { showTime: true }))}
        {untimed.length > 0 && (
          <>
            {timed.length > 0 && <Text style={styles.groupTitle}>Horario por confirmar</Text>}
            {untimed.map((a) => renderArtist(a))}
          </>
        )}
      </View>
    );
  };

  const renderItems = (items: LineupRow[]) => (activeView === 'horario' ? renderBySchedule(items) : renderByNivel(items));

  return (
    <View>
      <Pressable onPress={() => setOpen((v) => !v)}>
        <Text style={styles.toggle}>
          {open ? '▾' : '▸'} Line-up ({lineup.length})
        </Text>
      </Pressable>
      {open && (
        <View style={styles.body}>
          {schedule && (
            <View style={styles.viewChips}>
              {(['nivel', 'horario'] as const).map((v) => (
                <Pressable
                  key={v}
                  style={[styles.chip, activeView === v && styles.chipSelected]}
                  onPress={() => setView(v)}
                >
                  <Text style={[styles.chipLabel, activeView === v && styles.chipLabelSelected]}>
                    {v === 'nivel' ? 'Por nivel' : 'Por horario'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {byDay
            ? byDay.map((group, i) => {
                const dayKey = String(i);
                const isOpen = openDays.has(dayKey);
                return (
                  <View key={group.day ?? 'sin-dia'}>
                    <Pressable onPress={() => toggleDay(dayKey)}>
                      <Text style={styles.toggle}>
                        {'  '}
                        {isOpen ? '▾' : '▸'} {group.label} ({group.items.length})
                      </Text>
                    </Pressable>
                    {isOpen && renderItems(group.items)}
                  </View>
                );
              })
            : renderItems(lineup)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    ...type.label,
    color: colors.textSecondary,
  },
  body: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  viewChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  chip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimaryMuted,
  },
  chipLabel: {
    ...type.label,
    color: colors.textPrimary,
  },
  chipLabelSelected: {
    color: colors.accentPrimary,
  },
  groupTitle: {
    ...type.label,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  time: {
    ...type.label,
    color: colors.accentPrimary,
    width: 88,
  },
  name: {
    ...type.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  nameBig: {
    ...type.h2,
    color: colors.textPrimary,
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
    flexShrink: 0,
    marginLeft: 'auto',
  },
});
