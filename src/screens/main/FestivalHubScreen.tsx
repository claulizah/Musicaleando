import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/useSessionStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useFestivalStore, FestivalWithIntent } from '../../store/useFestivalStore';
import {
  ContentReportMotivo,
  FestivalReactionType,
  FestivalStatus,
  SurveyCalificacion,
  SurveyVolveria,
} from '../../types/database';
import { FEEDBACK_TAGS } from '../../lib/festivalFeedback';
import { fetchFestivalPersonalization, FestivalGenreMatch } from '../../lib/spotify';
import { GENEROS, ARCHETYPES } from '../../lib/archetypes';
import { promptReportContent } from '../../lib/moderation';
import { useSquadStore } from '../../store/useSquadStore';
import { useEventFilters } from '../../hooks/useEventFilters';
import { EventFilterBar } from '../../components/EventFilterBar';
import { LineupSection } from '../../components/LineupSection';
import { buildTicketUrl } from '../../lib/ticketLinks';
import { trackTicketClick } from '../../lib/trackTicketClick';
import { useAppConfigStore } from '../../store/useAppConfigStore';
import { dateBucketFor, DATE_BUCKET_LABEL, DATE_BUCKET_ORDER } from '../../lib/dateBuckets';
import { colors, radii, spacing, type } from '../../theme';
import { WhatsNewCard } from '../../components/WhatsNewCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Festivals'>;

const TIPO_BADGE: Record<string, string> = {
  festival: '🎪 Festival',
  concierto: '🎤 Concierto',
};

const STATUS_OPTIONS: { id: FestivalStatus; label: string }[] = [
  { id: 'voy', label: 'Voy' },
  { id: 'tal_vez', label: 'Tal vez' },
  { id: 'no_voy', label: 'No voy' },
];

const CALIFICACION_OPTIONS: { id: SurveyCalificacion; label: string; emoji: string }[] = [
  { id: 'genial', label: 'Genial', emoji: '🤩' },
  { id: 'bien', label: 'Bien', emoji: '🙂' },
  { id: 'regular', label: 'Regular', emoji: '😐' },
  { id: 'malo', label: 'Malo', emoji: '😞' },
];

const VOLVERIA_OPTIONS: { id: SurveyVolveria; label: string }[] = [
  { id: 'si', label: 'Sí' },
  { id: 'tal_vez', label: 'Tal vez' },
  { id: 'no', label: 'No' },
];

function formatRange(inicio: string, fin: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return inicio === fin ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fin)}`;
}

export function FestivalHubScreen({ navigation, route }: Props) {
  const highlightFestivalId = route.params?.highlightFestivalId;
  const userId = useSessionStore((s) => s.userId);
  const generos = useProfileStore((s) => (s.profile?.generos as string[] | undefined) ?? []);
  const festivals = useFestivalStore((s) => s.festivals);
  const status = useFestivalStore((s) => s.status);
  const error = useFestivalStore((s) => s.error);
  const fetchFestivals = useFestivalStore((s) => s.fetch);
  const setFestivalStatus = useFestivalStore((s) => s.setStatus);
  const setReaction = useFestivalStore((s) => s.setReaction);
  const submitFeedback = useFestivalStore((s) => s.submitFeedback);
  const postComment = useFestivalStore((s) => s.postComment);
  const deleteComment = useFestivalStore((s) => s.deleteComment);
  const toggleInterest = useFestivalStore((s) => s.toggleInterest);
  const submitSurvey = useFestivalStore((s) => s.submitSurvey);
  const reportComment = useFestivalStore((s) => s.reportComment);
  const squads = useSquadStore((s) => s.squads);
  const fetchMySquads = useSquadStore((s) => s.fetchMySquads);
  const filters = useEventFilters(festivals, generos);

  useEffect(() => {
    if (userId) fetchFestivals(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (userId) fetchMySquads(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    useAppConfigStore.getState().load();
  }, []);

  // "Mapa social": squadmates' arquetipo, resolved from squads already
  // loaded via squad_members_with_profile — no new query for this screen.
  const squadmateArchetypeById = new Map(
    squads.flatMap((s) => s.members).map((m) => [m.user_id, m.arquetipo]),
  );

  const filteredFestivals = filters.filtered;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Conciertos y festivales</Text>
          <View style={styles.headerSpacer} />
        </View>
        <WhatsNewCard screen="Festivals" />

        <EventFilterBar
          query={filters.query}
          onQueryChange={filters.setQuery}
          ciudad={filters.ciudad}
          onCiudadChange={filters.setCiudad}
          ciudades={filters.ciudades}
          dateFilter={filters.dateFilter}
          onDateFilterChange={filters.setDateFilter}
          tipoFilter={filters.tipoFilter}
          onTipoFilterChange={filters.setTipoFilter}
          soloMisGeneros={filters.soloMisGeneros}
          onToggleSoloMisGeneros={filters.toggleSoloMisGeneros}
          generoLoading={filters.generoLoading}
          showGeneroFilter={generos.length > 0}
        />

        {status === 'loading' && festivals.length === 0 && (
          <Text style={styles.hint}>Cargando eventos...</Text>
        )}
        {status === 'ready' && festivals.length === 0 && (
          <Text style={styles.hint}>Todavía no hay eventos cargados.</Text>
        )}
        {status === 'ready' && festivals.length > 0 && filteredFestivals.length === 0 && (
          <Text style={styles.hint}>No hay eventos de este tipo todavía.</Text>
        )}
        {status === 'error' && (
          <Text style={styles.errorHint}>
            No se pudieron cargar los eventos{error ? `: ${error}` : '.'}
          </Text>
        )}

        {(() => {
          const renderCard = (entry: FestivalWithIntent) => (
            <FestivalCard
              key={entry.festival.id}
              entry={entry}
              navigation={navigation}
              highlighted={entry.festival.id === highlightFestivalId}
              onSetStatus={(s) => userId && setFestivalStatus(userId, entry.festival.id, s)}
              onSetReaction={(r) => userId && setReaction(userId, entry.festival.id, r)}
              onSubmitFeedback={(tags, comentario) =>
                userId ? submitFeedback(userId, entry.festival.id, tags, comentario) : Promise.resolve()
              }
              userId={userId}
              onPostComment={(texto) =>
                userId ? postComment(userId, entry.festival.id, texto) : Promise.resolve()
              }
              onDeleteComment={(commentId) => deleteComment(entry.festival.id, commentId)}
              onReportComment={(commentId, motivo) =>
                userId ? reportComment(userId, commentId, motivo) : Promise.resolve()
              }
              onToggleInterest={(announcementId) =>
                userId ? toggleInterest(userId, entry.festival.id, announcementId) : Promise.resolve()
              }
              onSubmitSurvey={(calificacion, volveria) =>
                userId ? submitSurvey(userId, entry.festival.id, calificacion, volveria) : Promise.resolve()
              }
              generos={generos}
              squadmateArchetypeById={squadmateArchetypeById}
            />
          );

          // Secciones por fecha (Esta semana / Este mes / Próximamente) para
          // que el catálogo completo no se sienta como una sola tira
          // interminable — solo cuando no hay ya un filtro de fecha
          // explícito activo (ahí seccionar de nuevo sería redundante,
          // ej. filtrar "Próximos 7 días" y luego ver un solo encabezado
          // "Esta semana" no aporta nada).
          if (filters.dateFilter !== 'todos') {
            return filteredFestivals.map(renderCard);
          }

          const buckets = new Map<string, FestivalWithIntent[]>();
          for (const entry of filteredFestivals) {
            const key = dateBucketFor(entry.festival.fecha_inicio);
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key)!.push(entry);
          }

          return DATE_BUCKET_ORDER.filter((b) => buckets.has(b)).map((bucket) => (
            <View key={bucket} style={styles.sectionWrap}>
              <Text style={styles.sectionHeader}>{DATE_BUCKET_LABEL[bucket]}</Text>
              {buckets.get(bucket)!.map(renderCard)}
            </View>
          ));
        })()}
      </ScrollView>
    </Screen>
  );
}

function FestivalCard({
  entry,
  navigation,
  highlighted,
  onSetStatus,
  onSetReaction,
  onSubmitFeedback,
  userId,
  onPostComment,
  onDeleteComment,
  onReportComment,
  onToggleInterest,
  onSubmitSurvey,
  generos,
  squadmateArchetypeById,
}: {
  entry: FestivalWithIntent;
  navigation: Props['navigation'];
  highlighted: boolean;
  onSetStatus: (status: FestivalStatus) => void;
  onSetReaction: (reaction: FestivalReactionType) => void;
  onSubmitFeedback: (tags: string[], comentario: string | null) => Promise<void>;
  userId: string | null;
  onPostComment: (texto: string) => Promise<void>;
  onDeleteComment: (commentId: string) => void;
  onReportComment: (commentId: string, motivo: ContentReportMotivo) => Promise<void>;
  onToggleInterest: (announcementId: string) => Promise<void>;
  onSubmitSurvey: (calificacion: SurveyCalificacion, volveria: SurveyVolveria) => Promise<void>;
  generos: string[];
  squadmateArchetypeById: Map<string, string | null>;
}) {
  const {
    festival,
    myStatus,
    squadGoingCount,
    squadGoingIds,
    lineup,
    reactions,
    feedback,
    comments,
    announcements,
    mapPins,
    survey,
  } = entry;
  const [showSquadGoing, setShowSquadGoing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedEscenario, setSelectedEscenario] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(feedback.mine?.tags ?? []);
  const [comentario, setComentario] = useState(feedback.mine?.comentario ?? '');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [personalized, setPersonalized] = useState<FestivalGenreMatch[] | null>(null);
  const [loadingPersonalized, setLoadingPersonalized] = useState(false);
  const [surveyCalificacion, setSurveyCalificacion] = useState<SurveyCalificacion | null>(null);
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [expanded, setExpanded] = useState(highlighted);

  const handlePersonalize = async () => {
    if (generos.length === 0 || lineup.length === 0) return;
    setLoadingPersonalized(true);
    try {
      const { matches } = await fetchFestivalPersonalization(
        generos,
        lineup.map((l) => l.artista),
      );
      setPersonalized(matches);
    } catch (err) {
      Alert.alert('No se pudo generar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setLoadingPersonalized(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  };

  const handleSubmitFeedback = async () => {
    setSavingFeedback(true);
    try {
      await onSubmitFeedback(selectedTags, comentario.trim() || null);
      setShowFeedback(false);
    } catch (err) {
      Alert.alert('No se pudo enviar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setSavingFeedback(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentDraft.trim()) return;
    setPostingComment(true);
    try {
      await onPostComment(commentDraft);
      setCommentDraft('');
    } catch (err) {
      Alert.alert('No se pudo comentar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setPostingComment(false);
    }
  };

  const handleSurveyVolveria = async (volveria: SurveyVolveria) => {
    if (!surveyCalificacion) return;
    setSavingSurvey(true);
    try {
      await onSubmitSurvey(surveyCalificacion, volveria);
    } catch (err) {
      Alert.alert('No se pudo enviar', err instanceof Error ? err.message : 'Intenta de nuevo.');
    } finally {
      setSavingSurvey(false);
    }
  };

  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.nombre}>{festival.nombre}</Text>
        <Text style={styles.tipoBadge}>{TIPO_BADGE[festival.tipo] ?? '🎪 Festival'}</Text>
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {festival.ciudad} · {formatRange(festival.fecha_inicio, festival.fecha_fin)}
      </Text>

      {/* Colapsada por default (solo nombre/tipo/ciudad-fecha, una línea) —
          antes esto mostraba siempre el aviso de squad, los 3 botones de
          asistencia y "Comprar boletos" para CADA evento de la lista, lo
          que hacía que una lista de decenas de eventos fuera puro scroll.
          Se reusa el mismo toggle expanded/"Ver más" que ya existía para
          el line-up/mapa/comentarios, en vez de construir un mecanismo
          aparte. */}
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.expandToggle}>{expanded ? '▴ Ver menos' : '▾ Ver más'}</Text>
      </Pressable>

      {expanded && (
        <>
      {squadGoingCount > 0 && (
        <Text style={styles.squadHint}>
          👥 {squadGoingCount} {squadGoingCount === 1 ? 'de tu squad va' : 'de tu squad van'}
        </Text>
      )}

      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((option) => {
          const selected = myStatus === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.statusPill, selected && styles.statusPillSelected]}
              onPress={() => onSetStatus(option.id)}
            >
              <Text style={[styles.statusPillText, selected && styles.statusPillTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {festival.link_boletos && (
        <Pressable
          style={styles.ticketsButton}
          onPress={() => {
            const link = buildTicketUrl(festival.link_boletos!, useAppConfigStore.getState().affiliateTemplate);
            trackTicketClick(festival.id, userId, link.plataforma, link.afiliado);
            Linking.openURL(link.url);
          }}
        >
          <Text style={styles.ticketsButtonText}>Comprar boletos ↗</Text>
        </Pressable>
      )}

      {squadGoingCount > 0 && (
        <View>
          <Pressable onPress={() => setShowSquadGoing((v) => !v)}>
            <Text style={styles.squadHint}>
              Detalle del squad {showSquadGoing ? '▾' : '▸'}
            </Text>
          </Pressable>
          {showSquadGoing && (
            <View style={styles.squadGoingList}>
              {squadGoingIds.map((id) => {
                const arquetipoId = squadmateArchetypeById.get(id);
                const archetype = arquetipoId ? ARCHETYPES[arquetipoId as keyof typeof ARCHETYPES] : undefined;
                return (
                  <Text key={id} style={styles.squadGoingRow}>
                    {archetype ? `${archetype.emoji} ${archetype.label}` : '🎧 Squadmate'}
                  </Text>
                );
              })}
            </View>
          )}
        </View>
      )}

      <LineupSection
        lineup={lineup}
        fechaInicio={festival.fecha_inicio}
        fechaFin={festival.fecha_fin}
        initiallyOpen={highlighted}
        onArtistPress={(artist) =>
          artist.artist_id &&
          navigation.navigate('ArtistDetail', { artistId: artist.artist_id, artistName: artist.artista })
        }
      />

      {festival.mapa_url && (
        <View>
          <Pressable onPress={() => setShowMap((v) => !v)}>
            <Text style={styles.lineupToggle}>{showMap ? '▾' : '▸'} Mapa del festival</Text>
          </Pressable>
          {showMap && (
            <View style={styles.mapWrap}>
              <Image source={{ uri: festival.mapa_url }} style={styles.mapImage} resizeMode="contain" />
              {mapPins.map((pin) => (
                <Pressable
                  key={pin.id}
                  style={[
                    styles.mapPin,
                    { left: `${pin.x_pct}%` as const, top: `${pin.y_pct}%` as const },
                  ]}
                  onPress={() => setSelectedEscenario(pin.escenario)}
                >
                  <Text style={styles.mapPinText}>📍</Text>
                </Pressable>
              ))}
            </View>
          )}
          {showMap && selectedEscenario && (
            <View style={styles.stageCard}>
              <Text style={styles.stageTitle}>{selectedEscenario}</Text>
              {lineup
                .filter((l) => l.escenario === selectedEscenario)
                .map((l) => (
                  <Pressable
                    key={l.id}
                    disabled={!l.artist_id}
                    onPress={() =>
                      l.artist_id && navigation.navigate('ArtistDetail', { artistId: l.artist_id, artistName: l.artista })
                    }
                  >
                    <Text style={styles.lineupArtistName}>{l.artista}</Text>
                  </Pressable>
                ))}
              {lineup.filter((l) => l.escenario === selectedEscenario).length === 0 && (
                <Text style={styles.hint}>No hay artistas cargados para este escenario.</Text>
              )}
            </View>
          )}
        </View>
      )}

      {lineup.length > 0 && generos.length > 0 && (
        <View style={styles.personalizeWrap}>
          {personalized === null ? (
            <Pressable
              style={styles.personalizeButton}
              onPress={handlePersonalize}
              disabled={loadingPersonalized}
            >
              <Text style={styles.personalizeButtonText}>
                {loadingPersonalized ? 'Buscando en tu gusto...' : '✨ Tu festival, a tu medida'}
              </Text>
            </Pressable>
          ) : personalized.length === 0 ? (
            <Text style={styles.hint}>No encontramos coincidencias claras con tu gusto esta vez.</Text>
          ) : (
            <View style={styles.personalizeCard}>
              <Text style={styles.personalizeTitle}>No te lo pierdas</Text>
              {personalized.map((m) => {
                const genero = GENEROS.find((g) => g.id === m.generoId);
                return (
                  <Text key={m.artista} style={styles.personalizeRow}>
                    🎯 {m.artista}{genero ? ` · ${genero.label}` : ''}
                  </Text>
                );
              })}
            </View>
          )}
        </View>
      )}

      {survey.due && (
        <View style={styles.surveyCard}>
          <Text style={styles.surveyTitle}>¿Qué tal estuvo {festival.nombre}?</Text>
          {!surveyCalificacion ? (
            <View style={styles.surveyRow}>
              {CALIFICACION_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={styles.surveyOption}
                  onPress={() => setSurveyCalificacion(option.id)}
                >
                  <Text style={styles.surveyEmoji}>{option.emoji}</Text>
                  <Text style={styles.surveyOptionLabel}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <Text style={styles.surveyQuestion}>¿Volverías el próximo año?</Text>
              <View style={styles.surveyRow}>
                {VOLVERIA_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    style={[styles.surveyOption, savingSurvey && styles.confirmButtonDisabled]}
                    disabled={savingSurvey}
                    onPress={() => handleSurveyVolveria(option.id)}
                  >
                    <Text style={styles.surveyOptionLabel}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {announcements.length > 0 && (
        <View style={styles.announcementsWrap}>
          {announcements.map((a) => (
            <View key={a.id} style={styles.announcementCard}>
              <View style={styles.announcementHeader}>
                <Text style={styles.announcementBadge}>
                  {a.tipo === 'rifa' ? '🎟️ Rifa' : a.tipo === 'descuento' ? '💸 Descuento' : '📣 Anuncio'}
                </Text>
                {a.sponsor_nombre && <Text style={styles.announcementSponsor}>{a.sponsor_nombre}</Text>}
              </View>
              <Text style={styles.announcementTitle}>{a.titulo}</Text>
              {a.descripcion && <Text style={styles.announcementDesc}>{a.descripcion}</Text>}
              {a.tipo === 'descuento' && a.codigo_descuento && (
                <Text style={styles.announcementCode}>Código: {a.codigo_descuento}</Text>
              )}
              {a.tipo === 'rifa' && a.ganador_nombre && (
                <Text style={styles.raffleWinner}>
                  {a.ganador_user_id === userId
                    ? '🎉 ¡Ganaste esta rifa!'
                    : `🎉 Ganador: ${a.ganador_nombre}`}
                </Text>
              )}
              <Pressable
                style={[styles.interestButton, a.mineInterested && styles.interestButtonActive]}
                onPress={() => onToggleInterest(a.id)}
              >
                <Text
                  style={[styles.interestButtonText, a.mineInterested && styles.interestButtonTextActive]}
                >
                  {a.mineInterested ? '★ Me interesa' : '☆ Me interesa'} ({a.interestCount})
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.reactionRow}>
        <Pressable
          style={[styles.reactionButton, reactions.mine === 'like' && styles.reactionButtonActive]}
          onPress={() => onSetReaction('like')}
        >
          <Text style={styles.reactionButtonText}>👍 {reactions.likes}</Text>
        </Pressable>
        <Pressable
          style={[styles.reactionButton, reactions.mine === 'dislike' && styles.reactionButtonActive]}
          onPress={() => onSetReaction('dislike')}
        >
          <Text style={styles.reactionButtonText}>👎 {reactions.dislikes}</Text>
        </Pressable>
        <Pressable style={styles.feedbackToggle} onPress={() => setShowFeedback((v) => !v)}>
          <Text style={styles.feedbackToggleText}>
            {feedback.mine ? '✎ Tu feedback' : '¿Qué le cambiarías?'}
          </Text>
        </Pressable>
      </View>

      {showFeedback && (
        <View style={styles.feedbackCard}>
          <View style={styles.tagWrap}>
            {FEEDBACK_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  style={[styles.tagChip, selected && styles.tagChipSelected]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                    {tag.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.commentInput}
            placeholder="Comentario libre (opcional)"
            placeholderTextColor={colors.textMuted}
            value={comentario}
            onChangeText={setComentario}
            multiline
          />
          <Pressable
            style={[styles.saveFeedbackButton, savingFeedback && styles.confirmButtonDisabled]}
            disabled={savingFeedback}
            onPress={handleSubmitFeedback}
          >
            <Text style={styles.saveFeedbackButtonText}>
              {savingFeedback ? 'Guardando...' : 'Guardar feedback'}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={() => setShowComments((v) => !v)}>
        <Text style={styles.lineupToggle}>
          {showComments ? '▾' : '▸'} Comentarios ({comments.length})
        </Text>
      </Pressable>

      {showComments && (
        <View style={styles.commentsCard}>
          {comments.length === 0 && <Text style={styles.hint}>Sé el primero en comentar.</Text>}
          {comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <Text style={styles.commentText}>{c.texto}</Text>
              {c.user_id === userId ? (
                <Pressable hitSlop={8} onPress={() => onDeleteComment(c.id)}>
                  <Text style={styles.removeLink}>Borrar</Text>
                </Pressable>
              ) : (
                <Pressable
                  hitSlop={8}
                  onPress={() => promptReportContent((motivo) => onReportComment(c.id, motivo))}
                >
                  <Text style={styles.removeLink}>Reportar</Text>
                </Pressable>
              )}
            </View>
          ))}
          <View style={styles.commentComposeRow}>
            <TextInput
              style={styles.commentComposeInput}
              placeholder="Escribe un comentario..."
              placeholderTextColor={colors.textMuted}
              value={commentDraft}
              onChangeText={setCommentDraft}
            />
            <Pressable
              style={[styles.commentSendButton, postingComment && styles.confirmButtonDisabled]}
              disabled={postingComment}
              onPress={handlePostComment}
            >
              <Text style={styles.commentSendButtonText}>{postingComment ? '...' : 'Enviar'}</Text>
            </Pressable>
          </View>
        </View>
      )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionWrap: {
    gap: spacing.md,
  },
  sectionHeader: {
    ...type.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  back: {
    ...type.h1,
    color: colors.textPrimary,
    width: 32,
  },
  headerTitle: {
    ...type.h2,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 32,
  },
  tipoFilterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tipoFilterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  tipoFilterChipSelected: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  tipoFilterChipText: {
    ...type.label,
    color: colors.textSecondary,
  },
  tipoFilterChipTextSelected: {
    color: colors.onAccent,
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
  },
  errorHint: {
    ...type.body,
    color: colors.danger,
  },
  lineupToggle: {
    ...type.label,
    color: colors.textSecondary,
  },
  lineupArtistName: {
    ...type.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  // Aplicado cuando se llega desde la ficha de artista con un evento
  // puntual en mente ("Festivals" no tiene ruta por evento, así que esto es
  // la señal visual de "es este") — ver ArtistDetailScreen.
  cardHighlighted: {
    borderColor: colors.accentPrimary,
    borderWidth: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nombre: {
    ...type.bodyLg,
    fontFamily: type.h2.fontFamily,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  tipoBadge: {
    ...type.caption,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  meta: {
    ...type.body,
    color: colors.textSecondary,
  },
  squadHint: {
    ...type.label,
    color: colors.accentPrimary,
  },
  expandToggle: {
    ...type.label,
    color: colors.accentSecondary,
    marginTop: spacing.xs,
  },
  squadGoingList: {
    marginTop: spacing.xs,
    gap: 2,
    paddingLeft: spacing.sm,
  },
  squadGoingRow: {
    ...type.body,
    color: colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statusPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statusPillSelected: {
    backgroundColor: colors.accentSecondary,
    borderColor: colors.accentSecondary,
  },
  statusPillText: {
    ...type.label,
    color: colors.textSecondary,
  },
  statusPillTextSelected: {
    color: colors.onAccent,
  },
  ticketsButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
  },
  ticketsButtonText: {
    ...type.label,
    color: colors.accentPrimary,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reactionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionButtonActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimaryMuted,
  },
  reactionButtonText: {
    ...type.label,
    color: colors.textPrimary,
  },
  feedbackToggle: {
    marginLeft: 'auto',
  },
  feedbackToggleText: {
    ...type.label,
    color: colors.accentSecondary,
  },
  feedbackCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  tagChipSelected: {
    borderColor: colors.accentSecondary,
    backgroundColor: colors.accentSecondaryMuted,
  },
  tagChipText: {
    ...type.label,
    color: colors.textSecondary,
  },
  tagChipTextSelected: {
    color: colors.textPrimary,
  },
  commentInput: {
    ...type.body,
    color: colors.textPrimary,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveFeedbackButton: {
    alignItems: 'center',
    backgroundColor: colors.accentSecondary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  saveFeedbackButtonText: {
    ...type.label,
    color: colors.onAccent,
  },
  announcementsWrap: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  announcementCard: {
    backgroundColor: colors.accentSecondaryMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accentSecondary,
    padding: spacing.md,
    gap: spacing.xs,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  announcementBadge: {
    ...type.label,
    color: colors.accentSecondary,
  },
  announcementSponsor: {
    ...type.caption,
    color: colors.textSecondary,
  },
  announcementTitle: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  announcementDesc: {
    ...type.body,
    color: colors.textSecondary,
  },
  announcementCode: {
    ...type.label,
    color: colors.textPrimary,
    fontFamily: type.h2.fontFamily,
  },
  raffleWinner: {
    ...type.bodyLg,
    color: colors.accentPrimary,
  },
  interestButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  interestButtonActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimaryMuted,
  },
  interestButtonText: {
    ...type.label,
    color: colors.textSecondary,
  },
  interestButtonTextActive: {
    color: colors.accentPrimary,
  },
  commentsCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  commentText: {
    ...type.body,
    color: colors.textPrimary,
    flex: 1,
  },
  commentComposeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  commentComposeInput: {
    ...type.body,
    color: colors.textPrimary,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flex: 1,
  },
  commentSendButton: {
    backgroundColor: colors.accentSecondary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  commentSendButtonText: {
    ...type.label,
    color: colors.onAccent,
  },
  removeLink: {
    ...type.caption,
    color: colors.textMuted,
  },
  mapWrap: {
    marginTop: spacing.xs,
    position: 'relative',
    width: '100%',
    height: 220,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPin: {
    position: 'absolute',
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
  mapPinText: {
    fontSize: 22,
  },
  stageCard: {
    marginTop: spacing.xs,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  stageTitle: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  personalizeWrap: {
    marginTop: spacing.xs,
  },
  personalizeButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentSecondary,
  },
  personalizeButtonText: {
    ...type.label,
    color: colors.accentSecondary,
  },
  personalizeCard: {
    backgroundColor: colors.accentPrimaryMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    padding: spacing.md,
    gap: spacing.xs,
  },
  personalizeTitle: {
    ...type.label,
    color: colors.accentPrimary,
  },
  personalizeRow: {
    ...type.body,
    color: colors.textPrimary,
  },
  surveyCard: {
    backgroundColor: colors.accentPrimaryMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    padding: spacing.md,
    gap: spacing.sm,
  },
  surveyTitle: {
    ...type.bodyLg,
    color: colors.textPrimary,
  },
  surveyQuestion: {
    ...type.label,
    color: colors.textSecondary,
  },
  surveyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  surveyOption: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  surveyEmoji: {
    fontSize: 20,
  },
  surveyOptionLabel: {
    ...type.label,
    color: colors.textPrimary,
  },
});
