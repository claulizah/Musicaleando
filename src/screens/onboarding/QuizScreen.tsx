import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { QuizProgressBar } from '../../components/QuizProgressBar';
import { QuizCardStack } from '../../components/QuizCardStack';
import { RootStackParamList } from '../../navigation/types';
import { QUIZ_STEP_COUNT, useQuizStore } from '../../store/useQuizStore';
import { colors, spacing, type } from '../../theme';
import { Step1DuelVisual } from './quizSteps/Step1DuelVisual';
import { Step2Generos } from './quizSteps/Step2Generos';
import { Step3Energia } from './quizSteps/Step3Energia';
import { Step4Era } from './quizSteps/Step4Era';
import { Step5Guilty } from './quizSteps/Step5Guilty';
import { Step6LetraBeat } from './quizSteps/Step6LetraBeat';
import { Step7Discovery } from './quizSteps/Step7Discovery';
import { Step8Concierto } from './quizSteps/Step8Concierto';
import { Step9Social } from './quizSteps/Step9Social';
import { Step10DuelFinal } from './quizSteps/Step10DuelFinal';

type Props = NativeStackScreenProps<RootStackParamList, 'Quiz'>;

export function QuizScreen({ navigation }: Props) {
  const stepIndex = useQuizStore((s) => s.stepIndex);
  const next = useQuizStore((s) => s.next);
  const back = useQuizStore((s) => s.back);
  const [direction, setDirection] = useState<1 | -1>(1);

  const goBack = () => {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    setDirection(-1);
    back();
  };

  const advance = () => {
    setDirection(1);
    if (stepIndex === QUIZ_STEP_COUNT - 1) {
      navigation.replace('Reveal');
      return;
    }
    next();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={goBack}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.progressWrap}>
          <QuizProgressBar count={QUIZ_STEP_COUNT} activeIndex={stepIndex} />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <QuizCardStack
        stepKey={stepIndex}
        direction={direction}
        onSwipeBack={goBack}
        canSwipeBack={stepIndex > 0}
      >
        {renderStep(stepIndex, advance)}
      </QuizCardStack>
    </Screen>
  );
}

function renderStep(stepIndex: number, onAdvance: () => void) {
  switch (stepIndex) {
    case 0:
      return <Step1DuelVisual onAdvance={onAdvance} />;
    case 1:
      return <Step2Generos onAdvance={onAdvance} />;
    case 2:
      return <Step3Energia onAdvance={onAdvance} />;
    case 3:
      return <Step4Era onAdvance={onAdvance} />;
    case 4:
      return <Step5Guilty onAdvance={onAdvance} />;
    case 5:
      return <Step6LetraBeat onAdvance={onAdvance} />;
    case 6:
      return <Step7Discovery onAdvance={onAdvance} />;
    case 7:
      return <Step8Concierto onAdvance={onAdvance} />;
    case 8:
      return <Step9Social onAdvance={onAdvance} />;
    case 9:
    default:
      return <Step10DuelFinal onAdvance={onAdvance} />;
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  back: {
    ...type.h1,
    color: colors.textPrimary,
    width: 24,
  },
  progressWrap: {
    flex: 1,
  },
  headerSpacer: {
    width: 24,
  },
});
