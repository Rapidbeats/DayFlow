import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Minimize2, PauseCircle, PlayCircle, SkipForward, TimerReset, XCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  clearFocusSession,
  completeFocusTask,
  createFocusSession,
  findFocusTask,
  FOCUS_SESSION_UPDATED_EVENT,
  formatClock,
  getActiveFocusSession,
  getCompletedFocusMinutes,
  getCompletedSessionMinutes,
  getFocusProgress,
  getTotalSessionMinutes,
  markMidpointCuePlayed,
  moveToNextFocusSegment,
  pauseFocusSession,
  phaseLabel,
  resumeFocusSession,
  sessionSummaryLabel,
  shouldShowMidpointCue,
  skipCurrentBreak,
  snoozeFocusSession,
  type FocusSession,
} from '../lib/focusMode';
import { useAuth } from '../contexts/AuthContext';
import { getTheme } from '../lib/themes';
import { triggerCelebration } from '../components/CelebrationLayer';

type AlertState =
  | { type: 'midpoint'; visible: boolean }
  | { type: 'phase-end'; visible: boolean; title: string; message: string }
  | { type: 'complete'; visible: boolean; title: string; message: string }
  | null;

const BREAK_TIPS = [
  'Hydrate for better performance.',
  'Look away from the screen and reset your eyes.',
  'Take ten slow shoulder rolls and loosen the neck.',
  'Stand up and let your breathing settle before the next block.',
  'Walk a few steps. Motion helps attention recover.',
  'Small recovery now usually buys better focus later.',
];

const PHASE_STEPS = ['Inhale', 'Hold', 'Exhale', 'Hold'] as const;
const BREAK_AUDIO_PATH = '/audio/focus-break-loop.mp3.mp3';

export default function FocusMode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const [session, setSession] = useState<FocusSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [alertState, setAlertState] = useState<AlertState>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const breakAudioRef = useRef<HTMLAudioElement | null>(null);
  const { syncTasks, refreshTasks } = useAuth();

  useEffect(() => {
    void refreshTasks().then(() => {
      let nextSession = getActiveFocusSession();

      if (taskId) {
        const task = findFocusTask(taskId);
        if (!task) {
          navigate('/tasks');
          return;
        }

        if (!nextSession || nextSession.taskId !== taskId || nextSession.completed) {
          nextSession = createFocusSession(task);
          void syncTasks();
        }
      }

      setSession(nextSession);
      setLoading(false);
    });
  }, [taskId, navigate, refreshTasks, syncTasks]);

  useEffect(() => {
    const syncSession = () => {
      setSession(getActiveFocusSession());
    };

    window.addEventListener(FOCUS_SESSION_UPDATED_EVENT, syncSession as EventListener);
    return () => window.removeEventListener(FOCUS_SESSION_UPDATED_EVENT, syncSession as EventListener);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const breakIsLive =
      Boolean(session) &&
      !session?.completed &&
      !session?.paused &&
      session?.segments[session.currentSegmentIndex]?.type === 'break';

    if (!breakIsLive) {
      stopBreakAudio(breakAudioRef);
      return;
    }

    const audio = breakAudioRef.current ?? new Audio(BREAK_AUDIO_PATH);
    audio.loop = true;
    audio.volume = 0.6;
    breakAudioRef.current = audio;
    void audio.play().catch(() => undefined);
  }, [session]);

  useEffect(() => {
    return () => {
      stopAudio(audioCtxRef);
      stopBreakAudio(breakAudioRef);
    };
  }, []);

  useEffect(() => {
    if (!session || session.paused || alertState?.visible) return;

    if (shouldShowMidpointCue(session, now)) {
      const nextSession = markMidpointCuePlayed(session);
      setSession(nextSession);
      void syncTasks();
      setAlertState({ type: 'midpoint', visible: true });
      playPattern(audioCtxRef, 15);
      window.setTimeout(() => {
        setAlertState((current) => (current?.type === 'midpoint' ? null : current));
      }, 2500);
      return;
    }

    const { remainingSec } = getFocusProgress(session, now);
    if (remainingSec > 0) return;

    const currentSegment = session.segments[session.currentSegmentIndex];
    const nextSession = moveToNextFocusSegment(session);
    setSession(nextSession);
    void syncTasks();

    if (nextSession.completed) {
      void finishSession(nextSession.taskId, nextSession.skippedBreakIndices.length);
      setAlertState({
        type: 'complete',
        visible: true,
        title: 'Task finished',
        message:
          nextSession.skippedBreakIndices.length > 0
            ? 'You pushed through the session and still closed the task. Strong finish.'
            : 'The final focus block is complete. The task is marked done and ready to return.',
      });
      playPattern(audioCtxRef, 18);
      return;
    }

    const nextSegment = nextSession.segments[nextSession.currentSegmentIndex];
    setAlertState({
      type: 'phase-end',
      visible: true,
      title: nextSegment.type === 'break' ? 'Break started' : 'Break finished',
      message:
        currentSegment.type === 'focus'
          ? `${breakTipForSegment(nextSession.currentSegmentIndex)} Reset for 8 minutes before the next block.`
          : 'The recovery window is over. Time to get back into the next focus block.',
    });
    playPattern(audioCtxRef, 30);
  }, [alertState?.visible, now, session, syncTasks]);

  const theme = getTheme(session?.themeId || 'emerald');
  const progress = session ? getFocusProgress(session, now) : { remainingSec: 0, elapsedSec: 0, progress: 0 };
  const currentSegment = session?.segments[session.currentSegmentIndex];
  const showBreakUi = currentSegment?.type === 'break';
  const breakPhase = useMemo(
    () => (session && showBreakUi ? getBreakPhaseState(session, now) : { label: 'Inhale', remaining: 5 }),
    [now, session, showBreakUi]
  );
  const cycleBars = useMemo(() => buildCycleBars(session), [session]);
  const completedFocusMinutes = session ? getCompletedFocusMinutes(session) : 0;
  const completedSessionMinutes = session ? getCompletedSessionMinutes(session, now) : 0;
  const totalSessionMinutes = session ? getTotalSessionMinutes(session) : 0;
  const totalBreakMinutes = Math.max(totalSessionMinutes - (session ? session.totalMinutes : 0), 0);
  const remainingFocusMinutes = session ? Math.max(session.totalMinutes - completedFocusMinutes, 0) : 0;
  const remainingRuntimeMinutes = session ? Math.max(totalSessionMinutes - completedSessionMinutes, 0) : 0;

  if (loading || !session) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-5 py-10">
        <div className="dayflow-surface-card w-full max-w-lg p-8 text-center">
          {loading ? (
            <p className="dayflow-body">Loading focus session…</p>
          ) : (
            <>
              <h1 className="dayflow-h1">No active focus session</h1>
              <p className="dayflow-body mt-3">Start Focus Mode from an eligible task to launch a guided timer session.</p>
              <button type="button" onClick={() => navigate('/tasks')} className="dayflow-primary-button mt-6">
                Back to tasks
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="dayflow-focus-shell min-h-[calc(100vh-96px)] rounded-[32px] p-5 md:p-8"
      style={{
        background: `radial-gradient(circle at top right, rgba(${theme.rgb}, 0.26), transparent 32%), linear-gradient(180deg, rgba(8,12,20,0.98), rgba(11,15,26,0.98))`,
        border: `1px solid rgba(${theme.rgb}, 0.18)`,
      }}
    >
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="dayflow-kicker">Focus Mode</div>
            <h1 className="dayflow-h1 mt-2">{session.taskName}</h1>
            <p className="dayflow-body mt-2">
              {phaseLabel(session)} - {sessionSummaryLabel(session)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                stopAudio(audioCtxRef);
                stopBreakAudio(breakAudioRef);
                navigate('/');
              }}
              className="inline-flex items-center gap-2 rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[14px] font-medium text-[var(--text)] transition hover:bg-[rgba(255,255,255,0.08)]"
            >
              <Minimize2 className="h-4 w-4" />
              Minimize
            </button>
            <button
              type="button"
              onClick={() => {
                stopBreakAudio(breakAudioRef);
                clearFocusSession(session.taskId);
                void syncTasks();
                navigate('/tasks');
              }}
              className="inline-flex items-center gap-2 rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[14px] font-medium text-[var(--text)] transition hover:bg-[rgba(255,255,255,0.08)]"
            >
              <XCircle className="h-4 w-4" />
              Exit
            </button>
          </div>
        </div>

        <div className="dayflow-surface-card p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="dayflow-kicker">Progress timeline</div>
              <div className="text-[14px] font-[600] text-[var(--text)]">Each bar is one focus cycle and its break</div>
            </div>
            <div className="text-[12px] text-[var(--muted2)]">{Math.max(Math.ceil(remainingRuntimeMinutes), 0)}m runtime left</div>
          </div>
          <div className="dayflow-focus-cycle-grid">
            {cycleBars.map((bar) => (
              <div key={bar.key} className="dayflow-focus-cycle-card" title={bar.label}>
                <div className="dayflow-focus-cycle-meta">
                  <span>{bar.short}</span>
                  <span>
                    {bar.focusMinutes}m / {bar.breakMinutes ? `${bar.breakMinutes}m` : '0m'}
                  </span>
                </div>
                <div className="dayflow-focus-cycle-track">
                  <div className={`dayflow-focus-cycle-segment focus ${bar.focusState}`} style={{ flex: `${bar.focusMinutes} 1 0%` }}>
                    <span>Focus</span>
                  </div>
                  {bar.breakMinutes > 0 && (
                    <div className={`dayflow-focus-cycle-segment break ${bar.breakState}`} style={{ flex: `${bar.breakMinutes} 1 0%` }}>
                      <span>{bar.breakState === 'skipped' ? 'Skipped' : 'Break'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_380px]">
          <section
            className="dayflow-surface-card relative overflow-hidden p-6 md:p-8"
            style={{ background: `linear-gradient(180deg, rgba(${theme.rgb}, 0.11), rgba(255,255,255,0.03))` }}
          >
            <div className="dayflow-focus-illustration" aria-hidden="true">
              <div className="dayflow-focus-card" style={{ borderColor: `rgba(${theme.rgb}, 0.25)` }} />
              <div className="dayflow-focus-lamp" style={{ background: `rgba(${theme.rgb}, 0.16)` }} />
              <div className="dayflow-focus-cup" style={{ borderColor: `rgba(${theme.rgb}, 0.28)` }} />
            </div>

            <div className="relative z-[1] flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 inline-flex items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--muted2)]">
                {showBreakUi ? 'Recovery break' : 'Deep focus'}
              </div>

              {showBreakUi ? (
                <div className="flex w-full max-w-xl flex-col items-center">
                  <BreathingGuide themeRgb={theme.rgb} stepLabel={breakPhase.label} stepRemaining={breakPhase.remaining} />
                  <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.min(100, Math.max(0, progress.progress * 100))}%`,
                        background: `linear-gradient(90deg, rgba(${theme.rgb}, 0.58), rgb(${theme.rgb}))`,
                      }}
                    />
                  </div>
                  <div className="mt-2 text-[12px] text-[var(--muted2)]">{formatClock(progress.remainingSec)} left in this break</div>
                  <h2 className="dayflow-h2 mt-6">Reset and come back sharper</h2>
                  <p className="dayflow-body mt-3 max-w-md">{breakTipForSegment(session.currentSegmentIndex)}</p>
                  <div className="mt-5 rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[13px] leading-6 text-[var(--muted2)]">
                    Let the floating word guide the breath: 5 seconds per phase, 20 seconds per full cycle.
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[64px] font-[800] leading-none tracking-[-0.06em] text-[var(--text)] md:text-[92px]">
                    {formatClock(progress.remainingSec)}
                  </div>
                  <div className="mt-4 h-2 w-full max-w-xl overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.min(100, Math.max(0, progress.progress * 100))}%`,
                        background: `linear-gradient(90deg, ${theme.accentSoft}, ${theme.accentStrong})`,
                      }}
                    />
                  </div>
                  <p className="dayflow-body mt-4 max-w-lg">
                    Stay on one task. Long focus blocks get a 25-minute midpoint cue, then the session transitions on its own.
                  </p>
                </>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <div className="dayflow-surface-card p-5">
              <div className="dayflow-kicker">Session status</div>
              <div className="mt-3 text-[30px] font-[700] tracking-[-0.04em] text-[var(--text)]">
                {Math.max(Math.ceil(remainingRuntimeMinutes), 0)}m
              </div>
              <div className="dayflow-body mt-2">
                {session.totalMinutes}m focus + {Math.round(totalBreakMinutes)}m breaks = {Math.round(totalSessionMinutes)}m planned runtime.
              </div>
              <div className="mt-3 text-[12px] leading-6 text-[var(--muted2)]">
                {Math.max(Math.ceil(remainingFocusMinutes), 0)}m of focus work remains on the task itself.
              </div>
              <div className="mt-4 text-[12px] leading-6 text-[var(--muted2)]">
                {showBreakUi
                  ? 'Breaks are optional. Skip if you are ready to continue, and the timeline will still show the choice honestly.'
                  : 'The current block is live. Pause if needed, or minimize and come back from Dashboard.'}
              </div>
            </div>

            <div className="dayflow-surface-card p-5">
              <div className="dayflow-kicker">Controls</div>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (session.paused) {
                      const resumedSession = resumeFocusSession(session, session.pausedRemainingSec || progress.remainingSec);
                      setSession(resumedSession);
                      void syncTasks();
                    } else {
                      const pausedSession = pauseFocusSession(session, progress.remainingSec);
                      setSession(pausedSession);
                      void syncTasks();
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-[14px] font-medium text-[var(--text)] transition hover:bg-[rgba(255,255,255,0.08)]"
                >
                  {session.paused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                  {session.paused ? 'Resume session' : 'Pause session'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopAudio(audioCtxRef);
                    stopBreakAudio(breakAudioRef);
                    navigate('/');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-[14px] font-medium text-[var(--text)] transition hover:bg-[rgba(255,255,255,0.08)]"
                >
                  <Minimize2 className="h-4 w-4" />
                  Minimize to dashboard
                </button>

                {showBreakUi && (
                  <button
                    type="button"
                    onClick={() => {
                      stopBreakAudio(breakAudioRef);
                      const nextSession = skipCurrentBreak(session);
                      setSession(nextSession);
                      setAlertState(null);
                      void syncTasks();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[rgba(var(--accent-rgb),0.16)] px-4 py-3 text-[14px] font-medium text-[var(--text)] transition hover:bg-[rgba(var(--accent-rgb),0.22)]"
                  >
                    <SkipForward className="h-4 w-4" />
                    Skip break
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const nextSession = snoozeFocusSession(session, 120);
                    setSession(nextSession);
                    void syncTasks();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[rgba(var(--accent-rgb),0.12)] px-4 py-3 text-[14px] font-medium text-[var(--text)] transition hover:bg-[rgba(var(--accent-rgb),0.16)]"
                >
                  <TimerReset className="h-4 w-4" />
                  Snooze 2 min
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopAudio(audioCtxRef);
                    stopBreakAudio(breakAudioRef);
                    clearFocusSession(session.taskId);
                    void syncTasks();
                    navigate('/tasks');
                  }}
                  className="rounded-[18px] border border-[rgba(255,255,255,0.08)] px-4 py-3 text-[14px] font-medium text-[var(--muted2)] transition hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text)]"
                >
                  Stop session
                </button>
              </div>
            </div>

            <div className="dayflow-surface-card p-5">
              <div className="dayflow-kicker">How to read this</div>
              <div className="mt-3 space-y-3 text-[13px] leading-6 text-[var(--muted2)]">
                <p>Each combined bar represents one focus block and its attached break window.</p>
                <p>Skipped breaks stay visible, so the session history stays honest without punishing momentum.</p>
                <p>During recovery, the word and countdown are the guide. Breathe with the phase, then continue when ready.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {alertState?.type === 'midpoint' && (
        <div className="fixed inset-x-0 top-[120px] z-[220] flex justify-center px-4">
          <div className="rounded-[18px] border border-[rgba(var(--accent-rgb),0.25)] bg-[rgba(11,15,26,0.94)] px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
            <div className="text-[13px] font-[700] uppercase tracking-[0.18em]" style={{ color: theme.accentSoft }}>
              Midpoint
            </div>
            <div className="mt-1 text-[14px] text-[var(--text)]">25 minutes done. Keep the block steady.</div>
            <button
              type="button"
              onClick={() => {
                stopAudio(audioCtxRef);
                setAlertState(null);
              }}
              className="mt-3 rounded-[14px] bg-[rgba(var(--accent-rgb),0.16)] px-4 py-2 text-[13px] font-semibold text-[var(--text)]"
            >
              Stop alert
            </button>
          </div>
        </div>
      )}

      {alertState && alertState.type !== 'midpoint' && alertState.visible && (
        <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm md:items-center">
          <div className="dayflow-surface-card w-full max-w-md p-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Focus alert</div>
            <h3 className="dayflow-h2 mt-3">{alertState.title}</h3>
            <p className="dayflow-body mt-3">{alertState.message}</p>
            <div className={`mt-5 grid gap-3 ${showBreakUi ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {showBreakUi && alertState.type === 'phase-end' && (
                <button
                  type="button"
                  onClick={() => {
                    stopAudio(audioCtxRef);
                    stopBreakAudio(breakAudioRef);
                    if (session) {
                      const nextSession = skipCurrentBreak(session);
                      setSession(nextSession);
                      void syncTasks();
                    }
                    setAlertState(null);
                  }}
                  className="rounded-[18px] border border-[rgba(var(--accent-rgb),0.22)] px-4 py-3 text-[14px] font-semibold text-[var(--text)]"
                >
                  Skip break
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  stopAudio(audioCtxRef);
                  if (session) {
                    const nextSession = snoozeFocusSession(session, 120);
                    setSession(nextSession);
                    void syncTasks();
                  }
                  setAlertState(null);
                }}
                className="rounded-[18px] bg-[rgba(var(--accent-rgb),0.14)] px-4 py-3 text-[14px] font-semibold text-[var(--text)]"
              >
                Snooze 2 min
              </button>
              <button
                type="button"
                onClick={() => {
                  stopAudio(audioCtxRef);
                  if (alertState.type === 'complete') {
                    clearFocusSession(session?.taskId);
                    void syncTasks();
                    navigate('/tasks');
                    return;
                  }
                  setAlertState(null);
                }}
                className="rounded-[18px] bg-[var(--accent)] px-4 py-3 text-[14px] font-semibold text-[var(--bg)]"
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  async function finishSession(activeTaskId: string, skippedBreakCount: number) {
    completeFocusTask(activeTaskId);
    await syncTasks();
    triggerCelebration(
      skippedBreakCount > 0
        ? 'You pushed beyond the planned breaks and still finished strong.'
        : 'Focus session complete. The task is marked done.'
    );
  }
}

function BreathingGuide({
  themeRgb,
  stepLabel,
  stepRemaining,
}: {
  themeRgb: string;
  stepLabel: string;
  stepRemaining: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="dayflow-breath-square-wrap">
        <div className="dayflow-breath-square" style={{ borderColor: `rgba(${themeRgb}, 0.78)` }}>
          <div className="dayflow-breath-float" style={{ color: `rgb(${themeRgb})`, textShadow: `0 0 22px rgba(${themeRgb}, 0.36)` }}>
            {stepLabel}
          </div>
          <div className="dayflow-breath-count">{Math.ceil(stepRemaining)}</div>
        </div>
      </div>
    </div>
  );
}

function buildCycleBars(session: FocusSession | null) {
  if (!session) return [];

  const bars: Array<{
    key: string;
    short: string;
    label: string;
    focusMinutes: number;
    breakMinutes: number;
    focusState: string;
    breakState: string;
  }> = [];

  for (let index = 0, cycle = 1; index < session.segments.length; index += 1) {
    const focusSegment = session.segments[index];
    if (focusSegment.type !== 'focus') continue;

    const breakSegment = session.segments[index + 1]?.type === 'break' ? session.segments[index + 1] : null;
    const focusState =
      session.currentSegmentIndex > index || session.completed ? 'done' : session.currentSegmentIndex === index ? 'current-focus' : 'upcoming';
    const breakState = breakSegment
      ? session.skippedBreakIndices.includes(index + 1)
        ? 'skipped'
        : session.currentSegmentIndex > index + 1 || session.completed
          ? 'done'
          : session.currentSegmentIndex === index + 1
            ? 'current-break'
            : 'upcoming'
      : 'none';

    bars.push({
      key: `cycle-${cycle}`,
      short: `Block ${cycle}`,
      label: `${focusSegment.durationSec / 60} min focus${breakSegment ? ` + ${breakSegment.durationSec / 60} min break` : ''}`,
      focusMinutes: focusSegment.durationSec / 60,
      breakMinutes: breakSegment ? breakSegment.durationSec / 60 : 0,
      focusState,
      breakState,
    });

    if (breakSegment) index += 1;
    cycle += 1;
  }

  return bars;
}

function breakTipForSegment(segmentIndex: number) {
  return BREAK_TIPS[segmentIndex % BREAK_TIPS.length];
}

function getBreakPhaseState(session: FocusSession, now: number) {
  const currentSegment = session.segments[session.currentSegmentIndex];
  if (!currentSegment || currentSegment.type !== 'break') {
    return { label: 'Inhale', remaining: 5 };
  }

  const elapsedSeconds = session.paused
    ? Math.max(0, currentSegment.durationSec - (session.pausedRemainingSec ?? currentSegment.durationSec))
    : Math.max(0, Math.floor((now - session.segmentStartedAt) / 1000));
  const cycleSeconds = elapsedSeconds % 20;
  const stepIndex = Math.floor(cycleSeconds / 5);
  const stepSeconds = cycleSeconds % 5;

  return {
    label: PHASE_STEPS[Math.min(stepIndex, PHASE_STEPS.length - 1)],
    remaining: 5 - stepSeconds,
  };
}

function playPattern(audioRef: MutableRefObject<AudioContext | null>, durationSec: number) {
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const context = audioRef.current ?? new AudioCtor();
    audioRef.current = context;

    if (context.state === 'suspended') {
      void context.resume();
    }

    const beeps = Math.max(1, Math.floor(durationSec / 1.8));

    for (let index = 0; index < beeps; index += 1) {
      const offset = index * 1.8;
      addAlarmTone(context, 720, 0.32, offset);
      addAlarmTone(context, 960, 0.22, offset + 0.38);
    }
  } catch {
    // best effort only
  }
}

function addAlarmTone(context: AudioContext, frequency: number, duration: number, offset: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + offset;
  const end = start + duration;

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(520, frequency - 120), end);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.22, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
}

function stopAudio(audioRef: MutableRefObject<AudioContext | null>) {
  try {
    audioRef.current?.close();
  } catch {
    // ignore
  } finally {
    audioRef.current = null;
  }
}

function stopBreakAudio(audioRef: MutableRefObject<HTMLAudioElement | null>) {
  if (!audioRef.current) return;
  audioRef.current.pause();
  audioRef.current.currentTime = 0;
}