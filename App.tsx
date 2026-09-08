import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplash } from './src/components/AnimatedSplash';
import { SessionErrorScreen } from './src/components/SessionErrorScreen';
import { fontsToLoad, colors } from './src/theme';
import { useSessionStore } from './src/store/useSessionStore';
import { useProfileStore } from './src/store/useProfileStore';
import { useQuizStore } from './src/store/useQuizStore';
import { hasAnyAnswer } from './src/lib/archetypes';
import { RootStackParamList } from './src/navigation/types';

import { WelcomeScreen } from './src/screens/onboarding/WelcomeScreen';
import { QuizScreen } from './src/screens/onboarding/QuizScreen';
import { RevealScreen } from './src/screens/onboarding/RevealScreen';
import { MoodPickScreen } from './src/screens/onboarding/MoodPickScreen';
import { HomeScreen } from './src/screens/main/HomeScreen';
import { ProfileScreen } from './src/screens/main/ProfileScreen';
import { SquadsScreen } from './src/screens/main/SquadsScreen';
import { SquadDetailScreen } from './src/screens/main/SquadDetailScreen';
import { FestivalHubScreen } from './src/screens/main/FestivalHubScreen';
import { TorneoScreen } from './src/screens/main/TorneoScreen';
import { SquadTorneoScreen } from './src/screens/main/SquadTorneoScreen';
import { CommunityTrendsScreen } from './src/screens/main/CommunityTrendsScreen';
import { ConcertAlbumScreen } from './src/screens/main/ConcertAlbumScreen';
import { RecapScreen } from './src/screens/main/RecapScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accentPrimary,
    notification: colors.accentSecondary,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts(fontsToLoad);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  const sessionStatus = useSessionStore((s) => s.status);
  const sessionError = useSessionStore((s) => s.error);
  const userId = useSessionStore((s) => s.userId);
  const initSession = useSessionStore((s) => s.init);

  const profile = useProfileStore((s) => s.profile);
  const profileStatus = useProfileStore((s) => s.status);
  const fetchProfile = useProfileStore((s) => s.fetch);

  const quizAnswers = useQuizStore((s) => s.answers);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (sessionStatus === 'ready' && userId && profileStatus === 'idle') {
      fetchProfile(userId);
    }
  }, [sessionStatus, userId, profileStatus, fetchProfile]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Native splash (app.json) is still visible.
    return null;
  }

  if (sessionStatus === 'error') {
    return <SessionErrorScreen message={sessionError ?? 'Error desconocido.'} onRetry={initSession} />;
  }

  const dataReady =
    sessionStatus === 'ready' && (profileStatus === 'ready' || profileStatus === 'error');
  const appReady = dataReady && minTimeElapsed;

  if (!appReady) {
    return <AnimatedSplash onMinDurationElapsed={() => setMinTimeElapsed(true)} />;
  }

  const initialRouteName: keyof RootStackParamList = profile?.arquetipo
    ? 'Home'
    : hasAnyAnswer(quizAnswers)
      ? 'Quiz'
      : 'Welcome';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
        >
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Quiz" component={QuizScreen} />
          <Stack.Screen name="Reveal" component={RevealScreen} />
          <Stack.Screen name="MoodPick" component={MoodPickScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Squads" component={SquadsScreen} />
          <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
          <Stack.Screen name="Festivals" component={FestivalHubScreen} />
          <Stack.Screen name="Torneo" component={TorneoScreen} />
          <Stack.Screen name="SquadTorneo" component={SquadTorneoScreen} />
          <Stack.Screen name="CommunityTrends" component={CommunityTrendsScreen} />
          <Stack.Screen name="ConcertAlbum" component={ConcertAlbumScreen} />
          <Stack.Screen name="Recap" component={RecapScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
