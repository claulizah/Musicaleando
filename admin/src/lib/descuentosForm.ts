// Mismos valores que TIPOS_DESCUENTO en descuentos.ts (no se importa: las
// pruebas corren con node, que exige extensión en los imports relativos).
const TIPOS_DESCUENTO = ['2x1', 'porcentaje', 'precio_especial', 'otro'];

export type DescuentoInput = {
  tipo: string;
  detalle: string;
  vigenteHasta: string;
  preventaInicio: string;
  preventaFin: string;
  preventaDetalle: string;
};

export type DescuentoValues = {
  tipo_descuento: string | null;
  descuento_detalle: string | null;
  descuento_vigente_hasta: string | null;
  preventa_inicio: string | null;
  preventa_fin: string | null;
  preventa_detalle: string | null;
};

const MAX_TEXT = 200;
const isDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// Valida lo que el admin captura y lo deja listo para guardar. Reglas:
//  - Sin tipo de descuento se borra todo el bloque de descuento (así se
//    "apaga" un descuento sin tener que vaciar cada campo).
//  - Con tipo, el detalle es obligatorio: es lo que dice banco/tarjeta y
//    condiciones (la app no muestra un "2x1" pelón que no se sabe a quién aplica).
//  - Preventa: necesita fecha de inicio o detalle; el fin no puede ser antes
//    del inicio.
export function validateDescuento(input: DescuentoInput): { values: DescuentoValues } | { error: string } {
  const tipo = input.tipo.trim();
  const detalle = input.detalle.trim();
  const vigente = input.vigenteHasta.trim();
  const pInicio = input.preventaInicio.trim();
  const pFin = input.preventaFin.trim();
  const pDetalle = input.preventaDetalle.trim();

  if (tipo && !TIPOS_DESCUENTO.includes(tipo)) return { error: 'Tipo de descuento inválido.' };
  if (tipo && !detalle) {
    return { error: 'Escribe el detalle del descuento (banco o tarjeta, condiciones): sin eso no se sabe a quién aplica.' };
  }
  if (detalle.length > MAX_TEXT || pDetalle.length > MAX_TEXT) return { error: `Los textos no pueden pasar de ${MAX_TEXT} caracteres.` };
  if (vigente && !isDate(vigente)) return { error: 'La vigencia del descuento no es una fecha válida.' };
  if ((pInicio && !isDate(pInicio)) || (pFin && !isDate(pFin))) return { error: 'Las fechas de la preventa no son válidas.' };
  const hayPreventa = Boolean(pInicio || pFin || pDetalle);
  if (hayPreventa && !pInicio && !pDetalle) return { error: 'La preventa necesita una fecha de inicio o un detalle.' };
  if (pInicio && pFin && pFin < pInicio) return { error: 'La preventa no puede terminar antes de empezar.' };

  return {
    values: {
      tipo_descuento: tipo || null,
      descuento_detalle: tipo ? detalle : null,
      descuento_vigente_hasta: tipo && vigente ? vigente : null,
      preventa_inicio: pInicio || null,
      preventa_fin: pFin || null,
      preventa_detalle: pDetalle || null,
    },
  };
}
