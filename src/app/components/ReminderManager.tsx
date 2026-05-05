import { MutableRefObject, useEffect, useRef } from 'react';
import { getSettings, getTasks, SETTINGS_UPDATED_EVENT, TASKS_UPDATED_EVENT } from '../lib/storage';

const REMINDER_COPY = [
  (name: string) => `Time to roll: ${name}`,
  (name: string) => `Small nudge, big win. Start "${name}" now.`,
  (name: string) => `Your plan is calling. ${name} starts soon.`,
  (name: string) => `Focus mode: ${name}`,
];

function notificationBody(taskTime?: string) {
  return taskTime ? `Scheduled for ${taskTime}. Open DayFlow and get it done.` : 'Open DayFlow and keep your streak alive.';
}

export default function ReminderManager() {
  const timers = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const reschedule = () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];

      const settings = getSettings();
      if (!settings.notifications) return;

      const reminderLead = Number(settings.reminderMin ?? 10);
      const now = Date.now();

      getTasks()
        .filter((task) => !task.done && task.time)
        .forEach((task) => {
          const target = new Date(`${task.date}T${task.time}:00`).getTime() - reminderLead * 60_000;
          if (Number.isNaN(target) || target <= now) return;

          const timer = window.setTimeout(() => {
            const title = REMINDER_COPY[Math.floor(Math.random() * REMINDER_COPY.length)](task.name);
            if (document.visibilityState === 'visible') {
              playChime(audioCtxRef);
            }
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(title, {
                body: notificationBody(task.time),
                icon: '/dayflow-app-icon.jpg',
                badge: '/dayflow-app-icon.jpg',
                tag: `task-${task.id}`,
                renotify: true,
              });
            }
          }, target - now);

          timers.current.push(timer);
        });
    };

    reschedule();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reschedule();
    };

    window.addEventListener(TASKS_UPDATED_EVENT, reschedule as EventListener);
    window.addEventListener(SETTINGS_UPDATED_EVENT, reschedule as EventListener);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener(TASKS_UPDATED_EVENT, reschedule as EventListener);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, reschedule as EventListener);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}

function playChime(audioRef: MutableRefObject<AudioContext | null>) {
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const context = audioRef.current ?? new AudioCtor();
    audioRef.current = context;

    if (context.state === 'suspended') {
      void context.resume();
    }

    const beepTimes = [0, 0.42, 0.84];

    beepTimes.forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      const end = start + 0.26;

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, start);
      oscillator.frequency.exponentialRampToValueAtTime(740, end);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);
    });
  } catch {
    // best-effort sound only
  }
}
