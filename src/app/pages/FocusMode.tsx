import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Minimize2, Music, Pause, Play, SkipForward, TimerReset, Volume2, VolumeX, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import {
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
  markMidpointCuePlayed,
  moveToNextFocusSegment,
  pauseFocusSession,
  phaseLabel,
  pickRandomTrack,
  resumeFocusSession,
  saveAudioPrefs,
  sessionSummaryLabel,
  shouldShowMidpointCue,
  skipCurrentBreak,
  snoozeFocusSession,
  LOFI_TRACKS,
  RAIN_TRACKS,
  BREAK_TRACKS,
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
  'Take ten slow shoulder rolls and loosen the neck.',
  'Stand up and let your breathing settle before the next block.',
  'Walk a few steps. Motion helps attention recover.',
  'Small recovery now usually buys better focus later.',
];

const FOCUS_QUOTES = [
  'Stay locked in. Great things take time.',
  'One block at a time. You are building something real.',
  'Deep work compounds. Keep going.',
  'The best time to focus is now.',
  'Distraction is the enemy of excellence.',
  'You chose this. See it through.',
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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const focusAudioRef = useRef<HTMLAudioElement | null>(null);
  const breakAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioSegmentRef = useRef<number>(-1);

  const { syncTasks, refreshTasks } = useAuth();

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    void refreshTasks().then(() => {
      let nextSession = getActiveFocusSession();
      if (taskId) {
        const task = findFocusTask(taskId);
        if (!task) { navigate('/tasks'); return; }
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
    const syncSession = () => setSession(getActiveFocusSession());
    window.addEventListener(FOCUS_SESSION_UPDATED_EVENT, syncSession as EventListener);
    return () => window.removeEventListener(FOCUS_SESSION_UPDATED_EVENT, syncSession as EventListener);
  }, []);

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // ── Audio: focus block ────────────────────────────────────────────────────
  useEffect(() => {
    const isFocusLive =
      Boolean(session) && !session?.completed && !session?.paused &&
      session?.segments[session.currentSegmentIndex]?.type === 'focus';
    if (!isFocusLive || !audioPrefs.enabled) { stopTrackAudio(focusAudioRef); return; }
    if (audioSegmentRef.current !== session!.currentSegmentIndex) {
      stopTrackAudio(focusAudioRef);
      const tracks = audioPrefs.category === 'rain' ? RAIN_TRACKS : LOFI_TRACKS;
      const audio = new Audio(pickRandomTrack(tracks));
      audio.loop = true; audio.volume = audioPrefs.volume;
      focusAudioRef.current = audio;
      audioSegmentRef.current = session!.currentSegmentIndex;
      void audio.play().catch(() => undefined);
    } else if (focusAudioRef.current) { focusAudioRef.current.volume = audioPrefs.volume; }
  }, [session, audioPrefs]);

  // ── Audio: break block ────────────────────────────────────────────────────
  useEffect(() => {
    const isBreakLive =
      Boolean(session) && !session?.completed && !session?.paused &&
      session?.segments[session.currentSegmentIndex]?.type === 'break';
    if (!isBreakLive || !audioPrefs.enabled) { stopTrackAudio(breakAudioRef); return; }
    if (audioSegmentRef.current !== session!.currentSegmentIndex) {
      stopTrackAudio(breakAudioRef);
      const audio = new Audio(pickRandomTrack(BREAK_TRACKS));
      audio.loop = true; audio.volume = audioPrefs.volume;
      breakAudioRef.current = audio;
      audioSegmentRef.current = session!.currentSegmentIndex;
      void audio.play().catch(() => undefined);
    } else if (breakAudioRef.current) { breakAudioRef.current.volume = audioPrefs.volume; }
  }, [session, audioPrefs]);

  // ── Pause/resume audio ───────────────────────────────────────────────────
  useEffect(() => {
    if (session?.paused) {
      focusAudioRef.current?.pause();
      breakAudioRef.current?.pause();
    } else {
      const segType = session?.segments[session.currentSegmentIndex]?.type;
      if (segType === 'focus' && focusAudioRef.current) void focusAudioRef.current.play().catch(() => undefined);
      if (segType === 'break' && breakAudioRef.current) void breakAudioRef.current.play().catch(() => undefined);
    }
  }, [session?.paused, session]);

  useEffect(() => () => { stopAudio(audioCtxRef); stopTrackAudio(focusAudioRef); stopTrackAudio(breakAudioRef); }, []);

  // ── Timer / midpoint / segment logic ─────────────────────────────────────
  useEffect(() => {
    if (!session || session.paused || alertState?.visible) return;
    if (shouldShowMidpointCue(session, now)) {
      const nextSession = markMidpointCuePlayed(session);
      setSession(nextSession); void syncTasks();
      setAlertState({ type: 'midpoint', visible: true });
      playPattern(audioCtxRef, 15);
      window.setTimeout(() => setAlertState((c) => c?.type === 'midpoint' ? null : c), 2500);
      return;
    }
    const { remainingSec } = getFocusProgress(session, now);
    if (remainingSec > 0) return;
    const currentSegment = session.segments[session.currentSegmentIndex];
    const nextSession = moveToNextFocusSegment(session);
    audioSegmentRef.current = -1;
    setSession(nextSession); void syncTasks();
    if (nextSession.completed) {
      stopTrackAudio(focusAudioRef); stopTrackAudio(breakAudioRef);
      void finishSession(nextSession.taskId, nextSession.skippedBreakIndices.length);
      setAlertState({ type: 'complete', visible: true, title: 'Session complete',
        message: nextSession.skippedBreakIndices.length > 0 ? 'You pushed through and finished strong.' : 'The final block is done. Task marked complete.' });
      playPattern(audioCtxRef, 18); return;
    }
    const nextSegment = nextSession.segments[nextSession.currentSegmentIndex];
    setAlertState({ type: 'phase-end', visible: true,
      title: nextSegment.type === 'break' ? 'Break started' : 'Back to focus',
      message: currentSegment.type === 'focus' ? breakTipForSegment(nextSession.currentSegmentIndex) : 'Recovery done. Time for the next block.' });
    playPattern(audioCtxRef, 30);
  }, [alertState?.visible, now, session, syncTasks]);

  // ── Derived values ────────────────────────────────────────────────────────
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
  const totalFocusOnlyMinutes = session
    ? session.segments.filter((s) => s.type === 'focus').reduce((sum, s) => sum + s.durationSec / 60, 0) : 0;
  const totalBreakMinutes = Math.max(totalSessionMinutes - totalFocusOnlyMinutes, 0);
  const remainingFocusMinutes = session ? Math.max(session.totalMinutes - completedFocusMinutes, 0) : 0;
  const remainingRuntimeMinutes = session ? Math.max(totalSessionMinutes - completedSessionMinutes, 0) : 0;

  // SVG ring values
  const RING_R = 140;
  const RING_CIRCUM = 2 * Math.PI * RING_R;
  const ringOffset = RING_CIRCUM - progress.progress * RING_CIRCUM;

  if (loading || !session) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-5 py-10">
        <div className="dayflow-surface-card w-full max-w-lg p-8 text-center">
          {loading ? <p className="dayflow-body">Loading session…</p> : (
            <>
              <h1 className="dayflow-h1">No active focus session</h1>
              <p className="dayflow-body mt-3">Start Focus Mode from an eligible task.</p>
              <button type="button" onClick={() => navigate('/tasks')} className="dayflow-primary-button mt-6">Back to tasks</button>
            </>
          )}
        </div>
      </div>
    );
  }

  function updateAudioPrefs(patch: Partial<FocusAudioPrefs>) {
    const next = { ...audioPrefs, ...patch };
    setAudioPrefs(next); saveAudioPrefs(next);
    if (patch.category && patch.category !== audioPrefs.category) {
      audioSegmentRef.current = -1;
      stopTrackAudio(focusAudioRef); stopTrackAudio(breakAudioRef);
    }
  }

  const accentRgb = theme.rgb;

  return (
    <div
      className="dayflow-focus-shell min-h-[calc(100vh-96px)] rounded-[32px] overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 70% 0%, rgba(${accentRgb}, 0.18) 0%, transparent 60%), linear-gradient(180deg, #080c14 0%, #0a0f1c 100%)`,
        border: `1px solid rgba(${accentRgb}, 0.15)`,
      }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-0">
        <div>
          <div className="text-[11px] font-[700] uppercase tracking-[0.22em]" style={{ color: `rgb(${accentRgb})` }}>
            Focus Mode
          </div>
          <h1 className="mt-1 text-[22px] font-[800] tracking-[-0.03em] text-white">{session.taskName}</h1>
          <p className="mt-0.5 text-[13px] text-white/40">{phaseLabel(session)} · {sessionSummaryLabel(session)}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { stopAudio(audioCtxRef); stopTrackAudio(focusAudioRef); stopTrackAudio(breakAudioRef); navigate('/'); }}
            className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:bg-white/10">
            <Minimize2 className="h-3.5 w-3.5" /> Minimize
          </button>
          <button type="button" onClick={() => { stopTrackAudio(breakAudioRef); stopTrackAudio(focusAudioRef); clearFocusSession(session.taskId); void syncTasks(); navigate('/tasks'); }}
            className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:bg-white/10">
            <X className="h-3.5 w-3.5" /> Exit
          </button>
        </div>
      </div>

      {/* ── Block timeline ── */}
      <div className="px-6 pt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30">Progress Timeline</span>
          <span className="text-[12px] font-[600]" style={{ color: `rgb(${accentRgb})` }}>{Math.max(Math.ceil(remainingRuntimeMinutes), 0)}m left</span>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cycleBars.length}, minmax(0,1fr))` }}>
          {cycleBars.map((bar) => {
            const isCurrent = bar.focusState === 'current-focus' || bar.breakState === 'current-break';
            const isDone = bar.focusState === 'done';
            return (
              <div
                key={bar.key}
                className="rounded-[16px] p-3 transition-all"
                style={{
                  background: isCurrent
                    ? `linear-gradient(135deg, rgba(${accentRgb},0.18), rgba(${accentRgb},0.08))`
                    : 'rgba(255,255,255,0.04)',
                  border: isCurrent ? `1px solid rgba(${accentRgb},0.35)` : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-[700] uppercase tracking-[0.15em]" style={{ color: isCurrent ? `rgb(${accentRgb})` : 'rgba(255,255,255,0.35)' }}>
                    {bar.short}
                  </span>
                  <span className="text-[11px] text-white/30">{bar.focusMinutes}m{bar.breakMinutes > 0 ? ` / ${bar.breakMinutes}m` : ''}</span>
                </div>
                <div className="flex gap-1.5 h-2 rounded-full overflow-hidden">
                  <div
                    className="rounded-full transition-all"
                    style={{
                      flex: `${bar.focusMinutes} 1 0%`,
                      background: isDone || bar.focusState === 'current-focus'
                        ? `rgb(${accentRgb})`
                        : 'rgba(255,255,255,0.12)',
                    }}
                  />
                  {bar.breakMinutes > 0 && (
                    <div
                      className="rounded-full transition-all"
                      style={{
                        flex: `${bar.breakMinutes} 1 0%`,
                        background: bar.breakState === 'done' ? `rgba(${accentRgb},0.5)`
                          : bar.breakState === 'current-break' ? `rgba(${accentRgb},0.7)`
                          : bar.breakState === 'skipped' ? 'rgba(255,255,255,0.06)'
                          : 'rgba(255,255,255,0.08)',
                      }}
                    />
                  )}
                </div>
                {isCurrent && (
                  <div className="mt-2 text-[10px] font-[600] uppercase tracking-[0.15em]" style={{ color: `rgba(${accentRgb},0.8)` }}>
                    {bar.breakState === 'current-break' ? 'Break' : 'Current'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="grid gap-5 p-6 lg:grid-cols-[1fr_360px]">

        {/* ── Timer panel ── */}
        <div
          className="relative flex flex-col items-center justify-center rounded-[24px] overflow-hidden py-10"
          style={{
            background: `radial-gradient(ellipse at center top, rgba(${accentRgb},0.13) 0%, transparent 65%), rgba(255,255,255,0.02)`,
            border: '1px solid rgba(255,255,255,0.07)',
            minHeight: '420px',
          }}
        >
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(circle at 50% 45%, rgba(${accentRgb},0.09) 0%, transparent 60%)` }}
          />

          {showBreakUi ? (
            <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-sm px-6">
              <div className="text-[11px] font-[700] uppercase tracking-[0.22em] text-white/40">Recovery Break</div>
              <BreathingGuide themeRgb={accentRgb} stepLabel={breakPhase.label} stepRemaining={breakPhase.remaining} />
              <div className="w-full">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, progress.progress * 100))}%`, background: `rgb(${accentRgb})` }} />
                </div>
                <div className="mt-2 text-center text-[13px] text-white/40">{formatClock(progress.remainingSec)} remaining</div>
              </div>
              <p className="text-center text-[14px] leading-6 text-white/50">{breakTipForSegment(session.currentSegmentIndex)}</p>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="text-[11px] font-[700] uppercase tracking-[0.22em] text-white/40">Deep Focus</div>

              {/* Circular timer */}
              <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
                <svg width="320" height="320" className="absolute inset-0 -rotate-90">
                  {/* Track */}
                  <circle cx="160" cy="160" r={RING_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                  {/* Progress */}
                  <circle
                    cx="160" cy="160" r={RING_R} fill="none"
                    stroke={`rgb(${accentRgb})`} strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUM}
                    strokeDashoffset={ringOffset}
                    style={{ transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 8px rgba(${accentRgb},0.7))` }}
                  />
                </svg>

                {/* Glow dot at tip */}
                <div
                  className="absolute"
                  style={{
                    width: 14, height: 14,
                    borderRadius: '50%',
                    background: `rgb(${accentRgb})`,
                    boxShadow: `0 0 16px 4px rgba(${accentRgb},0.8)`,
                    top: `${160 - RING_R * Math.cos(2 * Math.PI * progress.progress) - 7}px`,
                    left: `${160 + RING_R * Math.sin(2 * Math.PI * progress.progress) - 7}px`,
                  }}
                />

                {/* Inner content */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="text-[64px] font-[900] leading-none tracking-[-0.05em] text-white tabular-nums">
                    {formatClock(progress.remainingSec)}
                  </div>

                  {/* Audio visualizer bars */}
                  {audioPrefs.enabled && !session.paused && (
                    <div className="flex items-end gap-[3px] h-5">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-[3px] rounded-full"
                          style={{
                            background: `rgb(${accentRgb})`,
                            height: `${30 + Math.sin(Date.now() / 300 + i * 0.8) * 40}%`,
                            animation: `audioBar${i % 3} ${0.6 + i * 0.1}s ease-in-out infinite alternate`,
                            opacity: 0.7 + i * 0.04,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Pause/play button */}
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
                    className="flex items-center justify-center rounded-full border border-white/15 bg-white/8 transition hover:bg-white/15 active:scale-95"
                    style={{ width: 48, height: 48 }}
                  >
                    {session.paused
                      ? <Play className="h-5 w-5 text-white ml-0.5" />
                      : <Pause className="h-5 w-5 text-white" />}
                  </button>
                </div>
              </div>

              {/* Motivational quote bar */}
              <div
                className="flex items-center gap-2 rounded-[14px] px-5 py-3 text-[13px] text-white/60"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span style={{ color: `rgb(${accentRgb})` }}>⚡</span>
                {FOCUS_QUOTES[quoteIndex]}
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col gap-4">

          {/* Session status */}
          <div className="rounded-[20px] p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30">Session Status</div>
            <div className="mt-2 text-[28px] font-[800] tracking-[-0.04em] text-white">
              {Math.max(Math.ceil(remainingRuntimeMinutes), 0)}m remaining
            </div>
            <div className="mt-1 text-[13px] text-white/40">
              {Math.round(totalFocusOnlyMinutes)}m focus · {Math.round(totalBreakMinutes)}m breaks · {Math.round(totalSessionMinutes)}m total
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.min(100, Math.max(0, (completedSessionMinutes / totalSessionMinutes) * 100))}%`,
                  background: `linear-gradient(90deg, rgba(${accentRgb},0.7), rgb(${accentRgb}))`,
                }}
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-white/30">
              <span>⏱</span> {Math.max(Math.ceil(remainingFocusMinutes), 0)}m of focus work remains
            </div>
          </div>

          {/* Controls */}
          <div className="rounded-[20px] p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30 mb-3">Controls</div>
            <div className="grid grid-cols-2 gap-2">
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
                className="col-span-1 flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[13px] font-[600] text-white transition"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {session.paused ? <><Play className="h-4 w-4" /> Resume</> : <><Pause className="h-4 w-4" /> Pause</>}
              </button>

              <button
                type="button"
                onClick={() => { stopAudio(audioCtxRef); stopTrackAudio(focusAudioRef); stopTrackAudio(breakAudioRef); navigate('/'); }}
                className="col-span-1 flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[13px] font-[600] text-white transition"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Minimize2 className="h-4 w-4" /> Minimize
              </button>

              <button
                type="button"
                onClick={() => { const n = snoozeFocusSession(session, 120); setSession(n); void syncTasks(); }}
                className="col-span-2 flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[13px] font-[600] transition"
                style={{ background: `rgba(${accentRgb},0.15)`, border: `1px solid rgba(${accentRgb},0.25)`, color: `rgb(${accentRgb})` }}
              >
                <TimerReset className="h-4 w-4" /> Snooze 2 min
              </button>

              {showBreakUi && (
                <button
                  type="button"
                  onClick={() => { stopTrackAudio(breakAudioRef); audioSegmentRef.current = -1; setSession(skipCurrentBreak(session)); setAlertState(null); void syncTasks(); }}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[13px] font-[600] text-white transition"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <SkipForward className="h-4 w-4" /> Skip break
                </button>
              )}

              <button
                type="button"
                onClick={() => { stopAudio(audioCtxRef); stopTrackAudio(focusAudioRef); stopTrackAudio(breakAudioRef); clearFocusSession(session.taskId); void syncTasks(); navigate('/tasks'); }}
                className="col-span-2 rounded-[14px] px-4 py-2.5 text-[13px] font-[500] text-red-400/70 transition hover:text-red-400"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                Stop session
              </button>
            </div>
          </div>

          {/* Audio */}
          <div className="rounded-[20px] p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30">Audio</div>
              <button
                type="button"
                onClick={() => setShowAudioPanel((v) => !v)}
                className="flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11px] font-[600] text-white/40 transition hover:text-white/70"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <Music className="h-3 w-3" /> {showAudioPanel ? 'Hide' : 'Settings'}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={() => updateAudioPrefs({ enabled: !audioPrefs.enabled })}
                className="flex shrink-0 items-center gap-1.5 text-[13px] text-white/60 transition hover:text-white">
                {audioPrefs.enabled ? <Volume2 className="h-4 w-4" style={{ color: `rgb(${accentRgb})` }} /> : <VolumeX className="h-4 w-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={audioPrefs.volume}
                onChange={(e) => updateAudioPrefs({ volume: Number(e.target.value) })}
                className="flex-1" disabled={!audioPrefs.enabled}
                style={{ accentColor: `rgb(${accentRgb})` }}
              />
              <span className="w-9 shrink-0 text-right text-[12px] text-white/40">{Math.round(audioPrefs.volume * 100)}%</span>
            </div>

            {showAudioPanel && (
              <div className="mt-4 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/25">Focus Audio</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['lofi', 'rain'] as FocusAudioCategory[]).map((cat) => (
                    <button key={cat} type="button" onClick={() => updateAudioPrefs({ category: cat })}
                      className="rounded-[12px] px-3 py-2.5 text-[13px] font-[600] transition"
                      style={{
                        background: audioPrefs.category === cat ? `rgba(${accentRgb},0.2)` : 'rgba(255,255,255,0.05)',
                        border: audioPrefs.category === cat ? `1px solid rgba(${accentRgb},0.4)` : '1px solid rgba(255,255,255,0.08)',
                        color: audioPrefs.category === cat ? `rgb(${accentRgb})` : 'rgba(255,255,255,0.45)',
                      }}>
                      {cat === 'lofi' ? '🎵 Lofi' : '🌧 Rain'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-5 text-white/25">Break Time playlist plays automatically during recovery breaks.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom stats bar ── */}
      <div
        className="mx-6 mb-6 grid grid-cols-4 divide-x rounded-[18px] overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', divideColor: 'rgba(255,255,255,0.07)' }}
      >
        {[
          { label: 'Completed today', value: `${cycleBars.filter(b => b.focusState === 'done').length} / ${cycleBars.length} blocks` },
          { label: 'Focus time', value: `${Math.round(completedFocusMinutes)}m done` },
          { label: 'Remaining', value: `${Math.max(Math.ceil(remainingFocusMinutes), 0)}m focus` },
          { label: 'Session', value: showBreakUi ? 'On break' : session.paused ? 'Paused' : 'Active' },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center justify-center py-4 px-3 text-center">
            <div className="text-[11px] text-white/30 uppercase tracking-[0.14em]">{stat.label}</div>
            <div className="mt-1 text-[14px] font-[700] text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ── Midpoint toast ── */}
      {alertState?.type === 'midpoint' && (
        <div className="fixed inset-x-0 top-[100px] z-[220] flex justify-center px-4">
          <div className="rounded-[18px] px-6 py-4 text-center shadow-2xl"
            style={{ background: 'rgba(10,15,28,0.96)', border: `1px solid rgba(${accentRgb},0.3)` }}>
            <div className="text-[12px] font-[800] uppercase tracking-[0.2em]" style={{ color: `rgb(${accentRgb})` }}>Midpoint</div>
            <div className="mt-1 text-[14px] text-white/80">Halfway through. Keep going.</div>
            <button type="button" onClick={() => { stopAudio(audioCtxRef); setAlertState(null); }}
              className="mt-3 rounded-[12px] px-4 py-2 text-[12px] font-[600] text-white transition hover:opacity-80"
              style={{ background: `rgba(${accentRgb},0.2)` }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Phase-end / complete modal ── */}
      {alertState && alertState.type !== 'midpoint' && alertState.visible && (
        <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-md rounded-[24px] p-6" style={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/30">Focus Alert</div>
            <h3 className="mt-2 text-[20px] font-[800] text-white">{alertState.title}</h3>
            <p className="mt-2 text-[14px] leading-6 text-white/50">{alertState.message}</p>
            <div className={`mt-5 grid gap-2 ${showBreakUi && alertState.type === 'phase-end' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {showBreakUi && alertState.type === 'phase-end' && (
                <button type="button"
                  onClick={() => { stopAudio(audioCtxRef); stopTrackAudio(breakAudioRef); audioSegmentRef.current = -1; if (session) { setSession(skipCurrentBreak(session)); void syncTasks(); } setAlertState(null); }}
                  className="rounded-[14px] border border-white/15 px-4 py-3 text-[13px] font-[600] text-white/70 transition hover:bg-white/8">
                  Skip break
                </button>
              )}
              <button type="button"
                onClick={() => { stopAudio(audioCtxRef); if (session) { setSession(snoozeFocusSession(session, 120)); void syncTasks(); } setAlertState(null); }}
                className="rounded-[14px] px-4 py-3 text-[13px] font-[600] text-white transition"
                style={{ background: `rgba(${accentRgb},0.15)`, border: `1px solid rgba(${accentRgb},0.25)` }}>
                Snooze 2 min
              </button>
              <button type="button"
                onClick={() => { stopAudio(audioCtxRef); if (alertState.type === 'complete') { clearFocusSession(session?.taskId); void syncTasks(); navigate('/tasks'); return; } setAlertState(null); }}
                className="rounded-[14px] px-4 py-3 text-[13px] font-[700] transition"
                style={{ background: `rgb(${accentRgb})`, color: '#080c14' }}>
                {alertState.type === 'complete' ? 'Done' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Audio visualizer keyframes ── */}
      <style>{`
        @keyframes audioBar0 { from { height: 25% } to { height: 80% } }
        @keyframes audioBar1 { from { height: 40% } to { height: 65% } }
        @keyframes audioBar2 { from { height: 20% } to { height: 90% } }
      `}</style>
    </div>
  );

  async function finishSession(activeTaskId: string, skippedBreakCount: number) {
    completeFocusTask(activeTaskId);
    await syncTasks();
    triggerCelebration(skippedBreakCount > 0 ? 'You pushed beyond the planned breaks and still finished strong.' : 'Focus session complete. The task is marked done.');
  }
}

// ── BreathingGuide ────────────────────────────────────────────────────────────
function BreathingGuide({ themeRgb, stepLabel, stepRemaining }: { themeRgb: string; stepLabel: string; stepRemaining: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="dayflow-breath-square-wrap">
        <div className="dayflow-breath-square" style={{ borderColor: `rgba(${themeRgb}, 0.78)` }}>
          <div className="dayflow-breath-float" style={{ color: `rgb(${themeRgb})`, textShadow: `0 0 22px rgba(${themeRgb},0.36)` }}>{stepLabel}</div>
          <div className="dayflow-breath-count">{Math.ceil(stepRemaining)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function buildCycleBars(session: FocusSession | null) {
  if (!session) return [];
  const bars: Array<{ key: string; short: string; label: string; focusMinutes: number; breakMinutes: number; focusState: string; breakState: string }> = [];
  for (let index = 0, cycle = 1; index < session.segments.length; index += 1) {
    const focusSegment = session.segments[index];
    if (focusSegment.type !== 'focus') continue;
    const breakSegment = session.segments[index + 1]?.type === 'break' ? session.segments[index + 1] : null;
    const focusState = session.currentSegmentIndex > index || session.completed ? 'done' : session.currentSegmentIndex === index ? 'current-focus' : 'upcoming';
    const breakState = breakSegment
      ? session.skippedBreakIndices.includes(index + 1) ? 'skipped'
        : session.currentSegmentIndex > index + 1 || session.completed ? 'done'
        : session.currentSegmentIndex === index + 1 ? 'current-break' : 'upcoming'
      : 'none';
    bars.push({ key: `cycle-${cycle}`, short: `Block ${cycle}`, label: `${focusSegment.durationSec / 60}m focus`, focusMinutes: focusSegment.durationSec / 60, breakMinutes: breakSegment ? breakSegment.durationSec / 60 : 0, focusState, breakState });
    if (breakSegment) index += 1;
    cycle += 1;
  }
  return bars;
}

function breakTipForSegment(segmentIndex: number) { return BREAK_TIPS[segmentIndex % BREAK_TIPS.length]; }

function getBreakPhaseState(session: FocusSession, now: number) {
  const currentSegment = session.segments[session.currentSegmentIndex];
  if (!currentSegment || currentSegment.type !== 'break') return { label: 'Inhale', remaining: 5 };
  const elapsedSeconds = session.paused
    ? Math.max(0, currentSegment.durationSec - (session.pausedRemainingSec ?? currentSegment.durationSec))
    : Math.max(0, Math.floor((now - session.segmentStartedAt) / 1000));
  const cycleSeconds = elapsedSeconds % 20;
  return { label: PHASE_STEPS[Math.min(Math.floor(cycleSeconds / 5), PHASE_STEPS.length - 1)], remaining: 5 - (cycleSeconds % 5) };
}

function playPattern(audioRef: MutableRefObject<AudioContext | null>, durationSec: number) {
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = audioRef.current ?? new AudioCtor();
    audioRef.current = context;
    if (context.state === 'suspended') void context.resume();
    const beeps = Math.max(1, Math.floor(durationSec / 1.8));
    for (let i = 0; i < beeps; i++) { addAlarmTone(context, 720, 0.32, i * 1.8); addAlarmTone(context, 960, 0.22, i * 1.8 + 0.38); }
  } catch { /* best effort */ }
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
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.start(start); oscillator.stop(end);
}

function stopAudio(audioRef: MutableRefObject<AudioContext | null>) {
  try { audioRef.current?.close(); } catch { /* ignore */ } finally { audioRef.current = null; }
}

function stopTrackAudio(audioRef: MutableRefObject<HTMLAudioElement | null>) {
  if (!audioRef.current) return;
  audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null;
}
