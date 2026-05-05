import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getProfile } from '../lib/storage';
import { TASK_COMPLETED_EVENT } from '../lib/taskActions';
import {
  addTaskFeeling,
  getReflectionPromptDecision,
  getReflectionRoute,
  markReflectionPromptShown,
  skipReflectionPrompt,
  snoozeReflectionPrompt,
} from '../lib/reflections';
import { triggerCelebration } from './CelebrationLayer';

type CompletedTaskEvent = {
  taskId: string;
  taskName: string;
  date: string;
};

const FEELINGS: Array<{ label: 'Easy' | 'Good' | 'Tiring' | 'Distracted'; message: string }> = [
  { label: 'Easy', message: 'That flowed well. Keep the streak alive.' },
  { label: 'Good', message: 'Nice work. You moved the day forward.' },
  { label: 'Tiring', message: 'Even hard effort counts. Recovery matters too.' },
  { label: 'Distracted', message: 'You still closed the loop. Let tomorrow feel cleaner.' },
];

export default function ReflectionManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const [reflectionPrompt, setReflectionPrompt] = useState<ReturnType<typeof getReflectionPromptDecision>>(null);
  const [taskQueue, setTaskQueue] = useState<CompletedTaskEvent[]>([]);
  const [activeTask, setActiveTask] = useState<CompletedTaskEvent | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const promptKeyRef = useRef<string | null>(null);

  const promptTitle = useMemo(() => {
    if (!reflectionPrompt) return '';
    return reflectionPrompt.mode === 'evening' ? 'Wrap up your day' : 'Quick catch-up from yesterday';
  }, [reflectionPrompt]);

  const promptMessage = useMemo(() => {
    if (!reflectionPrompt) return '';
    const profile = getProfile();
    return reflectionPrompt.mode === 'evening'
      ? `You are getting closer to ${getBedLabel(profile, reflectionPrompt.date)}. Take 30 seconds to reflect while the day is still fresh.`
      : 'Yesterday missed a reflection. Capture it now while the signals are still easy to remember.';
  }, [reflectionPrompt]);

  useEffect(() => {
    if (location.pathname.startsWith('/reflection') || location.pathname.startsWith('/journal-prototype')) {
      setReflectionPrompt(null);
      return;
    }

    const checkPrompt = () => {
      const decision = getReflectionPromptDecision();
      const nextKey = decision ? `${decision.date}:${decision.mode}` : null;
      if (decision && promptKeyRef.current !== nextKey) {
        markReflectionPromptShown(decision.date);
      }
      promptKeyRef.current = nextKey;
      setReflectionPrompt(decision);
    };

    checkPrompt();

    const interval = window.setInterval(checkPrompt, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkPrompt();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', checkPrompt);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', checkPrompt);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleTaskCompleted = (event: Event) => {
      const detail = (event as CustomEvent<CompletedTaskEvent>).detail;
      if (!detail) return;
      setTaskQueue((current) => [...current, detail]);
    };

    window.addEventListener(TASK_COMPLETED_EVENT, handleTaskCompleted as EventListener);
    return () => window.removeEventListener(TASK_COMPLETED_EVENT, handleTaskCompleted as EventListener);
  }, []);

  useEffect(() => {
    if (activeTask || taskQueue.length === 0) return;
    const [next, ...rest] = taskQueue;
    setActiveTask(next);
    setTaskQueue(rest);
  }, [activeTask, taskQueue]);

  useEffect(() => {
    if (!activeTask) return;

    timeoutRef.current = window.setTimeout(() => {
      triggerCelebration();
      setActiveTask(null);
      timeoutRef.current = null;
    }, 6000);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [activeTask]);

  const handleFeelingPick = (feeling: (typeof FEELINGS)[number]) => {
    if (!activeTask) return;

    addTaskFeeling({
      taskId: activeTask.taskId,
      taskName: activeTask.taskName,
      date: activeTask.date,
      feeling: feeling.label,
      createdAt: Date.now(),
    });

    triggerCelebration(feeling.message);
    setActiveTask(null);
  };

  if (!reflectionPrompt && !activeTask) {
    return null;
  }

  return (
    <>
      {reflectionPrompt && (
        <div className="fixed inset-x-0 top-[84px] z-[230] flex justify-center px-4">
          <div className="w-full max-w-xl rounded-[28px] border border-[rgba(var(--accent-rgb),0.2)] bg-[rgba(11,15,26,0.92)] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Daily reflection</div>
                <div className="mt-2 text-[18px] font-[700] text-[var(--text)]">{promptTitle}</div>
                <p className="mt-2 text-[13px] leading-6 text-[var(--muted2)]">{promptMessage}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = reflectionPrompt.date;
                  setReflectionPrompt(null);
                  navigate(getReflectionRoute(target));
                }}
                className="rounded-[16px] bg-[var(--accent)] px-4 py-3 text-[14px] font-semibold text-[var(--bg)] transition hover:opacity-90 active:scale-95"
              >
                Reflect now
              </button>
              <button
                type="button"
                onClick={() => {
                  snoozeReflectionPrompt(reflectionPrompt.date);
                  setReflectionPrompt(null);
                }}
                className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[14px] font-medium text-[var(--text)] transition hover:bg-[rgba(255,255,255,0.07)] active:scale-95"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  skipReflectionPrompt(reflectionPrompt.date);
                  setReflectionPrompt(null);
                }}
                className="rounded-[16px] px-4 py-3 text-[14px] font-medium text-[var(--muted2)] transition hover:text-[var(--text)] active:scale-95"
              >
                Skip today
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTask && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[126px] z-[235] flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-lg rounded-[26px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(14,18,29,0.95)] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">Task complete</div>
            <div className="mt-2 text-[17px] font-[700] text-[var(--text)]">How did that feel?</div>
            <p className="mt-1 text-[13px] text-[var(--muted2)]">{activeTask.taskName}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FEELINGS.map((feeling) => (
                <button
                  key={feeling.label}
                  type="button"
                  onClick={() => handleFeelingPick(feeling)}
                  className="rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-3 text-[13px] font-medium text-[var(--text)] transition hover:scale-[1.03] hover:bg-[rgba(255,255,255,0.07)] active:scale-95"
                >
                  {feeling.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getBedLabel(profile: ReturnType<typeof getProfile>, date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  const weekend = day === 0 || day === 6;
  return weekend ? profile.weBed || 'bedtime' : profile.wdBed || 'bedtime';
}
