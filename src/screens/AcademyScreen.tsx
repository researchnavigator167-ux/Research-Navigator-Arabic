import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, GraduationCap, Trophy, Flame, Bot, Send, Check, X,
  ChevronRight, ChevronLeft, Loader2, Sparkles, Lock, CircleCheck, Circle,
  RefreshCw, ArrowRight, Lightbulb,
} from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { callEdgeFunction } from '@/lib/api';
import { academyUnits, quizTopics, type AcademyLesson } from '@/lib/academyData';
import { useStreak } from '@/lib/useStreak';
import { Watermark } from '@/components/Watermark';
import { EmptyState } from '@/components/ui';

type SubTab = 'learn' | 'quiz' | 'streak' | 'buddy';

const PROGRESS_KEY = 'el-professor-academy-progress';

function loadProgress(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function AcademyScreen() {
  const { t, isRTL } = useApp();
  const [subTab, setSubTab] = useState<SubTab>('learn');

  const tabs: { id: SubTab; icon: typeof BookOpen; label: string }[] = [
    { id: 'learn', icon: BookOpen, label: t('academyTabLearn') },
    { id: 'quiz', icon: GraduationCap, label: t('academyTabQuiz') },
    { id: 'streak', icon: Flame, label: t('academyTabStreak') },
    { id: 'buddy', icon: Bot, label: t('academyTabBuddy') },
  ];

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="bg-gradient-to-br from-primary-700 to-primary-800 px-5 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">{t('academyTitle')}</h1>
            <p className="text-white/70 text-xs">{t('academySubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide bg-white dark:bg-neutral-900 rounded-2xl p-2 shadow-sm border border-neutral-100 dark:border-neutral-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  isActive
                    ? 'bg-primary-700 text-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4">
        {subTab === 'learn' && <LearnTab />}
        {subTab === 'quiz' && <QuizTab />}
        {subTab === 'streak' && <StreakTab />}
        {subTab === 'buddy' && <BuddyTab />}
      </div>

      <Watermark className="pb-2" />
    </div>
  );
}

function LearnTab() {
  const { t, isRTL } = useApp();
  const { recordActivity, unlockAchievement } = useStreak();
  const [progress, setProgress] = useState<Record<string, boolean>>(() => loadProgress());
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [currentLesson, setCurrentLesson] = useState<{ unitId: string; lesson: AcademyLesson } | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<'correct' | 'incorrect' | null>(null);

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  const startLesson = (unitId: string, lesson: AcademyLesson) => {
    setCurrentLesson({ unitId, lesson });
    setQuizMode(false);
    setQuizAnswer(null);
    setQuizResult(null);
  };

  const startQuiz = () => {
    setQuizMode(true);
    setQuizAnswer(null);
    setQuizResult(null);
  };

  const submitQuizAnswer = (index: number) => {
    if (!currentLesson) return;
    setQuizAnswer(index);
    const correct = index === currentLesson.lesson.quiz.correctIndex;
    setQuizResult(correct ? 'correct' : 'incorrect');
    if (correct) {
      setProgress((prev) => {
        const updated = { ...prev, [currentLesson.lesson.id]: true };
        return updated;
      });
      recordActivity();

      const firstLesson = academyUnits[0]?.lessons[0];
      if (firstLesson && currentLesson.lesson.id === firstLesson.id) {
        unlockAchievement('first_lesson');
      }

      const allLessonsInUnit = academyUnits.find((u) => u.id === currentLesson.unitId)?.lessons || [];
      const allDone = allLessonsInUnit.every((l) => l.id !== currentLesson.lesson.id ? progress[l.id] : true);
      if (allDone && allLessonsInUnit.length > 0) {
        unlockAchievement('unit_complete');
      }
    }
  };

  const goToNextLesson = () => {
    if (!currentLesson) return;
    const unit = academyUnits.find((u) => u.id === currentLesson.unitId);
    if (!unit) return;
    const lessonIdx = unit.lessons.findIndex((l) => l.id === currentLesson.lesson.id);
    if (lessonIdx < unit.lessons.length - 1) {
      startLesson(unit.id, unit.lessons[lessonIdx + 1]);
    } else {
      const unitIdx = academyUnits.findIndex((u) => u.id === unit.id);
      if (unitIdx < academyUnits.length - 1) {
        const nextUnit = academyUnits[unitIdx + 1];
        startLesson(nextUnit.id, nextUnit.lessons[0]);
      } else {
        setCurrentLesson(null);
      }
    }
  };

  const goToPrevLesson = () => {
    if (!currentLesson) return;
    const unit = academyUnits.find((u) => u.id === currentLesson.unitId);
    if (!unit) return;
    const lessonIdx = unit.lessons.findIndex((l) => l.id === currentLesson.lesson.id);
    if (lessonIdx > 0) {
      startLesson(unit.id, unit.lessons[lessonIdx - 1]);
    }
  };

  const ArrowFwd = isRTL ? ChevronLeft : ChevronRight;
  const ArrowBack = isRTL ? ChevronRight : ChevronLeft;

  if (currentLesson && !quizMode) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setCurrentLesson(null)}
          className="flex items-center gap-1 text-xs text-neutral-500 mb-3 active:scale-95 transition-all"
        >
          <ArrowBack className="w-4 h-4" />
          {t('back')}
        </button>

        <div className="card animate-slide-up">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-3">{currentLesson.lesson.title}</h2>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
            {currentLesson.lesson.content}
          </p>
          {currentLesson.lesson.example && (
            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 p-3 mb-4">
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 mb-1">{t('academyTitle')}</p>
              <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">{currentLesson.lesson.example}</p>
            </div>
          )}
          <button onClick={startQuiz} className="btn-primary w-full">
            <Sparkles className="w-4 h-4" />
            {t('academyQuiz')}
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={goToPrevLesson} className="btn-ghost flex-1 text-xs">
            <ArrowBack className="w-4 h-4" />
            {t('academyPrevLesson')}
          </button>
          <button onClick={goToNextLesson} className="btn-secondary flex-1 text-xs">
            {t('academyNextLesson')}
            <ArrowFwd className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (currentLesson && quizMode) {
    const quiz = currentLesson.lesson.quiz;
    return (
      <div className="animate-fade-in">
        <div className="card animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-700 dark:text-primary-400" />
            </div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">{t('academyQuiz')}</h2>
          </div>

          <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">{quiz.question}</p>

          <div className="space-y-2">
            {quiz.options.map((option, i) => {
              const isSelected = quizAnswer === i;
              const isCorrect = i === quiz.correctIndex;
              let style = 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900';
              if (quizResult && isCorrect) {
                style = 'border-success-300 bg-success-50 dark:bg-success-900/20 dark:border-success-800';
              } else if (isSelected && quizResult === 'incorrect') {
                style = 'border-error-300 bg-error-50 dark:bg-error-900/20 dark:border-error-800';
              }
              return (
                <button
                  key={i}
                  onClick={() => quizResult === null && submitQuizAnswer(i)}
                  disabled={quizResult !== null}
                  className={`w-full text-start p-3 rounded-xl border text-sm transition-all active:scale-[0.98] ${style}`}
                >
                  <div className="flex items-center gap-2">
                    {quizResult && isCorrect && <Check className="w-4 h-4 text-success-600 flex-shrink-0" />}
                    {isSelected && quizResult === 'incorrect' && <X className="w-4 h-4 text-error-600 flex-shrink-0" />}
                    <span className="text-neutral-800 dark:text-neutral-200">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {quizResult && (
            <div className="mt-4 animate-slide-down">
              <div className={`rounded-xl p-3 mb-3 ${quizResult === 'correct' ? 'bg-success-50 dark:bg-success-900/20' : 'bg-error-50 dark:bg-error-900/20'}`}>
                <p className={`text-sm font-bold mb-1 ${quizResult === 'correct' ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'}`}>
                  {quizResult === 'correct' ? t('academyQuizCorrect') : t('academyQuizIncorrect')}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{quiz.explanation}</p>
              </div>
              {quizResult === 'correct' && (
                <p className="text-center text-xs text-success-600 dark:text-success-400 font-medium animate-fade-in">
                  {t('academyLessonDone')}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => setQuizMode(false)} className="btn-ghost flex-1 text-xs">
                  {t('back')}
                </button>
                <button onClick={goToNextLesson} className="btn-primary flex-1 text-xs">
                  {t('academyNextLesson')}
                  <ArrowFwd className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {academyUnits.map((unit, unitIdx) => {
        const completedLessons = unit.lessons.filter((l) => progress[l.id]).length;
        const totalLessons = unit.lessons.length;
        const isOpen = openUnit === unit.id;
        const allDone = completedLessons === totalLessons;

        return (
          <div key={unit.id} className="mb-3">
            <button
              onClick={() => setOpenUnit(isOpen ? null : unit.id)}
              className="w-full card text-start active:scale-[0.98] transition-all hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${allDone ? 'bg-success-50 dark:bg-success-900/20' : 'bg-primary-50 dark:bg-primary-900/30'}`}>
                  {allDone ? (
                    <CircleCheck className="w-5 h-5 text-success-600 dark:text-success-400" />
                  ) : (
                    <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{unitIdx + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-neutral-900 dark:text-white truncate">{unit.title}</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">{completedLessons}/{totalLessons} {t('academyLessons')}</p>
                </div>
                <ChevronRight className={`w-5 h-5 text-neutral-300 transition-transform ${isOpen ? 'rotate-90' : ''} ${isRTL ? 'rotate-180' : ''} ${isOpen && isRTL ? 'rotate-[270deg]' : ''}`} />
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-success-500' : 'bg-primary-600'}`}
                  style={{ width: `${(completedLessons / totalLessons) * 100}%` }}
                />
              </div>
            </button>

            {isOpen && (
              <div className="mt-2 space-y-2 animate-slide-down">
                {unit.lessons.map((lesson, lessonIdx) => {
                  const done = progress[lesson.id];
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => startLesson(unit.id, lesson)}
                      className="w-full bg-white dark:bg-neutral-900 rounded-xl p-3 text-start active:scale-[0.98] transition-all border border-neutral-100 dark:border-neutral-800 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? 'bg-success-100 dark:bg-success-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                          {done ? (
                            <Check className="w-4 h-4 text-success-600 dark:text-success-400" />
                          ) : (
                            <span className="text-xs font-medium text-neutral-400">{lessonIdx + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${done ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-white'}`}>
                            {lesson.title}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {done ? t('academyLessonCompleted') : t('academyLessonIncomplete')}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuizTab() {
  const { t } = useApp();
  const { recordActivity, unlockAchievement } = useStreak();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const topic = quizTopics.find((tp) => tp.id === selectedTopic);

  const startTopic = (topicId: string) => {
    setSelectedTopic(topicId);
    setCurrentQ(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowResult(false);
    setShowReview(false);
  };

  const submitAnswer = () => {
    if (selectedAnswer === null || !topic) return;
    const newAnswers = [...answers, selectedAnswer];
    setAnswers(newAnswers);
    if (currentQ < topic.questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
    } else {
      const correctCount = newAnswers.filter((a, i) => a === topic.questions[i].correctIndex).length;
      const score = (correctCount / topic.questions.length) * 100;
      recordActivity();
      unlockAchievement('first_quiz');
      if (score >= 90) unlockAchievement('high_score');
      setShowResult(true);
    }
  };

  if (!topic) {
    return (
      <div className="animate-fade-in">
        {quizTopics.map((tp, idx) => (
          <button
            key={tp.id}
            onClick={() => startTopic(tp.id)}
            className="w-full card text-start mb-3 active:scale-[0.98] transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-accent-600 dark:text-accent-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white">{tp.title}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{tp.questions.length} {t('academyQuizQuestion')}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-neutral-300" />
            </div>
          </button>
        ))}
      </div>
    );
  }

  if (showResult && !showReview) {
    const correctCount = answers.filter((a, i) => a === topic.questions[i].correctIndex).length;
    const score = Math.round((correctCount / topic.questions.length) * 100);
    const performance = score >= 80 ? t('quizArenaExcellent') : score >= 50 ? t('quizArenaGood') : t('quizArenaNeedsWork');

    return (
      <div className="animate-fade-in">
        <div className="card text-center animate-scale-in">
          <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${score >= 80 ? 'bg-success-100 dark:bg-success-900/30' : score >= 50 ? 'bg-warning-100 dark:bg-warning-900/30' : 'bg-error-100 dark:bg-error-900/30'}`}>
            <span className="text-2xl font-bold text-neutral-900 dark:text-white">{score}%</span>
          </div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-1">{t('quizArenaResult')}</h2>
          <p className="text-sm text-neutral-500 mb-3">{correctCount} / {topic.questions.length} {t('quizArenaCorrect')}</p>
          <span className={`badge ${score >= 80 ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400' : score >= 50 ? 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400' : 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400'}`}>
            {performance}
          </span>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowReview(true)} className="btn-secondary flex-1 text-xs">
              {t('quizArenaReviewAnswers')}
            </button>
            <button onClick={() => startTopic(topic.id)} className="btn-primary flex-1 text-xs">
              <RefreshCw className="w-4 h-4" />
              {t('quizArenaRetry')}
            </button>
          </div>
          <button onClick={() => setSelectedTopic(null)} className="btn-ghost w-full text-xs mt-2">
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  if (showReview && topic) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setShowReview(false)}
          className="flex items-center gap-1 text-xs text-neutral-500 mb-3 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('back')}
        </button>
        <div className="space-y-3">
          {topic.questions.map((q, i) => {
            const userAnswer = answers[i];
            const isCorrect = userAnswer === q.correctIndex;
            return (
              <div key={i} className="card">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                  {i + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, j) => {
                    const isUserAns = j === userAnswer;
                    const isRight = j === q.correctIndex;
                    let style = 'text-neutral-600 dark:text-neutral-400';
                    if (isRight) style = 'text-success-600 dark:text-success-400 font-medium';
                    if (isUserAns && !isRight) style = 'text-error-600 dark:text-error-400 font-medium';
                    return (
                      <div key={j} className={`text-xs flex items-center gap-2 ${style}`}>
                        {isRight && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                        {isUserAns && !isRight && <X className="w-3.5 h-3.5 flex-shrink-0" />}
                        {opt}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 p-2">
                  <p className="text-[10px] text-primary-700 dark:text-primary-400 font-medium mb-0.5">{t('quizArenaExplanation')}</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{q.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const question = topic.questions[currentQ];
  return (
    <div className="animate-fade-in">
      <button
        onClick={() => setSelectedTopic(null)}
        className="flex items-center gap-1 text-xs text-neutral-500 mb-3 active:scale-95 transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
        {t('back')}
      </button>

      <div className="card animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-neutral-500">{t('quizArenaQuestion')} {currentQ + 1} {t('quizArenaOf')} {topic.questions.length}</span>
          <div className="flex gap-1">
            {topic.questions.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i < currentQ ? 'w-3 bg-primary-700' : i === currentQ ? 'w-6 bg-primary-700' : 'w-1.5 bg-neutral-200 dark:bg-neutral-700'}`}
              />
            ))}
          </div>
        </div>

        <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">{question.question}</p>

        <div className="space-y-2">
          {question.options.map((option, i) => {
            const isSelected = selectedAnswer === i;
            return (
              <button
                key={i}
                onClick={() => setSelectedAnswer(i)}
                className={`w-full text-start p-3 rounded-xl border text-sm transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <button
          onClick={submitAnswer}
          disabled={selectedAnswer === null}
          className="btn-primary w-full mt-4"
        >
          {currentQ < topic.questions.length - 1 ? t('academyQuizNext') : t('academyQuizFinish')}
        </button>
      </div>
    </div>
  );
}

function StreakTab() {
  const { t } = useApp();
  const { streak, achievements } = useStreak();

  const achievementMeta: Record<string, { iconKey: string; labelKey: string; descKey: string }> = {
    first_lesson: { iconKey: 'first', labelKey: 'achFirstLesson', descKey: 'achFirstLessonDesc' },
    unit_complete: { iconKey: 'unit', labelKey: 'achUnitComplete', descKey: 'achUnitCompleteDesc' },
    first_quiz: { iconKey: 'quiz', labelKey: 'achFirstQuiz', descKey: 'achFirstQuizDesc' },
    high_score: { iconKey: 'score', labelKey: 'achHighScore', descKey: 'achHighScoreDesc' },
    first_source: { iconKey: 'source', labelKey: 'achFirstSource', descKey: 'achFirstSourceDesc' },
    first_project: { iconKey: 'project', labelKey: 'achFirstProject', descKey: 'achFirstProjectDesc' },
    streak_7: { iconKey: '7', labelKey: 'achStreak7', descKey: 'achStreak7Desc' },
    streak_30: { iconKey: '30', labelKey: 'achStreak30', descKey: 'achStreak30Desc' },
    quiz_master: { iconKey: 'master', labelKey: 'achQuizMaster', descKey: 'achQuizMasterDesc' },
  };

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="animate-fade-in">
      <div className="card text-center mb-4 animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 mx-auto mb-2 flex items-center justify-center">
          <Flame className="w-8 h-8 text-orange-500" />
        </div>
        <p className="text-3xl font-bold text-neutral-900 dark:text-white">{streak}</p>
        <p className="text-xs text-neutral-500 mt-1">{t('streakDays')}</p>
        {streak > 0 ? (
          <p className="text-xs text-orange-500 mt-2 font-medium">{t('streakKeepGoing')}</p>
        ) : (
          <p className="text-xs text-neutral-400 mt-2">{t('streakNoActivity')}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-neutral-900 dark:text-white">{t('achievementsTitle')}</h2>
        <span className="text-xs text-neutral-500">{unlockedCount}/{achievements.length}</span>
      </div>

      <div className="space-y-2">
        {achievements.map((ach) => {
          const meta = achievementMeta[ach.id];
          if (!meta) return null;
          return (
            <div
              key={ach.id}
              className={`card transition-all ${ach.unlocked ? 'border-amber-200 dark:border-amber-900/40' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ach.unlocked ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                  {ach.unlocked ? (
                    <Trophy className="w-5 h-5 text-amber-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-neutral-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${ach.unlocked ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>
                    {t(meta.labelKey)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{t(meta.descKey)}</p>
                </div>
                {ach.unlocked && (
                  <CircleCheck className="w-5 h-5 text-amber-500 flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuddyTab() {
  const { t } = useApp();
  const { user } = useAuth();
  const { recordActivity } = useStreak();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: t('buddyGreeting') },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hints = [t('buddyHint1'), t('buddyHint2'), t('buddyHint3')];

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    recordActivity();

    try {
      const data = await callEdgeFunction<{ response: string }>('ai-assistant', {
        message: userMsg,
        conversationId: null,
        projectId: null,
        buddyMode: true,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response || t('error') }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('error') }]);
    } finally {
      setLoading(false);
    }
  }, [loading, recordActivity, t]);

  return (
    <div className="animate-fade-in">
      <div className="card mb-3 bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/30">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary-700 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary-800 dark:text-primary-300">{t('buddyTitle')}</p>
            <p className="text-[10px] text-neutral-500">{t('buddySubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-3 max-h-[45vh] overflow-y-auto scrollbar-hide">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-neutral-200 dark:bg-neutral-700' : 'bg-primary-700'}`}>
              {msg.role === 'user' ? (
                <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">{(user?.email || '?')[0].toUpperCase()}</span>
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-primary-700 text-white' : 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-100 dark:border-neutral-800'}`}>
              {msg.content}
              {msg.role === 'assistant' && i > 0 && (
                <p className="text-[9px] text-neutral-400 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">{t('buddyDisclaimer')}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-700 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-neutral-100 dark:border-neutral-800">
              <Loader2 className="w-4 h-4 text-primary-700 dark:text-primary-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && (
        <div className="mb-3">
          <p className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5" />
            {t('buddyHint')}
          </p>
          <div className="space-y-2">
            {hints.map((hint, i) => (
              <button
                key={i}
                onClick={() => send(hint)}
                className="w-full text-start bg-white dark:bg-neutral-900 rounded-xl p-3 text-xs text-neutral-700 dark:text-neutral-300 border border-neutral-100 dark:border-neutral-800 active:scale-[0.98] transition-all hover:shadow-sm"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          className="input-field flex-1 text-sm"
          placeholder={t('buddyPlaceholder')}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="btn-primary px-3 py-3"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
