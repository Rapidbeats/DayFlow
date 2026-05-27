import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
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
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadFull } from 'tsparticles';
import { useNavigate, useSearchParams } from 'react-router';
import {
  BREAK_TRACKS,
  clearFocusSession,
  completeFocusTask,
  createFocusSession,
  findFocusTask,
  FLOW_STATE_TRACKS,
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
  type FocusTrack,
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
const galaxyOverlayUrl = '/focus-flow-galaxy.png';
const AUDIO_CATEGORY_LABELS: Record<FocusAudioCategory, string> = {
  lofi: 'Lofi',
  rain: 'Rain',
  flow: 'Flow State',
};
const AUDIO_CATEGORY_TONE: Record<FocusAudioCategory, string> = {
  lofi: 'Warm drift',
  rain: 'Atmospheric calm',
  flow: 'Neural intensity',
};
const FOCUS_TRACK_LIBRARY: Record<FocusAudioCategory, FocusTrack[]> = {
  lofi: LOFI_TRACKS,
  rain: RAIN_TRACKS,
  flow: FLOW_STATE_TRACKS,
};

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
  const [currentTrack, setCurrentTrack] = useState<FocusTrack | null>(null);
  const [audioSpectrum, setAudioSpectrum] = useState<number[]>(Array.from({ length: 10 }, () => 0.35));

  const { syncTasks, refreshTasks } = useAuth();
  const alarmCtxRef = useRef<AudioContext | null>(null);
  const focusAudioRef = useRef<HTMLAudioElement | null>(null);
  const breakAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeTrackSegmentRef = useRef<number>(-1);
  const trackAudioCtxRef = useRef<AudioContext | null>(null);
  const trackAnalyserRef = useRef<AnalyserNode | null>(null);
  const trackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const spectrumFrameRef = useRef<number | null>(null);

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
      stopTrackAnalyser(trackAudioCtxRef, spectrumFrameRef, trackAnalyserRef, trackSourceRef);
    };
  }, []);

  useEffect(() => {
    const segmentType = session?.segments[session.currentSegmentIndex]?.type;
    const canPlayAudio = Boolean(session && !session.completed && !session.paused && audioPrefs.enabled && !alertState?.visible);

    if (!canPlayAudio || !segmentType) {
      stopTrackAudio(focusAudioRef);
      stopTrackAudio(breakAudioRef);
      stopTrackAnalyser(trackAudioCtxRef, spectrumFrameRef, trackAnalyserRef, trackSourceRef);
      setAudioSpectrum(Array.from({ length: 10 }, () => 0.35));
      activeTrackSegmentRef.current = -1;
      return;
    }

    const targetRef = segmentType === 'focus' ? focusAudioRef : breakAudioRef;
    const otherRef = segmentType === 'focus' ? breakAudioRef : focusAudioRef;
    stopTrackAudio(otherRef);

    if (activeTrackSegmentRef.current !== session!.currentSegmentIndex || !targetRef.current) {
      stopTrackAudio(targetRef);
      stopTrackAnalyser(trackAudioCtxRef, spectrumFrameRef, trackAnalyserRef, trackSourceRef);
      const track =
        segmentType === 'focus'
          ? pickRandomTrack(FOCUS_TRACK_LIBRARY[audioPrefs.category])
          : pickRandomTrack(BREAK_TRACKS);
      const audio = new Audio(track.src);
      audio.crossOrigin = 'anonymous';
      audio.loop = true;
      audio.volume = audioPrefs.volume;
      targetRef.current = audio;
      activeTrackSegmentRef.current = session!.currentSegmentIndex;
      setCurrentTrack(track);
      connectTrackAnalyser(audio, trackAudioCtxRef, trackAnalyserRef, trackSourceRef, spectrumFrameRef, setAudioSpectrum);
      void audio.play().catch(() => undefined);
      return;
    }

    targetRef.current.volume = audioPrefs.volume;
    void trackAudioCtxRef.current?.resume().catch(() => undefined);
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

  const isFlowState = audioPrefs.category === 'flow';
  const userTheme = getTheme(session?.themeId || 'emerald');
  const flowTheme = getTheme('violet');
  const theme = isFlowState ? flowTheme : userTheme;
  const accentRgb = theme.rgb;
  const progress = session ? getFocusProgress(session, now) : { remainingSec: 0, elapsedSec: 0, progress: 0 };
  const focusCoreIntensity = isFlowState ? 0.55 + progress.progress * 0.55 : 0.5 + progress.progress * 0.2;
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
  const RING_R = 140;
  const RING_CIRCUM = 2 * Math.PI * RING_R;
  const ringOffset = RING_CIRCUM - progress.progress * RING_CIRCUM;
  const ringDotX = 160 + RING_R * Math.cos(2 * Math.PI * progress.progress);
  const ringDotY = 160 + RING_R * Math.sin(2 * Math.PI * progress.progress);
  const statusItems = [
    { label: 'Completed today', value: `${cycleBars.filter((bar) => bar.focusState === 'done').length} / ${cycleBars.length} blocks` },
    { label: 'Focus time', value: `${Math.round(completedFocusMinutes)}m done` },
    { label: 'Remaining', value: `${Math.max(Math.ceil(remainingFocusMinutes), 0)}m focus` },
    { label: 'Session', value: showBreakUi ? 'On break' : session?.paused ? 'Paused' : 'Active' },
  ];
  const focusTrackSet = FOCUS_TRACK_LIBRARY[audioPrefs.category];
  const ambientParticles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, index) => ({
        id: index,
        size: 2 + (index % 4),
        left: `${(index * 13) % 100}%`,
        top: `${(index * 17 + 9) % 100}%`,
        duration: `${12 + (index % 5) * 4}s`,
        delay: `${(index % 6) * 1.4}s`,
      })),
    []
  );
  const particleOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      background: { color: { value: 'transparent' } },
      particles: {
        color: { value: ['#F8FAFC', '#4F7CFF', '#8B5CF6'] },
        move: {
          enable: true,
          direction: 'none' as const,
          outModes: { default: 'out' as const },
          random: true,
          speed: 0.18,
          straight: false,
        },
        number: {
          density: { enable: true, width: 1200, height: 800 },
          value: 28,
        },
        opacity: {
          value: { min: 0.04, max: 0.18 },
          animation: { enable: true, speed: 0.25, minimumValue: 0.03, sync: false },
        },
        shape: { type: 'circle' as const },
        size: {
          value: { min: 1, max: 3 },
          animation: { enable: true, speed: 1, minimumValue: 0.8, sync: false },
        },
        twinkle: {
          particles: {
            enable: true,
            color: { value: '#F8FAFC' },
            frequency: 0.015,
            opacity: 0.4,
          },
        },
      },
      detectRetina: true,
    }),
    []
  );
  const initParticles = useMemo(
    () => async (engine: Parameters<typeof loadFull>[0]) => {
      await loadFull(engine);
    },
    []
  );

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
    <motion.div
      className={`dayflow-focus-shell min-h-[calc(100vh-96px)] overflow-hidden rounded-[32px] ${isFlowState ? 'is-flow-state' : ''}`}
      initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.985 }}
      animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: isFlowState
          ? 'linear-gradient(180deg, #020617 0%, #050b17 46%, #020617 100%)'
          : `radial-gradient(ellipse at 70% 0%, rgba(${accentRgb}, 0.14) 0%, transparent 55%), linear-gradient(180deg, #080c14 0%, #0a0f1c 100%)`,
        border: `1px solid rgba(${accentRgb}, 0.16)`,
      }}
    >
      <motion.div
        className="dayflow-flow-backdrop"
        aria-hidden="true"
        initial={{ opacity: 0.1, filter: 'blur(18px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        {isFlowState ? (
          <>
            <motion.div className="dayflow-flow-nebula dayflow-flow-nebula-a" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ duration: 0.8, delay: 0.15 }} />
            <motion.div className="dayflow-flow-nebula dayflow-flow-nebula-b" initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ duration: 0.9, delay: 0.22 }} />
            <motion.div className="dayflow-flow-nebula dayflow-flow-nebula-c" initial={{ opacity: 0 }} animate={{ opacity: 0.45 }} transition={{ duration: 1, delay: 0.3 }} />
            <motion.div className="dayflow-flow-aurora" initial={{ opacity: 0 }} animate={{ opacity: 0.58 }} transition={{ duration: 0.95, delay: 0.35 }} />
            <motion.div
              className="dayflow-flow-galaxy-overlay"
              style={{ backgroundImage: `url("${galaxyOverlayUrl}")` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.12 }}
              transition={{ duration: 0.95, delay: 0.42 }}
            />
            <motion.div className="dayflow-flow-gridfade" initial={{ opacity: 0 }} animate={{ opacity: 0.24 }} transition={{ duration: 0.9, delay: 0.48 }} />
            <ParticlesProvider init={initParticles}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.85, delay: 0.55 }}>
                <Particles
                id="dayflow-focus-particles"
                className="dayflow-flow-particles-canvas"
                options={particleOptions}
                />
              </motion.div>
            </ParticlesProvider>
            {ambientParticles.map((particle) => (
              <span
                key={particle.id}
                className="dayflow-flow-particle"
                style={{
                  width: particle.size,
                  height: particle.size,
                  left: particle.left,
                  top: particle.top,
                  animationDuration: particle.duration,
                  animationDelay: particle.delay,
                }}
              />
            ))}
          </>
        ) : (
          /* Non-flow: subtle radial glow using user accent colour */
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            style={{
              background: `radial-gradient(ellipse at 70% 0%, rgba(${accentRgb}, 0.18) 0%, transparent 55%), radial-gradient(ellipse at 20% 100%, rgba(${accentRgb}, 0.09) 0%, transparent 45%)`,
            }}
          />
        )}
      </motion.div>

      <motion.div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-0 pt-5 md:px-6 md:pt-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.18 }}>
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
      </motion.div>

      <motion.div className="px-5 pt-5 md:px-6" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.28 }}>
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
      </motion.div>

      <div className="grid gap-5 p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <motion.section
          className="relative overflow-hidden rounded-[24px] px-4 py-8 sm:px-6 sm:py-10"
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: isFlowState
              ? 'linear-gradient(180deg, rgba(11,17,32,0.78), rgba(2,6,23,0.72))'
              : `radial-gradient(ellipse at center top, rgba(${accentRgb},0.13) 0%, transparent 65%), rgba(255,255,255,0.02)`,
            border: isFlowState ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.07)',
            minHeight: '420px',
          }}
        >
          <div
            className={`pointer-events-none absolute inset-0 ${isFlowState ? 'dayflow-focus-core-glow' : ''}`}
            style={{
              background: isFlowState
                ? `radial-gradient(circle at 50% 45%, rgba(79,124,255,${0.12 + focusCoreIntensity * 0.14}) 0%, rgba(139,92,246,${0.08 + focusCoreIntensity * 0.1}) 32%, transparent 62%)`
                : `radial-gradient(circle at 50% 45%, rgba(${accentRgb},0.09) 0%, transparent 60%)`,
            }}
          />

          {showBreakUi ? (
            <div className="relative z-10 flex w-full flex-col items-center gap-6 px-2 sm:px-6">
              <div className="text-[11px] font-[700] uppercase tracking-[0.22em] text-white/40">Recovery Break</div>

              <div className="dayflow-focus-break-panel">
                <div className="dayflow-focus-break-square-wrap">
                  <div className="dayflow-focus-break-square">
                    <div className="dayflow-focus-break-inner">
                      <div className="text-[13px] font-[700] uppercase tracking-[0.26em] text-white/40">
                        Break Time
                      </div>
                      <BreathingGuide
                        themeRgb={accentRgb}
                        stepLabel={breakPhase.label}
                        stepRemaining={breakPhase.remaining}
                      />
                      <div className="dayflow-focus-break-tip">
                        {breakTipForSegment(session.currentSegmentIndex)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-sm">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.min(100, Math.max(0, progress.progress * 100))}%`,
                        background: `rgb(${accentRgb})`,
                      }}
                    />
                  </div>
                  <div className="mt-2 text-center text-[13px] text-white/40">
                    {formatClock(progress.remainingSec)} remaining
                  </div>
                </div>

                <div className="dayflow-focus-break-note">
                  <span style={{ color: `rgb(${accentRgb})` }}>+</span>
                  {breakPhase.label} for {Math.ceil(breakPhase.remaining)}s, then ease into the next phase.
                </div>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="text-[11px] font-[700] uppercase tracking-[0.22em] text-white/40">Deep Focus</div>

              <div
                className="relative flex items-center justify-center"
                style={{ width: 'min(100%, 320px)', aspectRatio: '1 / 1' }}
              >
                <svg
                  viewBox="0 0 320 320"
                  className="absolute inset-0 h-full w-full -rotate-90"
                  aria-hidden="true"
                >
                  <circle cx="160" cy="160" r={RING_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                  <circle
                    cx="160"
                    cy="160"
                    r={RING_R}
                    fill="none"
                    stroke={`rgb(${accentRgb})`}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUM}
                    strokeDashoffset={ringOffset}
                    style={{
                      transition: 'stroke-dashoffset 1s linear',
                      filter: isFlowState
                        ? `drop-shadow(0 0 ${10 + progress.progress * 8}px rgba(79,124,255,0.95)) drop-shadow(0 0 ${22 + progress.progress * 18}px rgba(139,92,246,0.38))`
                        : `drop-shadow(0 0 8px rgba(${accentRgb},0.7))`,
                    }}
                  />
                  <circle
                    cx={ringDotX}
                    cy={ringDotY}
                    r="7"
                    fill={`rgb(${accentRgb})`}
                    style={{
                      filter: isFlowState
                        ? `drop-shadow(0 0 ${18 + progress.progress * 8}px rgba(79,124,255,0.95)) drop-shadow(0 0 ${30 + progress.progress * 16}px rgba(244,63,94,0.25))`
                        : `drop-shadow(0 0 16px rgba(${accentRgb},0.8))`,
                    }}
                  />
                  {isFlowState && (
                    <>
                      <circle cx="160" cy="160" r="148" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 9" className="dayflow-focus-orbit-shell" />
                      <circle cx="160" cy="12" r="3" fill="#4F7CFF" style={{ filter: 'drop-shadow(0 0 8px rgba(79,124,255,0.85))' }} />
                      <circle cx="298" cy="160" r="2.5" fill="#8B5CF6" style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.72))' }} />
                      <circle cx="160" cy="308" r="2.5" fill="#F43F5E" style={{ filter: 'drop-shadow(0 0 8px rgba(244,63,94,0.65))' }} />
                    </>
                  )}
                </svg>

                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="text-[clamp(56px,14vw,64px)] font-[900] leading-none tracking-[-0.05em] text-white tabular-nums">
                    {formatClock(progress.remainingSec)}
                  </div>

                  {audioPrefs.enabled && !session.paused && (
                    <div className="flex h-5 items-end gap-[3px]" aria-hidden="true">
                      {Array.from({ length: 7 }).map((_, index) => {
                        const sample = audioSpectrum[index] ?? 0.35;
                        const minHeight = 22 + sample * 18;
                        const maxHeight = 44 + sample * 30;
                        return (
                        <div
                          key={index}
                          className="w-[3px] rounded-full"
                          style={{
                            background: `rgb(${accentRgb})`,
                            height: `${minHeight}%`,
                            animation: `audioBar${index % 3} ${0.6 + index * 0.1}s ease-in-out infinite alternate`,
                            animationPlayState: audioPrefs.enabled ? 'running' : 'paused',
                            opacity: 0.64 + sample * 0.28,
                            '--audio-bar-min': `${minHeight}%`,
                            '--audio-bar-max': `${maxHeight}%`,
                          }}
                        />
                      )})}
                    </div>
                  )}

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
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 transition hover:bg-white/15 active:scale-95"
                  >
                    {session.paused
                      ? <Play className="ml-0.5 h-5 w-5 text-white" />
                      : <Pause className="h-5 w-5 text-white" />}
                  </button>
                </div>
              </div>

              <div
                className="flex items-center gap-2 rounded-[14px] px-5 py-3 text-center text-[13px] text-white/60"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span style={{ color: `rgb(${accentRgb})` }}>{'\u26A1'}</span>
                {FOCUS_QUOTES[quoteIndex]}
              </div>
            </div>
          )}
        </motion.section>

        <motion.aside className="flex flex-col gap-4" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.46 }}>
          <div className={`rounded-[20px] border border-white/10 bg-white/[0.03] p-5 ${isFlowState ? 'dayflow-focus-glow-card' : ''}`}>
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

          <div className={`rounded-[20px] border border-white/10 bg-white/[0.03] p-5 ${isFlowState ? 'dayflow-focus-glow-card' : ''}`}>
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

          <div className={`rounded-[20px] border border-white/10 bg-white/[0.03] p-5 ${isFlowState ? 'dayflow-focus-glow-card' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-[700] uppercase tracking-[0.2em] text-white/30">Focus Engine</div>
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
              <div className="mt-4 space-y-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/25">Focus Engine</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['lofi', 'rain', 'flow'] as FocusAudioCategory[]).map((category) => (
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
                      className={`dayflow-focus-engine-tab rounded-[12px] px-3 py-2.5 text-[13px] font-[600] transition ${category === 'flow' ? 'is-flow' : ''}`}
                      style={{
                        background:
                          audioPrefs.category === category && category === 'flow'
                            ? 'linear-gradient(135deg, rgba(79,124,255,0.22), rgba(139,92,246,0.16))'
                            : audioPrefs.category === category
                              ? `rgba(${accentRgb},0.2)`
                              : 'rgba(255,255,255,0.05)',
                        border:
                          audioPrefs.category === category && category === 'flow'
                            ? '1px solid rgba(79,124,255,0.42)'
                            : audioPrefs.category === category
                              ? `1px solid rgba(${accentRgb},0.4)`
                              : '1px solid rgba(255,255,255,0.08)',
                        color:
                          audioPrefs.category === category && category === 'flow'
                            ? '#F8FAFC'
                            : audioPrefs.category === category
                              ? `rgb(${accentRgb})`
                              : 'rgba(255,255,255,0.45)',
                        boxShadow:
                          audioPrefs.category === category && category === 'flow'
                            ? '0 0 20px rgba(79,124,255,0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
                            : undefined,
                      }}
                    >
                      {AUDIO_CATEGORY_LABELS[category]}
                    </button>
                  ))}
                </div>
                <div className={`dayflow-focus-engine-card ${isFlowState ? 'is-flow-state' : ''}`}>
                  <div
                    className="dayflow-focus-engine-art"
                    data-seed={currentTrack?.artworkSeed || audioPrefs.category}
                  >
                    <div className="dayflow-focus-engine-art-core" />
                    <div className="dayflow-focus-engine-art-orbit" />
                    <div className="dayflow-focus-engine-art-label">
                      {(currentTrack?.title || AUDIO_CATEGORY_LABELS[audioPrefs.category]).slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/25">
                      {AUDIO_CATEGORY_TONE[audioPrefs.category]}
                    </div>
                    <div className="mt-1 truncate text-[15px] font-[700] text-white">
                      {currentTrack?.title || (audioPrefs.category === 'flow' ? 'Cosmic Drift' : focusTrackSet[0]?.title)}
                    </div>
                    <div className="mt-1 text-[12px] text-white/45">
                      {currentTrack?.intensity || (audioPrefs.category === 'flow' ? 'High' : 'Medium')} intensity
                    </div>
                  </div>
                  <div className="dayflow-focus-engine-spectrum" aria-hidden="true">
                    {Array.from({ length: 10 }).map((_, index) => {
                      const sample = audioSpectrum[index] ?? 0.35;
                      return (
                      <span
                        key={index}
                        style={{
                          animationDuration: `${0.9 + index * 0.06}s`,
                          animationDelay: `${index * 0.08}s`,
                          height: `${12 + sample * 28}px`,
                          opacity: 0.42 + sample * 0.5,
                        }}
                      />
                    )})}
                  </div>
                </div>
                <p className="text-[11px] leading-5 text-white/25">Break playlist plays automatically during recovery breaks.</p>
              </div>
            )}
          </div>
        </motion.aside>
      </div>

      <motion.div className="px-5 pb-5 md:px-6 md:pb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.72, delay: 0.58 }}>
        <div className="dayflow-focus-stats-grid">
          {statusItems.map((stat) => (
            <div key={stat.label} className="dayflow-focus-stat-card">
              <div className="dayflow-focus-stat-label">{stat.label}</div>
              <div className="dayflow-focus-stat-value">{stat.value}</div>
            </div>
          ))}
        </div>
      </motion.div>

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

      <style>{`
        @keyframes audioBar0 { from { height: var(--audio-bar-min, 25%) } to { height: var(--audio-bar-max, 80%) } }
        @keyframes audioBar1 { from { height: calc(var(--audio-bar-min, 40%) * 0.92) } to { height: calc(var(--audio-bar-max, 65%) * 0.88) } }
        @keyframes audioBar2 { from { height: calc(var(--audio-bar-min, 20%) * 0.8) } to { height: calc(var(--audio-bar-max, 90%) * 1.02) } }
      `}</style>
    </motion.div>
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

function connectTrackAnalyser(
  audio: HTMLAudioElement,
  ctxRef: MutableRefObject<AudioContext | null>,
  analyserRef: MutableRefObject<AnalyserNode | null>,
  sourceRef: MutableRefObject<MediaElementAudioSourceNode | null>,
  frameRef: MutableRefObject<number | null>,
  setSpectrum: (value: number[] | ((prev: number[]) => number[])) => void
) {
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const context = ctxRef.current ?? new AudioCtor();
    ctxRef.current = context;
    const analyser = context.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.82;
    analyserRef.current = analyser;

    const source = context.createMediaElementSource(audio);
    sourceRef.current = source;
    source.connect(analyser);
    analyser.connect(context.destination);
    void context.resume().catch(() => undefined);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      const next = Array.from({ length: 10 }).map((_, index) => {
        const bucketSize = Math.max(1, Math.floor(buffer.length / 10));
        const start = index * bucketSize;
        const end = Math.min(buffer.length, start + bucketSize);
        let total = 0;
        for (let i = start; i < end; i += 1) total += buffer[i];
        const avg = end > start ? total / (end - start) : 0;
        return Math.max(0.14, Math.min(1, avg / 255));
      });
      setSpectrum(next);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
  } catch {
    setSpectrum(Array.from({ length: 10 }, () => 0.5));
  }
}

function stopTrackAnalyser(
  ctxRef: MutableRefObject<AudioContext | null>,
  frameRef: MutableRefObject<number | null>,
  analyserRef: MutableRefObject<AnalyserNode | null>,
  sourceRef: MutableRefObject<MediaElementAudioSourceNode | null>
) {
  if (frameRef.current !== null) {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }
  try {
    sourceRef.current?.disconnect();
  } catch {
    // ignore
  }
  try {
    analyserRef.current?.disconnect();
  } catch {
    // ignore
  }
  try {
    void ctxRef.current?.close();
  } catch {
    // ignore
  } finally {
    sourceRef.current = null;
    analyserRef.current = null;
    ctxRef.current = null;
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
