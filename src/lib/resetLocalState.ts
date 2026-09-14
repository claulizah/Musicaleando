import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSessionStore } from '../store/useSessionStore';
import { useProfileStore } from '../store/useProfileStore';
import { useQuizStore } from '../store/useQuizStore';
import { useAchievementsStore } from '../store/useAchievementsStore';
import { levelForFestivalCount } from './levels';

const QUIZ_DRAFT_STORAGE_KEY = 'musicaleando.quiz-draft';

// Clears everything App.tsx's routing/readiness logic reads (session,
// profile, quiz draft, achievements) after sign-out or account deletion, so
// the next screen render reflects a genuinely fresh identity instead of the
// previous user's data for a frame. Screen-local stores (squads, contacts,
// mood, recap, ...) aren't touched here — they fetch fresh by userId on
// mount and are never read before that fetch completes, so leaving their
// last-fetched data in memory until then is harmless.
export async function resetLocalState(): Promise<void> {
  useProfileStore.setState({ profile: null, status: 'idle', error: null });
  useAchievementsStore.setState({
    badges: [],
    festivalesConfirmados: 0,
    level: levelForFestivalCount(0),
    status: 'idle',
    error: null,
  });
  useQuizStore.getState().resetDraft();
  await AsyncStorage.removeItem(QUIZ_DRAFT_STORAGE_KEY);

  useSessionStore.setState({ userId: null, status: 'idle', error: null });
  await useSessionStore.getState().init();
}
