import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

// Sentinel de "todas las ciudades" para el dropdown — ciudad real en la app
// es `string | null`, pero un dropdown necesita un id de opción concreto
// para el valor "sin filtro".
const CIUDAD_TODAS = '__todas__';
const ESTADO_TODOS = '__todos__';

export type EventFilterBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  ciudad: string | null;
  onCiudadChange: (c: string | null) => void;
  ciudades: string[];
  estadoRepublica: string | null;
  onEstadoRepublicaChange: (e: string | null) => void;
  estadosRepublica: string[];
  dateFilter: DateFilter;
  onDateFilterChange: (f: DateFilter) => void;
  tipoFilter: TipoFilter;
  onTipoFilterChange: (f: TipoFilter) => void;
  soloMisGeneros: boolean;
  onToggleSoloMisGeneros: () => void;
  generoLoading: boolean;
  showGeneroFilter: boolean;
  // Descuentos y preventas vigentes (ver lib/descuentos.ts). Los chips solo
  // aparecen si hay algo que filtrar, o si ya están activados (para poder
  // apagarlos).
  soloDescuento: boolean;
  onToggleSoloDescuento: () => void;
  soloPreventa: boolean;
  onToggleSoloPreventa: () => void;
  promoCounts: { descuento: number; preventa: number };
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
  estadoRepublica,
  onEstadoRepublicaChange,
  estadosRepublica,
  dateFilter,
  onDateFilterChange,
  tipoFilter,
  onTipoFilterChange,
  soloMisGeneros,
  onToggleSoloMisGeneros,
  generoLoading,
  showGeneroFilter,
  soloDescuento,
  onToggleSoloDescuento,
  soloPreventa,
  onToggleSoloPreventa,
  promoCounts,
}: EventFilterBarProps) {
  const [showMore, setShowMore] = useState(false);
  const activeExtraCount =
    (dateFilter !== 'todos' ? 1 : 0) + (ciudad ? 1 : 0) + (estadoRepublica ? 1 : 0) + (soloMisGeneros ? 1 : 0);

  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Buscar evento, artista, ciudad o lugar…"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <FadingChipRow>
        {TIPO_OPTIONS.map((opt) => (
          <Chip key={opt.id} label={opt.label} selected={tipoFilter === opt.id} onPress={() => onTipoFilterChange(opt.id)} />
        ))}
        {(promoCounts.descuento > 0 || soloDescuento) && (
          <Chip label={`🏷 En descuento (${promoCounts.descuento})`} selected={soloDescuento} onPress={onToggleSoloDescuento} />
        )}
        {(promoCounts.preventa > 0 || soloPreventa) && (
          <Chip label={`Preventa (${promoCounts.preventa})`} selected={soloPreventa} onPress={onToggleSoloPreventa} />
        )}
      </FadingChipRow>

      <Pressable onPress={() => setShowMore((v) => !v)} style={styles.moreToggle}>
        <Text style={styles.moreToggleText}>
          {showMore ? '▾' : '▸'} Más filtros{activeExtraCount > 0 ? ` (${activeExtraCount})` : ''}
        </Text>
      </Pressable>

      {showMore && (
        <View style={styles.moreWrap}>
          <Dropdown
            label="Fecha"
            options={DATE_OPTIONS}
            value={dateFilter}
            onChange={(v) => onDateFilterChange(v as DateFilter)}
          />

          {ciudades.length > 0 && (
            <Dropdown
              label="Ciudad"
              options={[{ id: CIUDAD_TODAS, label: 'Todas las ciudades' }, ...ciudades.map((c) => ({ id: c, label: c }))]}
              value={ciudad ?? CIUDAD_TODAS}
              onChange={(v) => onCiudadChange(v === CIUDAD_TODAS ? null : v)}
            />
          )}

          {estadosRepublica.length > 0 && (
            <Dropdown
              label="Estado"
              options={[{ id: ESTADO_TODOS, label: 'Todos los estados' }, ...estadosRepublica.map((e) => ({ id: e, label: e }))]}
              value={estadoRepublica ?? ESTADO_TODOS}
              onChange={(v) => onEstadoRepublicaChange(v === ESTADO_TODOS ? null : v)}
            />
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

// Selector desplegable en vez de una fila de chips con scroll horizontal —
// con 55+ ciudades reales en el catálogo, esa fila se desbordaba y se
// cortaba a la mitad sin dejar claro a qué filtro pertenecía cada chip
// visible (bug reportado por Claudia). Un modal con lista vertical no tiene
// ese problema de corte, y dentro de un mismo filtro las opciones son
// mutuamente excluyentes de por sí (una sola fila seleccionada).
export function Dropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.id === value)?.label ?? label;

  return (
    <>
      <Pressable style={styles.dropdownTrigger} onPress={() => setOpen(true)}>
        <Text style={styles.dropdownTriggerLabel}>{label}</Text>
        <Text style={styles.dropdownTriggerValue} numberOfLines={1}>
          {selectedLabel} ▾
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView style={styles.modalScroll}>
              {options.map((opt) => {
                const selected = opt.id === value;
                return (
                  <Pressable
                    key={opt.id}
                    style={styles.modalOption}
                    onPress={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.modalOptionLabel, selected && styles.modalOptionLabelSelected]}>
                      {opt.label}
                    </Text>
                    {selected && <Text style={styles.modalOptionCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dropdownTriggerLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  dropdownTriggerValue: {
    ...type.label,
    color: colors.textPrimary,
    flexShrink: 1,
    marginLeft: spacing.sm,
    textAlign: 'right',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.md,
    maxHeight: '70%',
  },
  modalTitle: {
    ...type.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionLabel: {
    ...type.body,
    color: colors.textPrimary,
  },
  modalOptionLabelSelected: {
    color: colors.accentPrimary,
  },
  modalOptionCheck: {
    ...type.body,
    color: colors.accentPrimary,
  },
});
