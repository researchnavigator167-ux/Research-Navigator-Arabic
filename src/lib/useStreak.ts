import { useState, useCallback, useEffect } from 'react';

export interface Achievement {
  id: string;
  unlocked: boolean;
}

const STORAGE_KEY = 'el-professor-streak';
const ACHIEVEMENTS_KEY = 'el-professor-achievements';

function loadStreak(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { count: number; lastActiveDate: string };
    const today = new Date().toISOString().slice(0, 10);
    if (data.lastActiveDate === today) return data.count;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (data.lastActiveDate === yesterday) return data.count;
    return 0;
  } catch {
    return 0;
  }
}

function loadAchievements(): string[] {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function useStreak() {
  const [streak, setStreak] = useState<number>(() => loadStreak());
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => loadAchievements());

  useEffect(() => {
    const data = { count: streak, lastActiveDate: new Date().toISOString().slice(0, 10) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [streak]);

  useEffect(() => {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlockedIds));
  }, [unlockedIds]);

  const recordActivity = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { count: number; lastActiveDate: string };
      if (data.lastActiveDate === today) return;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newCount = data.lastActiveDate === yesterday ? data.count + 1 : 1;
      setStreak(newCount);
    } else {
      setStreak(1);
    }
  }, []);

  const unlockAchievement = useCallback((id: string) => {
    setUnlockedIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const allAchievements: Achievement[] = [
    { id: 'first_lesson', unlocked: unlockedIds.includes('first_lesson') },
    { id: 'unit_complete', unlocked: unlockedIds.includes('unit_complete') },
    { id: 'first_quiz', unlocked: unlockedIds.includes('first_quiz') },
    { id: 'high_score', unlocked: unlockedIds.includes('high_score') },
    { id: 'first_source', unlocked: unlockedIds.includes('first_source') },
    { id: 'first_project', unlocked: unlockedIds.includes('first_project') },
    { id: 'streak_7', unlocked: unlockedIds.includes('streak_7') },
    { id: 'streak_30', unlocked: unlockedIds.includes('streak_30') },
    { id: 'quiz_master', unlocked: unlockedIds.includes('quiz_master') },
  ];

  return { streak, recordActivity, unlockAchievement, achievements: allAchievements, unlockedIds };
}
