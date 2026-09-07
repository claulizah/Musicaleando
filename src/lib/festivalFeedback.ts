// Quick tags for "¿Qué le cambiarías?" on a festival's line-up — kept as a
// small fixed set (not a DB enum) so adding/renaming one doesn't need a migration.
export type FeedbackTag = {
  id: string;
  label: string;
};

export const FEEDBACK_TAGS: FeedbackTag[] = [
  { id: 'mas_urbano', label: 'Más urbano' },
  { id: 'headliner_internacional', label: 'Headliner internacional' },
  { id: 'mas_locales', label: 'Más locales' },
];
