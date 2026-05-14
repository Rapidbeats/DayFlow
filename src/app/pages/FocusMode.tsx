import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock3,
  Minimize2,
  Music,
  Pause,
  Play,
  SkipForward,
  TimerReset,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  BREAK_TRACKS,
  clearFocusSession,
  completeFocusTask,
  createFocusSession,
  findFocusTask,
  FOCUS_SESSION_UPDATED_EVENT,
  formatClock,
  getActiveFocusSession,
  getAudioPrefs,
  getCompletedFocusMinutes,
  getCompletedSessionMinutes,
  getFocusProgress,
  getTotalSessionMinutes,
  LOFI_TRACKS,
  markMidpointCuePlayed,
  moveToNextFocusSegment,
  pauseFocusSession,
  phaseLabel,
  pickRandomTrack,
  RAIN_TRACKS,
  resumeFocusSession,
  saveAudioPrefs,
  sessionSummaryLabel,
  shouldShowMidpointCue,
  skipCurrentBreak,
  snoozeFocusSession,
  type FocusAudioCategory,
  type FocusAudioPrefs,
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
  'Relax your shoulders and loosen the jaw.',
  'Stand up for a minute and let your breathing settle.',
  'Walk a few steps. Motion helps attention recover.',
  'A small reset now buys sharper focus later.',
];

const FOCUS_QUOTES = [
  'Stay locked in. Great things take time.',
  'One block at a time. You are building something real.',
  'Deep work compounds. Keep going.',
  'The best time to focus is now.',
  'Consistency grows quietly. Keep the block alive.',
  'You chose this session. See it through.',
];

const PHASE_STEPS = ['Inhale', 'Hold', 'Exhale', 'Hold'] as const;

export default function FocusMode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');

  const [session, setSession] = useState<FocusSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [alertState, setAlertState] = useState<AlertState>(null);
  const [audioPrefs, setAudioPrefs] = useState<FocusAudioPrefs>(getAudioPrefs);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [quoteIndex] = useState(() => Math.floor(Math.random() * FOCUS_QUOTES.length));

  const { syncTasks, refreshTasks } = useAuth();
  const alarmCtxRef = useRef<AudioContext | null>(null);
  const focusAudioRef = useRef<HTMLAudioElement | null>(null);
  const breakAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeTrackSegmentRef = useRef<number>(-1);

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
  }, [navigate, refreshTasks, syncTasks, taskId]);

  useEffect(() => {
    const syncSession = () => {
      setSession(getActiveFocusSession());
      setLoading(false);
    };

    window.addEventListener(FOCUS_SESSION_UPDATED_EVENT, syncSession as EventListener);
    return () => window.removeEventListener(FOCUS_SESSION_UPDATED_EVENT, syncSession as EventListener);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      stopAlarmAudio(alarmCtxRef);
      stopTrackAudio(focusAudioRef);
      stopTrackAudio(breakAudioRef);
    };
  }, []);

  useEffect(() => {
    const segmentType = session?.segments[session.currentSegmentIndex]?.type;
    const canPlayAudio = Boolean(session && !session.completed && !session.paused && audioPrefs.enabled && !alertState?.visible);

    if (!canPlayAudio || !segmentType) {
      stopTrackAudio(focusAudioRef);
      stopTrackAudio(breakAudioRef);
      activeTrackSegmentRef.current = -1;
      return;
    }

    const targetRef = segmentType === 'focus' ? focusAudioRef : breakAudioRef;
    const otherRef = segmentType === 'focus' ? breakAudioRef : focusAudioRef;
    stopTrackAudio(otherRef);

    if (activeTrackSegmentRef.current !== session!.currentSegmentIndex || !targetRef.current) {
      stopTrackAudio(targetRef);
      const source =
        segmentType === 'focus'
          ? pickRandomTrack(audioPrefs.category === 'rain' ? RAIN_TRACKS : LOFI_TRACKS)
          : pickRandomTrack(BREAK_TRACKS);
      const audio = new Audio(source);
      audio.loop = true;
      audio.volume = audioPrefs.volume;
      targetRef.current = audio;
      activeTrackSegmentRef.current = session!.currentSegmentIndex;
      void audio.play().catch(() => undefined);
      return;
    }

    targetRef.current.volume = audioPrefs.volume;
  }, [alertState?.visible, audioPrefs, session]);

  useEffect(() => {
    if (!session || session.paused || alertState?.visible) return;

    if (shouldShowMidpointCue(session, now)) {
      const nextSession = markMidpointCuePlayed(session);
      setSession(nextSession);
      void syncTasks();
      setAlertState({ type: 'midpoint', visible: true });
      playAlarm(alarmCtxRef, 15);
      window.setTimeout(() => {
        setAlertState((current) => (current?.type === 'midpoint' ? null : current));
      }, 2500);
      return;
    }

    const { remainingSec } = getFocusProgress(session, now);
    if (remainingSec > 0) return;

    const currentSegment = session.segments[session.currentSegmentIndex];
    const nextSession = moveToNextFocusSegment(session);
    activeTrackSegmentRef.current = -1;
    setSession(nextSession);
    void syncTasks();

    if (nextSession.completed) {
      stopTrackAudio(focusAudioRef);
      stopTrackAudio(breakAudioRef);
      void finishSession(nextSession.taskId, nextSession.skippedBreakIndices.length);
      setAlertState({
        type: 'complete',
        visible: true,
        title: 'Session complete',
        message:
          nextSession.skippedBreakIndices.length > 0
            ? 'You pushed through and finished strong.'
            : 'The final block is done. Task marked complete.',
      });
      playAlarm(alarmCtxRef, 18);
      return;
    }

    const nextSegment = nextSession.segments[nextSession.currentSegmentIndex];
    setAlertState({
      type: 'phase-end',
      visible: true,
      title: nextSegment.type === 'break' ? 'Break started' : 'Back to focus',
      message:
        currentSegment.type === 'focus'
          ? `${breakTipForSegment(nextSession.currentSegmentIndex)} Your 8 minute reset starts now.`
          : 'Recovery done. Time for the next focus block.',
    });
    playAlarm(alarmCtxRef, 30);
  }, [alertState?.visible, now, session, syncTasks]);

  const theme = getTheme(session?.themeId || 'emerald');
  const accentRgb = theme.rgb;
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
  const totalFocusMinutes = session
    ? session.segments.filter((segment) => segment.type === 'focus').reduce((sum, segment) => sum + segment.durationSec / 60, 0)
    : 0;
  const totalBreakMinutes = Math.max(totalSessionMinutes - totalFocusMinutes, 0);
  const remainingFocusMinutes = session ? Math.max(totalFocusMinutes - completedFocusMinutes, 0) : 0;
  const remainingRuntimeMinutes = session ? Math.max(totalSessionMinutes - completedSessionMinutes, 0) : 0;
  const runtimeProgressPct = totalSessionMinutes > 0 ? (completedSessionMinutes / totalSessionMinutes) * 100 : 0;
  const ringCircumference = 2 * Math.PI * 164;
  const ringOffset = ringCircumference - ringCircumference * progress.progress;
  const currentModeLabel = showBreakUi ? 'Break Time' : 'Focus Time';
  const statusItems = [
    { label: 'Completed today', value: `${cycleBars.filter((bar) => bar.focusState === 'done').length} / ${cycleBars.length} blocks` },
    { label: 'Focus time', value: `${Math.round(completedFocusMinutes)}m done` },
    { label: 'Remaining', value: `${Math.max(Math.ceil(remainingFocusMinutes), 0)}m focus` },
    { label: 'Session', value: showBreakUi ? 'On break' : session?.paused ? 'Paused' : 'Active' },
  ];

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-5 py-10">
        <div className="dayflow-surface-card w-full max-w-lg p-8 text-center">
          <p className="dayflow-body">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-5 py-10">
        <div className="dayflow-surface-card w-full max-w-lg p-8 text-center">
          <h1 className="dayflow-h1">No active focus session</h1>
          <p className="dayflow-body mt-3">Start Focus Mode from an eligible task.</p>
          <button type="button" onClick={() => navigate('/tasks')} className="dayflow-primary-button mt-6">
            Back to tasks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="dayflow-focus-shell min-h-[calc(100vh-96px)] overflow-hidden rounded-[32px]"
      style={{
        background: `radial-gradient(circle at top, rgba(${accentRgb}, 0.18), transparent 30%), linear-gradient(180deg, #09111c 0%, #081018 100%)`,
        border: `1px solid rgba(${accentRgb}, 0.16)`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-0 pt-5 md:px-6 md:pt-6">
        <div>
          <div className="text-[11px] font-[700] uppercase tracking-[0.22em]" style={{ color: `rgb(${accentRgb})` }}>
            Focus Mode
          </div>
          <h1 className="mt-1 text-[22px] font-[800] tracking-[-0.03em] text-white">{session.taskName}</h1>
          <p className="mt-1 text-[13px] text-white/42">
            {phaseLabel(session)} - {sessionSummaryLabel(session)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              stopAlarmAudio(alarmCtxRef);
              stopTrackAudio(focusAudioRef);
              stopTrackAudio(breakAudioRef);
              navigate('/');
            }}
            className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:bg-white/10"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Minimize
          </button>
          <button
            type="button"
            onClick={() => {
              stopAlarmAudio(alarmCtxRef);
              stopTrackAudio(focusAudioRef);
              stopTrackAudio(breakAudioRef);
              clearFocusSession(session.taskId);
              void syncTasks();
              navigate('/tasks');
            }}
            className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
            Exit
          </button>
        </div>
      </div>

      <div className="px-5 pt-5 md:px-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30">Progress Timeline</span>
          <span className="text-[12px] font-[600]" style={{ color: `rgb(${accentRgb})` }}>
            {Math.max(Math.ceil(remainingRuntimeMinutes), 0)}m left
          </span>
        </div>
        <div className="dayflow-focus-cycle-grid">
          {cycleBars.map((bar) => {
            const isCurrent = bar.focusState === 'current-focus' || bar.breakState === 'current-break';
            return (
              <div
                key={bar.key}
                className="dayflow-focus-cycle-card"
                style={{
                  borderColor: isCurrent ? `rgba(${accentRgb}, 0.34)` : 'rgba(255,255,255,0.07)',
                  background: isCurrent ? `linear-gradient(135deg, rgba(${accentRgb},0.15), rgba(255,255,255,0.04))` : 'rgba(255,255,255,0.03)',
                }}
              >
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
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="dayflow-focus-hero">
          <div className="dayflow-focus-hero-glow" style={{ background: `radial-gradient(circle, rgba(${accentRgb},0.24) 0%, transparent 66%)` }} />
          <div className="dayflow-focus-badge" style={{ borderColor: `rgba(${accentRgb},0.22)`, color: `rgb(${accentRgb})` }}>
            {showBreakUi ? 'Reset Break' : 'Deep Focus'}
          </div>

          <div className="dayflow-focus-ring-wrap">
            <svg viewBox="0 0 380 380" className="dayflow-focus-ring-svg" aria-hidden="true">
              <circle cx="190" cy="190" r="164" className="dayflow-focus-ring-track" />
              <circle
                cx="190"
                cy="190"
                r="164"
                className="dayflow-focus-ring-progress"
                style={{
                  stroke: `rgb(${accentRgb})`,
                  strokeDasharray: ringCircumference,
                  strokeDashoffset: ringOffset,
                  filter: `drop-shadow(0 0 16px rgba(${accentRgb},0.45))`,
                }}
              />
            </svg>

            <div className="dayflow-focus-ring-content">
              <div className="dayflow-focus-ring-time">{formatClock(progress.remainingSec)}</div>
              <div className="dayflow-focus-ring-label">{currentModeLabel}</div>
              <div className="dayflow-focus-audio-bars" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    key={index}
                    className={`dayflow-focus-audio-bar ${audioPrefs.enabled && !session.paused ? 'is-playing' : ''}`}
                    style={{ animationDelay: `${index * 0.12}s`, background: `rgba(${accentRgb}, ${0.4 + index * 0.1})` }}
                  />
                ))}
              </div>
              {showBreakUi ? (
                <div className="dayflow-focus-break-copy">
                  <div className="dayflow-focus-break-phase">{breakPhase.label}</div>
                  <div className="dayflow-focus-break-tip">{breakTipForSegment(session.currentSegmentIndex)}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="dayflow-focus-pause-wrap">
            <button
              type="button"
              onClick={() => {
                if (session.paused) {
                  setSession(resumeFocusSession(session, session.pausedRemainingSec || progress.remainingSec));
                } else {
                  setSession(pauseFocusSession(session, progress.remainingSec));
                }
                void syncTasks();
              }}
              className="dayflow-focus-pause-button"
              style={{ borderColor: `rgba(${accentRgb},0.35)`, boxShadow: `0 0 24px rgba(${accentRgb},0.18)` }}
            >
              {session.paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </button>
          </div>

          <div className="dayflow-focus-quote">
            <span style={{ color: `rgb(${accentRgb})` }}>+</span>
            {showBreakUi ? `${breakPhase.label} for ${Math.ceil(breakPhase.remaining)}s, then flow onward.` : FOCUS_QUOTES[quoteIndex]}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30">Session Status</div>
            <div className="mt-2 text-[28px] font-[800] tracking-[-0.04em] text-white">{Math.max(Math.ceil(remainingRuntimeMinutes), 0)}m remaining</div>
            <div className="mt-1 text-[13px] text-white/40">
              {Math.round(totalFocusMinutes)}m focus - {Math.round(totalBreakMinutes)}m breaks - {Math.round(totalSessionMinutes)}m total
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.min(100, Math.max(0, runtimeProgressPct))}%`,
                  background: `linear-gradient(90deg, rgba(${accentRgb},0.75), rgb(${accentRgb}))`,
                }}
              />
            </div>
            <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/35">
              <Clock3 className="h-3.5 w-3.5" />
              {Math.max(Math.ceil(remainingFocusMinutes), 0)}m of focus work remains
            </div>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30">Controls</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (session.paused) {
                    setSession(resumeFocusSession(session, session.pausedRemainingSec || progress.remainingSec));
                  } else {
                    setSession(pauseFocusSession(session, progress.remainingSec));
                  }
                  void syncTasks();
                }}
                className="flex items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-white/6 px-4 py-3 text-[13px] font-[600] text-white transition hover:bg-white/10"
              >
                {session.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {session.paused ? 'Resume' : 'Pause'}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopAlarmAudio(alarmCtxRef);
                  stopTrackAudio(focusAudioRef);
                  stopTrackAudio(breakAudioRef);
                  navigate('/');
                }}
                className="flex items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-white/6 px-4 py-3 text-[13px] font-[600] text-white transition hover:bg-white/10"
              >
                <Minimize2 className="h-4 w-4" />
                Minimize
              </button>

              <button
                type="button"
                onClick={() => {
                  setSession(snoozeFocusSession(session, 120));
                  void syncTasks();
                }}
                className="flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[13px] font-[600] transition sm:col-span-2"
                style={{ background: `rgba(${accentRgb},0.15)`, border: `1px solid rgba(${accentRgb},0.25)`, color: `rgb(${accentRgb})` }}
              >
                <TimerReset className="h-4 w-4" />
                Snooze 2 min
              </button>

              {showBreakUi && (
                <button
                  type="button"
                  onClick={() => {
                    stopTrackAudio(breakAudioRef);
                    activeTrackSegmentRef.current = -1;
                    setSession(skipCurrentBreak(session));
                    setAlertState(null);
                    void syncTasks();
                  }}
                  className="flex items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-white/6 px-4 py-3 text-[13px] font-[600] text-white transition hover:bg-white/10 sm:col-span-2"
                >
                  <SkipForward className="h-4 w-4" />
                  Skip break
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  stopAlarmAudio(alarmCtxRef);
                  stopTrackAudio(focusAudioRef);
                  stopTrackAudio(breakAudioRef);
                  clearFocusSession(session.taskId);
                  void syncTasks();
                  navigate('/tasks');
                }}
                className="rounded-[14px] border border-red-400/20 bg-red-400/8 px-4 py-2.5 text-[13px] font-[500] text-red-400/75 transition hover:text-red-400 sm:col-span-2"
              >
                Stop session
              </button>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30">Audio</div>
              <button
                type="button"
                onClick={() => setShowAudioPanel((current) => !current)}
                className="flex items-center gap-1.5 rounded-[10px] bg-white/5 px-2.5 py-1.5 text-[11px] font-[600] text-white/40 transition hover:text-white/70"
              >
                <Music className="h-3 w-3" />
                {showAudioPanel ? 'Hide' : 'Settings'}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  updateAudioPrefs(audioPrefs, setAudioPrefs, { enabled: !audioPrefs.enabled }, () => {
                    stopTrackAudio(focusAudioRef);
                    stopTrackAudio(breakAudioRef);
                    activeTrackSegmentRef.current = -1;
                  })
                }
                className="flex shrink-0 items-center gap-1.5 text-[13px] text-white/60 transition hover:text-white"
              >
                {audioPrefs.enabled ? <Volume2 className="h-4 w-4" style={{ color: `rgb(${accentRgb})` }} /> : <VolumeX className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audioPrefs.volume}
                onChange={(event) => updateAudioPrefs(audioPrefs, setAudioPrefs, { volume: Number(event.target.value) })}
                disabled={!audioPrefs.enabled}
                className="flex-1"
                style={{ accentColor: `rgb(${accentRgb})` }}
              />
              <span className="w-9 shrink-0 text-right text-[12px] text-white/40">{Math.round(audioPrefs.volume * 100)}%</span>
            </div>

            {showAudioPanel && (
              <div className="mt-4 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/25">Focus audio</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['lofi', 'rain'] as FocusAudioCategory[]).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() =>
                        updateAudioPrefs(audioPrefs, setAudioPrefs, { category }, () => {
                          stopTrackAudio(focusAudioRef);
                          stopTrackAudio(breakAudioRef);
                          activeTrackSegmentRef.current = -1;
                        })
                      }
                      className="rounded-[12px] px-3 py-2.5 text-[13px] font-[600] transition"
                      style={{
                        background: audioPrefs.category === category ? `rgba(${accentRgb},0.2)` : 'rgba(255,255,255,0.05)',
                        border: audioPrefs.category === category ? `1px solid rgba(${accentRgb},0.4)` : '1px solid rgba(255,255,255,0.08)',
                        color: audioPrefs.category === category ? `rgb(${accentRgb})` : 'rgba(255,255,255,0.45)',
                      }}
                    >
                      {category === 'lofi' ? 'Lofi' : 'Rain'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-5 text-white/25">Break playlist plays automatically during recovery breaks.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="px-5 pb-5 md:px-6 md:pb-6">
        <div className="dayflow-focus-stats-grid">
          {statusItems.map((stat) => (
            <div key={stat.label} className="dayflow-focus-stat-card">
              <div className="dayflow-focus-stat-label">{stat.label}</div>
              <div className="dayflow-focus-stat-value">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {alertState?.type === 'midpoint' && (
        <div className="fixed inset-x-0 top-[100px] z-[220] flex justify-center px-4">
          <div className="rounded-[18px] px-6 py-4 text-center shadow-2xl" style={{ background: 'rgba(10,15,28,0.96)', border: `1px solid rgba(${accentRgb},0.3)` }}>
            <div className="text-[12px] font-[800] uppercase tracking-[0.2em]" style={{ color: `rgb(${accentRgb})` }}>
              Midpoint
            </div>
            <div className="mt-1 text-[14px] text-white/80">Halfway through. Keep going.</div>
            <button
              type="button"
              onClick={() => {
                stopAlarmAudio(alarmCtxRef);
                setAlertState(null);
              }}
              className="mt-3 rounded-[12px] px-4 py-2 text-[12px] font-[600] text-white transition hover:opacity-80"
              style={{ background: `rgba(${accentRgb},0.2)` }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {alertState && alertState.type !== 'midpoint' && alertState.visible && (
        <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#0d1220] p-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/30">Focus alert</div>
            <h3 className="mt-2 text-[20px] font-[800] text-white">{alertState.title}</h3>
            <p className="mt-2 text-[14px] leading-6 text-white/50">{alertState.message}</p>
            <div className={`mt-5 grid gap-2 ${showBreakUi && alertState.type === 'phase-end' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {showBreakUi && alertState.type === 'phase-end' && (
                <button
                  type="button"
                  onClick={() => {
                    stopAlarmAudio(alarmCtxRef);
                    stopTrackAudio(breakAudioRef);
                    activeTrackSegmentRef.current = -1;
                    setSession(skipCurrentBreak(session));
                    void syncTasks();
                    setAlertState(null);
                  }}
                  className="rounded-[14px] border border-white/15 px-4 py-3 text-[13px] font-[600] text-white/70 transition hover:bg-white/8"
                >
                  Skip break
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  stopAlarmAudio(alarmCtxRef);
                  setSession(snoozeFocusSession(session, 120));
                  void syncTasks();
                  setAlertState(null);
                }}
                className="rounded-[14px] px-4 py-3 text-[13px] font-[600] text-white transition"
                style={{ background: `rgba(${accentRgb},0.15)`, border: `1px solid rgba(${accentRgb},0.25)` }}
              >
                Snooze 2 min
              </button>
              <button
                type="button"
                onClick={() => {
                  stopAlarmAudio(alarmCtxRef);
                  if (alertState.type === 'complete') {
                    clearFocusSession(session.taskId);
                    void syncTasks();
                    navigate('/tasks');
                    return;
                  }
                  setAlertState(null);
                }}
                className="rounded-[14px] px-4 py-3 text-[13px] font-[700] transition"
                style={{ background: `rgb(${accentRgb})`, color: '#080c14' }}
              >
                {alertState.type === 'complete' ? 'Done' : 'Continue'}
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
      skippedBreakCount > 0 ? 'You pushed beyond the planned breaks and still finished strong.' : 'Focus session complete. The task is marked done.'
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
    <div className="dayflow-focus-break-guide">
      <div className="dayflow-focus-break-phase" style={{ color: `rgb(${themeRgb})` }}>
        {stepLabel}
      </div>
      <div className="dayflow-focus-break-count">{Math.ceil(stepRemaining)}</div>
    </div>
  );
}

function buildCycleBars(session: FocusSession | null) {
  if (!session) return [];

  const bars: Array<{
    key: string;
    short: string;
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
  if (!currentSegment || currentSegment.type !== 'break') return { label: 'Inhale', remaining: 5 };

  const elapsedSeconds = session.paused
    ? Math.max(0, currentSegment.durationSec - (session.pausedRemainingSec ?? currentSegment.durationSec))
    : Math.max(0, Math.floor((now - session.segmentStartedAt) / 1000));
  const cycleSeconds = elapsedSeconds % 20;

  return {
    label: PHASE_STEPS[Math.min(Math.floor(cycleSeconds / 5), PHASE_STEPS.length - 1)],
    remaining: 5 - (cycleSeconds % 5),
  };
}

function updateAudioPrefs(
  current: FocusAudioPrefs,
  setPrefs: (prefs: FocusAudioPrefs) => void,
  patch: Partial<FocusAudioPrefs>,
  onCategoryLikeChange?: () => void
) {
  const next = { ...current, ...patch };
  setPrefs(next);
  saveAudioPrefs(next);
  if (patch.category || patch.enabled === false) {
    onCategoryLikeChange?.();
  }
}

function playAlarm(audioRef: MutableRefObject<AudioContext | null>, durationSec: number) {
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const context = audioRef.current ?? new AudioCtor();
    audioRef.current = context;
    if (context.state === 'suspended') void context.resume();

    const beeps = Math.max(1, Math.floor(durationSec / 1.8));
    for (let index = 0; index < beeps; index += 1) {
      addAlarmTone(context, 720, 0.32, index * 1.8);
      addAlarmTone(context, 960, 0.22, index * 1.8 + 0.38);
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

function stopAlarmAudio(audioRef: MutableRefObject<AudioContext | null>) {
  try {
    audioRef.current?.close();
  } catch {
    // ignore
  } finally {
    audioRef.current = null;
  }
}

function stopTrackAudio(audioRef: MutableRefObject<HTMLAudioElement | null>) {
  if (!audioRef.current) return;
  audioRef.current.pause();
  audioRef.current.currentTime = 0;
  audioRef.current = null;
}
