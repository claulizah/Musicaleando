import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EnergySlider } from '../../../components/EnergySlider';
import { QuestionHeader } from '../../../components/QuestionHeader';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useQuizStore } from '../../../store/useQuizStore';

export function Step3Energia({ onAdvance }: { onAdvance: () => void }) {
  const answers = useQuizStore((s) => s.answers);
  const setEnergia = useQuizStore((s) => s.setEnergia);
  const [localValue, setLocalValue] = useState(answers.energia ?? 0.5);

  return (
    <View style={styles.container}>
      <QuestionHeader title="¿Con qué energía llegas al festival?" />
      <View style={styles.sliderWrap}>
        <EnergySlider
          value={localValue}
          onChange={(v) => {
            setLocalValue(v);
            setEnergia(v);
          }}
        />
      </View>
      <PrimaryButton
        label="Continuar"
        onPress={() => {
          setEnergia(localValue);
          onAdvance();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sliderWrap: { flex: 1, justifyContent: 'center' },
});
