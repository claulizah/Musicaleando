import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_QUIZ_ANSWERS, QuizAnswers, SocialAxis } from '../lib/archetypes';

export const QUIZ_STEP_COUNT = 10;

type QuizState = {
  stepIndex: number;
  answers: QuizAnswers;
  setDuelVisual: (id: string) => void;
  toggleGenero: (id: string) => void;
  setEnergia: (value: number) => void;
  setEra: (id: string) => void;
  setGuiltyPleasure: (id: string) => void;
  setLetraBeat: (id: string) => void;
  setDiscovery: (id: string) => void;
  setConcierto: (id: string) => void;
  setSocial: (id: SocialAxis) => void;
  setDuelFinal: (id: string) => void;
  goToStep: (index: number) => void;
  next: () => void;
  back: () => void;
  resetDraft: () => void;
  prefillFromProfile: (profile: {
    generoIds: string[];
    energia: number;
    social: SocialAxis;
    eraId?: string;
    guiltyPleasureId?: string;
    concertoId?: string;
  }) => void;
};

export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      stepIndex: 0,
      answers: EMPTY_QUIZ_ANSWERS,
      setDuelVisual: (id) => set((s) => ({ answers: { ...s.answers, duelVisualId: id } })),
      toggleGenero: (id) =>
        set((s) => {
          const has = s.answers.generoIds.includes(id);
          const generoIds = has
            ? s.answers.generoIds.filter((g) => g !== id)
            : s.answers.generoIds.length >= 3
              ? s.answers.generoIds
              : [...s.answers.generoIds, id];
          return { answers: { ...s.answers, generoIds } };
        }),
      setEnergia: (value) => set((s) => ({ answers: { ...s.answers, energia: value } })),
      setEra: (id) => set((s) => ({ answers: { ...s.answers, eraId: id } })),
      setGuiltyPleasure: (id) => set((s) => ({ answers: { ...s.answers, guiltyPleasureId: id } })),
      setLetraBeat: (id) => set((s) => ({ answers: { ...s.answers, letraBeatId: id } })),
      setDiscovery: (id) => set((s) => ({ answers: { ...s.answers, discoveryId: id } })),
      setConcierto: (id) => set((s) => ({ answers: { ...s.answers, concertoId: id } })),
      setSocial: (id) => set((s) => ({ answers: { ...s.answers, socialId: id } })),
      setDuelFinal: (id) => set((s) => ({ answers: { ...s.answers, duelFinalId: id } })),
      goToStep: (index) => set({ stepIndex: Math.max(0, Math.min(QUIZ_STEP_COUNT - 1, index)) }),
      next: () => set((s) => ({ stepIndex: Math.min(QUIZ_STEP_COUNT - 1, s.stepIndex + 1) })),
      back: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
      resetDraft: () => set({ stepIndex: 0, answers: EMPTY_QUIZ_ANSWERS }),
      prefillFromProfile: (profile) =>
        set((s) => ({
          answers: {
            ...s.answers,
            generoIds: profile.generoIds,
            energia: profile.energia,
            socialId: profile.social,
            eraId: profile.eraId ?? s.answers.eraId,
            guiltyPleasureId: profile.guiltyPleasureId ?? s.answers.guiltyPleasureId,
            concertoId: profile.concertoId ?? s.answers.concertoId,
          },
        })),
    }),
    {
      name: 'musicaleando.quiz-draft',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
