import { Alert } from 'react-native';
import { ContentReportMotivo } from '../types/database';

const MOTIVO_LABELS: { id: ContentReportMotivo; label: string }[] = [
  { id: 'spam', label: 'Spam' },
  { id: 'ofensivo', label: 'Ofensivo' },
  { id: 'otro', label: 'Otro' },
];

// Shared "Reportar" action sheet for the two free-text UGC surfaces that
// exist today (festival comments, community share captions) — see
// migration sprint6_moderation for why moderation is scoped to just these.
export function promptReportContent(onReport: (motivo: ContentReportMotivo) => void) {
  Alert.alert(
    'Reportar contenido',
    '¿Por qué quieres reportar esto?',
    [
      ...MOTIVO_LABELS.map((m) => ({ text: m.label, onPress: () => onReport(m.id) })),
      { text: 'Cancelar', style: 'cancel' as const },
    ],
  );
}
