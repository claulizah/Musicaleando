import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing, type } from '../theme';
import type { DateFilter, TipoFilter } from '../hooks/useEventFilters';

const TIPO_OPTIONS: { id: TipoFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'festival', label: 'Festivales' },
  { id: 'concierto', label: 'Conciertos' },
];

const DATE_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: 'todos', label: 'Cualquier fecha' },
  { id: 'proximos7', label: 'Próximos 7 días' },
  { id: 'este_mes', label: 'Este mes' },
];

export type EventFilterBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  ciudad: string | null;
  onCiudadChange: (c: string | null) => void;
  ciudades: string[];
  dateFilter: DateFilter;
  onDateFilterChange: (f: DateFilter) => void;
  tipoFilter: TipoFilter;
  onTipoFilterChange: (f: TipoFilter) => void;
  soloMisGeneros: boolean;
  onToggleSoloMisGeneros: () => void;
  generoLoading: boolean;
  showGeneroFilter: boolean;
};

// Barra de búsqueda + chips reusable — misma instancia en el catálogo
// principal (FestivalHubScreen) y en el selector de festival al crear un
// squad (SquadsScreen), para no mantener dos implementaciones del mismo
// filtro. Ver useEventFilters (el hook que le da los valores) para el
// porqué del toggle de género en vez de un selector de género arbitrario.
export function EventFilterBar({
  query,
  onQueryChange,
  ciudad,
  onCiudadChange,
  ciudades,
  dateFilter,
  onDateFilterChange,
  tipoFilter,
  onTipoFilterChange,
  soloMisGeneros,
  onToggleSoloMisGeneros,
  generoLoading,
  showGeneroFilter,
}: EventFilterBarProps) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Buscar evento o artista…"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TIPO_OPTIONS.map((opt) => (
          <Chip key={opt.id} label={opt.label} selected={tipoFilter === opt.id} onPress={() => onTipoFilterChange(opt.id)} />
        ))}
        {DATE_OPTIONS.map((opt) => (
          <Chip key={opt.id} label={opt.label} selected={dateFilter === opt.id} onPress={() => onDateFilterChange(opt.id)} />
        ))}
        {ciudades.map((c) => (
          <Chip key={c} label={c} selected={ciudad === c} onPress={() => onCiudadChange(ciudad === c ? null : c)} />
        ))}
        {showGeneroFilter && (
          <Chip
            label={generoLoading ? 'Buscando…' : 'Coincide con tus géneros'}
            selected={soloMisGeneros}
            onPress={onToggleSoloMisGeneros}
          />
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  input: {
    ...type.body,
    color: colors.textPrimary,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipRow: {
    gap: spacing.xs,
    paddingRight: spacing.md,
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
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.accentPrimary,
  },
});
