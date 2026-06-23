import { getSettings, getTasks, saveTasks } from './storage';
import { Task } from './supabase';
import { getTheme } from './themes';

export const FOCUS_SESSION_UPDATED_EVENT = 'dayflow:focus-session-updated';
const FOCUS_UI_STATE_KEY = 'df_focus_ui_state';
const AUDIO_PREFS_KEY = 'df_audio_prefs';

export interface FocusSegment {
  type: 'focus' | 'break';
  durationSec: number;
  midpointAtSec?: number;
}

export interface FocusSession {
  taskId: string;
  taskName: string;
  taskDate: string;
  totalMinutes: number;
  themeId: string;
  segments: FocusSegment[];
  currentSegmentIndex: number;
  segmentStartedAt: number;
  segmentEndsAt: number;
  midpointPlayed: boolean;
  lastUpdatedAt: number;
  completed: boolean;
  paused: boolean;
  pausedRemainingSec?: number;
  snoozedUntil?: number;
  skippedBreakIndices: number[];
}

export type FocusAudioCategory = 'lofi' | 'rain' | 'flow';

export interface FocusTrack {
  src: string;
  title: string;
  intensity: 'Low' | 'Medium' | 'High';
  artworkSeed: string;
  category: FocusAudioCategory | 'break';
  order?: number;
}

export interface FocusAudioPrefs {
  enabled: boolean;
  category: FocusAudioCategory;
  volume: number; // 0–1
}

export const TRACK_CATALOG: FocusTrack[] = [
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/LF_Relax.your.mind.mp3',
    title: 'Relax Your Mind',
    intensity: 'Low',
    artworkSeed: 'lofi-mind',
    category: 'lofi',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/LF_Childish.Gambino.-.Lofi.cover.mp3',
    title: 'Lofi Cover',
    intensity: 'Medium',
    artworkSeed: 'lofi-cover',
    category: 'lofi',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/LF_Wandering.Another.World.mp3',
    title: 'Wandering Another World',
    intensity: 'Low',
    artworkSeed: 'lofi-world',
    category: 'lofi',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/LF_Starside.Groove.mp3',
    title: 'Starside Groove',
    intensity: 'Medium',
    artworkSeed: 'lofi-starside',
    category: 'lofi',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/LF_Lunar.Drive.mp3',
    title: 'Lunar Drive',
    intensity: 'Medium',
    artworkSeed: 'lofi-lunar',
    category: 'lofi',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/RS_Track.1.wav',
    title: 'Storm Veil',
    intensity: 'Low',
    artworkSeed: 'rain-veil',
    category: 'rain',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/RS_Track.2.wav',
    title: 'Night Rain',
    intensity: 'Low',
    artworkSeed: 'rain-night',
    category: 'rain',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_1_Aloft.-.Airlines.mp3',
    title: 'Aloft - Airlines',
    intensity: 'Medium',
    artworkSeed: 'flow-aloft',
    category: 'flow',
    order: 1,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_2_VonnBoyd.-.Oblivion.mp3',
    title: 'VonnBoyd - Oblivion',
    intensity: 'High',
    artworkSeed: 'flow-oblivion',
    category: 'flow',
    order: 2,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_3_BlauDisS.-.eight.twenty.two.mp3',
    title: 'eight.twenty.two',
    intensity: 'Medium',
    artworkSeed: 'flow-eight',
    category: 'flow',
    order: 3,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_4_Kasper.Klick.-.Salvation.mp3',
    title: 'Kasper Klick - Salvation',
    intensity: 'High',
    artworkSeed: 'flow-salvation',
    category: 'flow',
    order: 4,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_5_ocxone.-.Origin.mp3',
    title: 'ocxone - Origin',
    intensity: 'High',
    artworkSeed: 'flow-origin',
    category: 'flow',
    order: 5,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_6_SAM.Tahmid.-.Abyss.mp3',
    title: 'SAM Tahmid - Abyss',
    intensity: 'Medium',
    artworkSeed: 'flow-abyss',
    category: 'flow',
    order: 6,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_7_Blackbird.-.Regrets.mp3',
    title: 'Blackbird - Regrets',
    intensity: 'Medium',
    artworkSeed: 'flow-regrets',
    category: 'flow',
    order: 7,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_8_Inhale.-.Unfold.mp3',
    title: 'Inhale - Unfold',
    intensity: 'Low',
    artworkSeed: 'flow-unfold',
    category: 'flow',
    order: 8,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_9_AdamZero.-.Cold.Attraction.mp3',
    title: 'AdamZero - Cold Attraction',
    intensity: 'High',
    artworkSeed: 'flow-cold',
    category: 'flow',
    order: 9,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_10_Etsu.-.Convergence.mp3',
    title: 'Etsu - Convergence',
    intensity: 'Medium',
    artworkSeed: 'flow-convergence',
    category: 'flow',
    order: 10,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_11_Etsu.-.Destination.mp3',
    title: 'Etsu - Destination',
    intensity: 'Medium',
    artworkSeed: 'flow-destination',
    category: 'flow',
    order: 11,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_12_Blut.Own.-.Atlas.mp3',
    title: 'Blut Own - Atlas',
    intensity: 'High',
    artworkSeed: 'flow-atlas',
    category: 'flow',
    order: 12,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_13_Owsey.-.Thousands.Of.Summer.Twilights.Blut.Own.Remix.mp3',
    title: 'Owsey - Thousands of Summer Twilights',
    intensity: 'Low',
    artworkSeed: 'flow-twilights',
    category: 'flow',
    order: 13,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_14_Saga.-.Moonlight.mp3',
    title: 'Saga - Moonlight',
    intensity: 'Low',
    artworkSeed: 'flow-moonlight',
    category: 'flow',
    order: 14,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_15_Tikk.-.Extremely.Far.mp3',
    title: 'Tikk - Extremely Far',
    intensity: 'High',
    artworkSeed: 'flow-far',
    category: 'flow',
    order: 15,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_16_E.lementaL.-.Fade.mp3',
    title: 'Elemental - Fade',
    intensity: 'Low',
    artworkSeed: 'flow-fade',
    category: 'flow',
    order: 16,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_17_Asyrion.-.One.Touch.mp3',
    title: 'Asyrion - One Touch',
    intensity: 'Medium',
    artworkSeed: 'flow-onetouch',
    category: 'flow',
    order: 17,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_18_Almost.Vanished.-.Discernment.mp3',
    title: 'Almost Vanished - Discernment',
    intensity: 'Medium',
    artworkSeed: 'flow-discernment',
    category: 'flow',
    order: 18,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_19_Aurora.Night.-.In.Space.mp3',
    title: 'Aurora Night - In Space',
    intensity: 'High',
    artworkSeed: 'flow-inspace',
    category: 'flow',
    order: 19,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_20_GENY.G.-.Other.Side.mp3',
    title: 'GENY G - Other Side',
    intensity: 'Medium',
    artworkSeed: 'flow-otherside',
    category: 'flow',
    order: 20,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_21_AK.-.Our.Destination.mp3',
    title: 'AK - Our Destination',
    intensity: 'Medium',
    artworkSeed: 'flow-ourdestination',
    category: 'flow',
    order: 21,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_22_Into.Her.Eyes.mp3',
    title: 'Into Her Eyes',
    intensity: 'Low',
    artworkSeed: 'flow-hereyes',
    category: 'flow',
    order: 22,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_23_Alchemorph.-.Moods.mp3',
    title: 'Alchemorph - Moods',
    intensity: 'Medium',
    artworkSeed: 'flow-moods',
    category: 'flow',
    order: 23,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_24_Ptr.-.Lunar.mp3',
    title: 'Ptr - Lunar',
    intensity: 'Low',
    artworkSeed: 'flow-lunar2',
    category: 'flow',
    order: 24,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/FB_25_Morii.mp3',
    title: 'Morii',
    intensity: 'High',
    artworkSeed: 'flow-morii',
    category: 'flow',
    order: 25,
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/BT_Let.s.Go.Home.mp3',
    title: "Let's Go Home",
    intensity: 'Low',
    artworkSeed: 'break-home',
    category: 'break',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/BT_U.In.My.Arms.mp3',
    title: 'U In My Arms',
    intensity: 'Low',
    artworkSeed: 'break-arms',
    category: 'break',
  },
  {
    src: 'https://github.com/Rapidbeats/DayFlow/releases/download/v1.0/BT_Top.Ten.mp3',
    title: 'Top Ten',
    intensity: 'Medium',
    artworkSeed: 'break-topten',
    category: 'break',
  },
];

export const LOFI_TRACK_URLS = TRACK_CATALOG.filter((track) => track.category === 'lofi').map((track) => track.src);
export const RAIN_TRACK_URLS = TRACK_CATALOG.filter((track) => track.category === 'rain').map((track) => track.src);
export const FLOW_STATE_TRACK_URLS = TRACK_CATALOG.filter((track) => track.category === 'flow')
  .sort((a, b) => (a.order || 0) - (b.order || 0))
  .map((track) => track.src);
export const BREAK_TRACK_URLS = TRACK_CATALOG.filter((track) => track.category === 'break').map((track) => track.src);

export function getAudioPrefs(): FocusAudioPrefs {
  return readJson<FocusAudioPrefs>(AUDIO_PREFS_KEY, { enabled: true, category: 'lofi', volume: 0.6 });
}

export function saveAudioPrefs(prefs: FocusAudioPrefs) {
  localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs));
}

export function getTrackByUrl(url?: string | null): FocusTrack | null {
  if (!url) return null;
  return TRACK_CATALOG.find((track) => track.src === url) || null;
}

export function pickRandomTrackUrl(urls: string[]): string {
  return urls[Math.floor(Math.random() * urls.length)];
}

export function getFlowStateTrackUrlForSegment(segmentIndex: number): string {
  const focusBlockIndex = Math.max(0, Math.floor(segmentIndex / 2));
  return FLOW_STATE_TRACK_URLS[focusBlockIndex % FLOW_STATE_TRACK_URLS.length];
}

const FLOW_TRACK_INDEX_KEY = 'df_flow_track_index';

export function getCurrentFlowStateTrackUrl(taskId: string): string {
  const state = readJson<Record<string, number>>(FLOW_TRACK_INDEX_KEY, {});
  const index = state[taskId] ?? 0;
  return FLOW_STATE_TRACK_URLS[index % FLOW_STATE_TRACK_URLS.length];
}

export function getNextFlowStateTrackUrl(taskId: string): string {
  const state = readJson<Record<string, number>>(FLOW_TRACK_INDEX_KEY, {});
  const currentIndex = state[taskId] ?? 0;
  const nextIndex = (currentIndex + 1) % FLOW_STATE_TRACK_URLS.length;
  state[taskId] = nextIndex;
  localStorage.setItem(FLOW_TRACK_INDEX_KEY, JSON.stringify(state));
  return FLOW_STATE_TRACK_URLS[nextIndex];
}

export function getEligibleFocusDuration(durationMinutes: number) {
  return durationMinutes > 55;
}

export function getTaskFocusMode(taskOrId?: Task | string | null) {
  const task = typeof taskOrId === 'string' ? findFocusTask(taskOrId) : taskOrId;
  return Boolean(task?.focus_enabled);
}

export function findFocusTask(taskId?: string | null) {
  if (!taskId) return null;
  return getTasks().find((task) => task.id === taskId) || null;
}

export function createFocusSession(task: Task) {
  const settings = getSettings();
  const themeId = getTheme(settings.theme || 'emerald').id;
  const segments = buildFocusSegments(task.dur);
  const now = Date.now();
  const firstSegment = segments[0];

  const session: FocusSession = {
    taskId: task.id,
    taskName: task.name,
    taskDate: task.date,
    totalMinutes: task.dur,
    themeId,
    segments,
    currentSegmentIndex: 0,
    segmentStartedAt: now,
    segmentEndsAt: now + firstSegment.durationSec * 1000,
    midpointPlayed: false,
    lastUpdatedAt: now,
    completed: false,
    paused: false,
    skippedBreakIndices: getSkippedBreakIndices(task.id),
  };

  saveFocusSession(session);
  return session;
}

export function getActiveFocusSession() {
  const tasks = getTasks();
  const activeTask = [...tasks]
    .filter((task) => task.focus_session_active)
    .sort((a, b) => (b.focus_updated_at || '').localeCompare(a.focus_updated_at || ''))[0];

  if (!activeTask) return null;
  return reconcileFocusSession(taskToSession(activeTask));
}

export function saveFocusSession(session: FocusSession | null) {
  if (!session) {
    window.dispatchEvent(new CustomEvent(FOCUS_SESSION_UPDATED_EVENT, { detail: null }));
    return;
  }

  const tasks = getTasks();
  const updated = tasks.map((task) => {
    if (task.id !== session.taskId) return task;

    return {
      ...task,
      focus_enabled: true,
      focus_pattern: '50-8',
      focus_session_active: !session.completed,
      focus_segment_type: session.segments[session.currentSegmentIndex]?.type,
      focus_segment_index: session.currentSegmentIndex,
      focus_segment_started_at: new Date(session.segmentStartedAt).toISOString(),
      focus_segment_ends_at: new Date(session.segmentEndsAt).toISOString(),
      focus_midpoint_played: session.midpointPlayed,
      focus_paused: session.paused,
      focus_paused_remaining_sec: session.pausedRemainingSec,
      focus_snoozed_until: session.snoozedUntil ? new Date(session.snoozedUntil).toISOString() : undefined,
      focus_completed: session.completed,
      focus_updated_at: new Date(session.lastUpdatedAt).toISOString(),
    };
  });

  saveTasks(updated);
  window.dispatchEvent(new CustomEvent(FOCUS_SESSION_UPDATED_EVENT, { detail: session }));
}

export function clearFocusSession(taskId?: string) {
  const tasks = getTasks();
  const updated = tasks.map((task) => {
    if (taskId && task.id !== taskId) return task;
    if (!task.focus_session_active && !task.focus_completed && !task.focus_segment_type) return task;

    return {
      ...task,
      focus_session_active: false,
      focus_segment_type: undefined,
      focus_segment_index: 0,
      focus_segment_started_at: undefined,
      focus_segment_ends_at: undefined,
      focus_midpoint_played: false,
      focus_paused: false,
      focus_paused_remaining_sec: undefined,
      focus_snoozed_until: undefined,
      focus_completed: false,
      focus_updated_at: new Date().toISOString(),
    };
  });

  saveTasks(updated);
  if (taskId) {
    saveSkippedBreakIndices(taskId, []);
  }
  window.dispatchEvent(new CustomEvent(FOCUS_SESSION_UPDATED_EVENT, { detail: null }));
}

export function moveToNextFocusSegment(session: FocusSession) {
  const nextIndex = session.currentSegmentIndex + 1;
  if (nextIndex >= session.segments.length) {
    const doneSession = {
      ...session,
      completed: true,
      paused: false,
      pausedRemainingSec: undefined,
      lastUpdatedAt: Date.now(),
    };
    saveSkippedBreakIndices(doneSession.taskId, doneSession.skippedBreakIndices);
    saveFocusSession(doneSession);
    return doneSession;
  }

  const now = Date.now();
  const nextSegment = session.segments[nextIndex];
  const nextSession: FocusSession = {
    ...session,
    currentSegmentIndex: nextIndex,
    segmentStartedAt: now,
    segmentEndsAt: now + nextSegment.durationSec * 1000,
    midpointPlayed: false,
    paused: false,
    pausedRemainingSec: undefined,
    snoozedUntil: undefined,
    lastUpdatedAt: now,
    completed: false,
  };

  saveFocusSession(nextSession);
  return nextSession;
}

export function skipCurrentBreak(session: FocusSession) {
  const currentSegment = session.segments[session.currentSegmentIndex];
  if (currentSegment?.type !== 'break') return session;

  const skippedBreakIndices = session.skippedBreakIndices.includes(session.currentSegmentIndex)
    ? session.skippedBreakIndices
    : [...session.skippedBreakIndices, session.currentSegmentIndex];

  saveSkippedBreakIndices(session.taskId, skippedBreakIndices);
  return moveToNextFocusSegment({
    ...session,
    skippedBreakIndices,
  });
}

export function pauseFocusSession(session: FocusSession, remainingSec: number) {
  const nextSession: FocusSession = {
    ...session,
    paused: true,
    pausedRemainingSec: remainingSec,
    lastUpdatedAt: Date.now(),
  };

  saveFocusSession(nextSession);
  return nextSession;
}

export function resumeFocusSession(session: FocusSession, remainingSec: number) {
  const now = Date.now();
  const nextSession: FocusSession = {
    ...session,
    paused: false,
    pausedRemainingSec: undefined,
    segmentStartedAt: now,
    segmentEndsAt: now + remainingSec * 1000,
    snoozedUntil: undefined,
    lastUpdatedAt: now,
  };

  saveFocusSession(nextSession);
  return nextSession;
}

export function snoozeFocusSession(session: FocusSession, seconds = 120) {
  const base = Date.now();
  const nextSession: FocusSession = {
    ...session,
    paused: false,
    pausedRemainingSec: undefined,
    segmentStartedAt: base,
    segmentEndsAt: base + seconds * 1000,
    snoozedUntil: base + seconds * 1000,
    lastUpdatedAt: base,
  };

  saveFocusSession(nextSession);
  return nextSession;
}

export function completeFocusTask(taskId: string) {
  const tasks = getTasks();
  const updated = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          done: true,
          focus_session_active: false,
          focus_completed: true,
          focus_updated_at: new Date().toISOString(),
        }
      : task
  );
  saveTasks(updated);
}

export function shouldShowMidpointCue(session: FocusSession, now = Date.now()) {
  const segment = session.segments[session.currentSegmentIndex];
  if (!segment || segment.type !== 'focus' || !segment.midpointAtSec || session.midpointPlayed || session.paused) return false;

  const { remainingSec } = getFocusProgress(session, now);
  return remainingSec <= Math.max(segment.durationSec - segment.midpointAtSec, 0);
}

export function markMidpointCuePlayed(session: FocusSession) {
  const nextSession = { ...session, midpointPlayed: true, lastUpdatedAt: Date.now() };
  saveFocusSession(nextSession);
  return nextSession;
}

export function getFocusProgress(session: FocusSession, now = Date.now()) {
  const segment = session.segments[session.currentSegmentIndex];
  if (!segment) return { remainingSec: 0, elapsedSec: 0, progress: 1 };
  if (session.paused) {
    const remaining = session.pausedRemainingSec ?? 0;
    const elapsed = Math.max(0, segment.durationSec - remaining);
    return {
      remainingSec: remaining,
      elapsedSec: elapsed,
      progress: segment.durationSec <= 0 ? 1 : Math.min(1, elapsed / segment.durationSec),
    };
  }

  const total = segment.durationSec;
  const remainingSec = Math.max(0, Math.ceil((session.segmentEndsAt - now) / 1000));
  const elapsedSec = Math.max(0, total - remainingSec);
  const progress = total <= 0 ? 1 : Math.min(1, elapsedSec / total);

  return { remainingSec, elapsedSec, progress };
}

export function getCompletedFocusMinutes(session: FocusSession) {
  return session.segments
    .slice(0, session.currentSegmentIndex)
    .filter((segment) => segment.type === 'focus')
    .reduce((total, segment) => total + segment.durationSec / 60, 0);
}

export function getTotalSessionMinutes(session: FocusSession) {
  return session.segments.reduce((total, segment) => total + segment.durationSec / 60, 0);
}

export function getCompletedSessionMinutes(session: FocusSession, now = Date.now()) {
  const previousMinutes = session.segments
    .slice(0, session.currentSegmentIndex)
    .reduce((total, segment) => total + segment.durationSec / 60, 0);

  const currentSegment = session.segments[session.currentSegmentIndex];
  if (!currentSegment) return previousMinutes;

  const { elapsedSec } = getFocusProgress(session, now);
  return previousMinutes + elapsedSec / 60;
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function phaseLabel(session: FocusSession) {
  const segment = session.segments[session.currentSegmentIndex];
  return segment?.type === 'break' ? 'Reset break' : 'Focus block';
}

export function sessionSummaryLabel(session: FocusSession) {
  const focusBlocksDone = session.segments
    .slice(0, session.currentSegmentIndex + 1)
    .filter((segment) => segment.type === 'focus').length;
  const totalFocusBlocks = session.segments.filter((segment) => segment.type === 'focus').length;
  return `Block ${Math.min(focusBlocksDone, totalFocusBlocks)} of ${totalFocusBlocks}`;
}

function buildFocusSegments(totalMinutes: number): FocusSegment[] {
  const segments: FocusSegment[] = [];
  const FOCUS_MINUTES = 50;
  const BREAK_MINUTES = 8;
  let remaining = totalMinutes;

  while (remaining > 55) {
    const remainderAfterStandardBlock = remaining - (FOCUS_MINUTES + BREAK_MINUTES);
    const foldedFocusMinutes =
      remainderAfterStandardBlock > 0 && remainderAfterStandardBlock < 15
        ? FOCUS_MINUTES + remainderAfterStandardBlock
        : FOCUS_MINUTES;

    segments.push({
      type: 'focus',
      durationSec: foldedFocusMinutes * 60,
      midpointAtSec: foldedFocusMinutes >= 50 ? 25 * 60 : undefined,
    });

    segments.push({
      type: 'break',
      durationSec: BREAK_MINUTES * 60,
    });

    remaining -= foldedFocusMinutes + BREAK_MINUTES;
  }

  if (remaining > 0) {
    segments.push({
      type: 'focus',
      durationSec: remaining * 60,
    });
  }

  return segments;
}

function taskToSession(task: Task): FocusSession {
  const settings = getSettings();
  const themeId = getTheme(settings.theme || 'emerald').id;
  const segments = buildFocusSegments(task.dur);
  const currentSegmentIndex = Math.min(task.focus_segment_index ?? 0, Math.max(segments.length - 1, 0));
  const currentSegment = segments[currentSegmentIndex] || segments[0];
  const startedAt = task.focus_segment_started_at ? new Date(task.focus_segment_started_at).getTime() : Date.now();
  const endsAt = task.focus_segment_ends_at ? new Date(task.focus_segment_ends_at).getTime() : startedAt + currentSegment.durationSec * 1000;

  return {
    taskId: task.id,
    taskName: task.name,
    taskDate: task.date,
    totalMinutes: task.dur,
    themeId,
    segments,
    currentSegmentIndex,
    segmentStartedAt: startedAt,
    segmentEndsAt: endsAt,
    midpointPlayed: Boolean(task.focus_midpoint_played),
    lastUpdatedAt: task.focus_updated_at ? new Date(task.focus_updated_at).getTime() : Date.now(),
    completed: Boolean(task.focus_completed),
    paused: Boolean(task.focus_paused),
    pausedRemainingSec: task.focus_paused_remaining_sec,
    snoozedUntil: task.focus_snoozed_until ? new Date(task.focus_snoozed_until).getTime() : undefined,
    skippedBreakIndices: getSkippedBreakIndices(task.id),
  };
}

function reconcileFocusSession(session: FocusSession) {
  if (session.completed || session.paused) return session;

  let nextSession = { ...session };
  let changed = false;
  const now = Date.now();

  while (!nextSession.completed && nextSession.segmentEndsAt <= now) {
    const nextIndex = nextSession.currentSegmentIndex + 1;
    if (nextIndex >= nextSession.segments.length) {
      nextSession = {
        ...nextSession,
        completed: true,
        paused: false,
        pausedRemainingSec: undefined,
        lastUpdatedAt: now,
      };
      changed = true;
      break;
    }

    const nextSegment = nextSession.segments[nextIndex];
    nextSession = {
      ...nextSession,
      currentSegmentIndex: nextIndex,
      segmentStartedAt: nextSession.segmentEndsAt,
      segmentEndsAt: nextSession.segmentEndsAt + nextSegment.durationSec * 1000,
      midpointPlayed: false,
      paused: false,
      pausedRemainingSec: undefined,
      snoozedUntil: undefined,
      lastUpdatedAt: now,
      completed: false,
    };
    changed = true;
  }

  if (changed) {
    saveFocusSession(nextSession);
  }

  return nextSession;
}

function getSkippedBreakIndices(taskId: string) {
  return readJson<Record<string, number[]>>(FOCUS_UI_STATE_KEY, {})[taskId] || [];
}

function saveSkippedBreakIndices(taskId: string, indices: number[]) {
  const state = readJson<Record<string, number[]>>(FOCUS_UI_STATE_KEY, {});
  state[taskId] = indices;
  localStorage.setItem(FOCUS_UI_STATE_KEY, JSON.stringify(state));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
