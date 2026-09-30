import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AppProvider } from '@/lib/AppContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { AuthScreen } from '@/screens/AuthScreen';
import { Onboarding } from '@/screens/Onboarding';
import { HomeScreen } from '@/screens/HomeScreen';
import { ResearchList } from '@/screens/ResearchList';
import { CreateResearch } from '@/screens/CreateResearch';
import { ResearchWorkspace } from '@/screens/ResearchWorkspace';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { AssistantScreen } from '@/screens/AssistantScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { BottomNav, type Tab } from '@/components/BottomNav';
import { LoadingScreen } from '@/components/ui';
import type { ResearchProject } from '@/types';

type Screen =
  | { name: 'main'; tab: Tab }
  | { name: 'create' }
  | { name: 'workspace'; project: ResearchProject };

function AppContent() {
  const { user, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('rn-onboarded') === 'true';
  });
  const [screen, setScreen] = useState<Screen>({ name: 'main', tab: 'home' });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!onboarded) {
    return (
      <Onboarding
        onFinish={() => {
          localStorage.setItem('rn-onboarded', 'true');
          setOnboarded(true);
        }}
      />
    );
  }

  const handleNewResearch = () => setScreen({ name: 'create' });
  const handleOpenProject = (project: ResearchProject) => setScreen({ name: 'workspace', project });
  const handleBack = () => setScreen({ name: 'main', tab: 'research' });
  const handleNavigate = (tab: Tab) => setScreen({ name: 'main', tab });
  const handleTabChange = (tab: Tab) => setScreen({ name: 'main', tab });

  if (screen.name === 'create') {
    return (
      <CreateResearch
        onCreated={(project) => {
          setScreen({ name: 'workspace', project });
        }}
        onCancel={handleBack}
      />
    );
  }

  if (screen.name === 'workspace') {
    return <ResearchWorkspace project={screen.project} onBack={handleBack} />;
  }

  // Main screens with bottom nav
  return (
    <>
      {screen.tab === 'home' && (
        <HomeScreen
          onNewResearch={handleNewResearch}
          onOpenProject={handleOpenProject}
          onNavigate={handleNavigate}
        />
      )}
      {screen.tab === 'research' && (
        <ResearchList onNewResearch={handleNewResearch} onOpenProject={handleOpenProject} />
      )}
      {screen.tab === 'discover' && <DiscoverScreen />}
      {screen.tab === 'assistant' && <AssistantScreen />}
      {screen.tab === 'account' && <SettingsScreen />}
      <BottomNav active={screen.tab} onChange={handleTabChange} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
