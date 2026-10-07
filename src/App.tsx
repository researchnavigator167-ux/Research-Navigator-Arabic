import { useState, useEffect, useRef } from 'react';
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
import { ClassroomScreen } from '@/screens/ClassroomScreen';
import { BottomNav, type Tab } from '@/components/BottomNav';
import { LoadingScreen } from '@/components/ui';
import { initNativePlugins, setupBackButton } from '@/lib/native';
import type { ResearchProject, ClassRoom } from '@/types';

type Screen =
  | { name: 'main'; tab: Tab }
  | { name: 'create' }
  | { name: 'workspace'; project: ResearchProject }
  | { name: 'classDetail'; classRoom: ClassRoom }
  | { name: 'assignmentDetail'; assignmentId: string; classId: string };

function AppContent() {
  const { user, loading, roleLoading, role } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('rn-onboarded') === 'true';
  });
  const [screen, setScreen] = useState<Screen>({ name: 'main', tab: 'home' });
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    initNativePlugins();
  }, []);

  useEffect(() => {
    const handleBack = () => {
      const current = screenRef.current;
      if (current.name === 'workspace') {
        setScreen({ name: 'main', tab: 'research' });
      } else if (current.name === 'create') {
        setScreen({ name: 'main', tab: 'research' });
      } else if (current.name === 'classDetail') {
        setScreen({ name: 'main', tab: 'classroom' });
      } else if (current.name === 'assignmentDetail') {
        setScreen({ name: 'main', tab: 'classroom' });
      } else if (current.name === 'main' && current.tab !== 'home') {
        setScreen({ name: 'main', tab: 'home' });
      }
    };

    const canGoBack =
      screen.name === 'workspace' ||
      screen.name === 'create' ||
      screen.name === 'classDetail' ||
      screen.name === 'assignmentDetail' ||
      (screen.name === 'main' && screen.tab !== 'home');

    const listenerPromise = setupBackButton(handleBack, canGoBack);

    return () => {
      listenerPromise?.then((listener) => listener?.remove());
    };
  }, [screen]);

  if (loading || roleLoading) {
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

  const handleOpenClass = (classRoom: ClassRoom) => setScreen({ name: 'classDetail', classRoom });
  const handleOpenAssignment = (assignmentId: string, classId: string) =>
    setScreen({ name: 'assignmentDetail', assignmentId, classId });
  const handleClassBack = () => setScreen({ name: 'main', tab: 'classroom' });

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

  if (screen.name === 'classDetail') {
    return (
      <ClassDetailScreen
        classRoom={screen.classRoom}
        onBack={handleClassBack}
        onOpenAssignment={(assignmentId) => handleOpenAssignment(assignmentId, screen.classRoom.id)}
      />
    );
  }

  if (screen.name === 'assignmentDetail') {
    return (
      <AssignmentDetailScreen
        assignmentId={screen.assignmentId}
        classId={screen.classId}
        onBack={handleClassBack}
      />
    );
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
      {screen.tab === 'classroom' && (
        <ClassroomScreen
          role={role}
          onOpenClass={handleOpenClass}
        />
      )}
      {screen.tab === 'account' && <SettingsScreen />}
      <BottomNav active={screen.tab} onChange={handleTabChange} />
    </>
  );
}

// Inline imports for new screens to avoid circular dependency issues
import { ClassDetailScreen } from '@/screens/ClassDetailScreen';
import { AssignmentDetailScreen } from '@/screens/AssignmentDetailScreen';

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
