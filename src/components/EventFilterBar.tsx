import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
//
// Antes esto era UN solo scroll horizontal con tipo+fecha+ciudad+género
// juntos — con 55+ ciudades reales ya en el catálogo eso es una tira
// larguísima que se corta en el borde sin avisar (bug reportado por
// Claudia). Ahora: Tipo queda siempre visible (3 opciones, lo que más se
// usa para escanear rápido); fecha/ciudad/género quedan detrás de "Más
// filtros" para que la vista inicial no abrume; y cualquier fila que
// scrollea horizontal lleva un degradado en el borde derecho para que se
// note que sigue.
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
  const [showMore, setShowMore] = useState(false);
  const activeExtraCount = (dateFilter !== 'todos' ? 1 : 0) + (ciudad ? 1 : 0) + (soloMisGeneros ? 1 : 0);

  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Buscar evento o artista…"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <FadingChipRow>
        {TIPO_OPTIONS.map((opt) => (
          <Chip key={opt.id} label={opt.label} selected={tipoFilter === opt.id} onPress={() => onTipoFilterChange(opt.id)} />
        ))}
      </FadingChipRow>

      <Pressable onPress={() => setShowMore((v) => !v)} style={styles.moreToggle}>
        <Text style={styles.moreToggleText}>
          {showMore ? '▾' : '▸'} Más filtros{activeExtraCount > 0 ? ` (${activeExtraCount})` : ''}
        </Text>
      </Pressable>

      {showMore && (
        <View style={styles.moreWrap}>
          <FadingChipRow>
            {DATE_OPTIONS.map((opt) => (
              <Chip key={opt.id} label={opt.label} selected={dateFilter === opt.id} onPress={() => onDateFilterChange(opt.id)} />
            ))}
          </FadingChipRow>

          {ciudades.length > 0 && (
            <FadingChipRow>
              {ciudades.map((c) => (
                <Chip key={c} label={c} selected={ciudad === c} onPress={() => onCiudadChange(ciudad === c ? null : c)} />
              ))}
            </FadingChipRow>
          )}

          {showGeneroFilter && (
            <FadingChipRow>
              <Chip
                label={generoLoading ? 'Buscando…' : 'Coincide con tus géneros'}
                selected={soloMisGeneros}
                onPress={onToggleSoloMisGeneros}
              />
            </FadingChipRow>
          )}
        </View>
      )}
    </View>
  );
}

// Fila de chips con scroll horizontal + degradado en el borde derecho, para
// que quede claro que hay más opciones fuera de pantalla en vez de que
// parezca que la lista termina ahí (antes el corte era seco, sin aviso).
function FadingChipRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.fadingRowWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {children}
      </ScrollView>
      <LinearGradient
        colors={[`${colors.bg}00`, colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fadeEdge}
        pointerEvents="none"
      />
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

const FADE_WIDTH = 28;

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
  fadingRowWrap: {
    position: 'relative',
  },
  chipRow: {
    gap: spacing.xs,
    paddingRight: spacing.md + FADE_WIDTH,
  },
  fadeEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: FADE_WIDTH,
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
  moreToggle: {
    alignSelf: 'flex-start',
  },
  moreToggleText: {
    ...type.label,
    color: colors.accentSecondary,
  },
  moreWrap: {
    gap: spacing.sm,
  },
});
