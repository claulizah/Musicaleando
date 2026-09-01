// Font families are registered in App.tsx via useFonts (@expo-google-fonts/*).
// Sora -> UI text. Unbounded -> headings + the archetype reveal moment.
export const fontFamily = {
  bodyRegular: 'Sora_400Regular',
  bodyMedium: 'Sora_500Medium',
  bodySemiBold: 'Sora_600SemiBold',
  bodyBold: 'Sora_700Bold',
  headingSemiBold: 'Unbounded_600SemiBold',
  headingBold: 'Unbounded_700Bold',
  headingExtraBold: 'Unbounded_800ExtraBold',
} as const;

import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';
import {
  Unbounded_600SemiBold,
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
} from '@expo-google-fonts/unbounded';

export const fontsToLoad = {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Unbounded_600SemiBold,
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
};

export const type = {
  display: { fontFamily: fontFamily.headingExtraBold, fontSize: 34, lineHeight: 40 },
  h1: { fontFamily: fontFamily.headingBold, fontSize: 26, lineHeight: 32 },
  h2: { fontFamily: fontFamily.headingSemiBold, fontSize: 20, lineHeight: 26 },
  bodyLg: { fontFamily: fontFamily.bodyMedium, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fontFamily.bodyRegular, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.bodyRegular, fontSize: 12, lineHeight: 16 },
} as const;
