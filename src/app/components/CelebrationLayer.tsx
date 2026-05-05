import { useEffect, useRef, useState } from 'react';

let triggerCelebrationFn: ((message?: string) => void) | null = null;

const MESSAGES = [
  'Every task done is a promise kept to yourself.',
  "Momentum is building. Don't break the chain now.",
  'Progress, not perfection. Keep stacking clean reps.',
  'Discipline today, freedom tomorrow.',
  'You finished what you planned. That is how trust in your system is built.',
  'Consistency compounds quietly. This task just added to it.',
  'One completed block is small in the moment and huge over time.',
  'You did the hard part: you followed through when it counted.',
];

const EMOJIS = ['🎉', '⚡', '🌟', '🔥'];

export function triggerCelebration(message?: string) {
  triggerCelebrationFn?.(message);
}

export default function CelebrationLayer() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(MESSAGES[0]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    triggerCelebrationFn = (incoming) => {
      setMessage(incoming || MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
      setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
      setVisible(true);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setVisible(false);
        timeoutRef.current = null;
      }, 5400);
    };

    return () => {
      triggerCelebrationFn = null;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[90px] z-[240] flex justify-center px-4">
      <div className="dayflow-celebration rounded-[var(--r-lg)] border border-[rgba(var(--accent-rgb),0.35)] px-5 py-4 text-center">
        <div className="mb-1 text-[30px]">{emoji}</div>
        <div className="text-[13px] italic text-[var(--muted2)]">{message}</div>
      </div>
    </div>
  );
}
