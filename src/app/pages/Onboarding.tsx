import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getProfile, saveProfile } from '../lib/storage';
import BrandLogo from '../components/BrandLogo';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [dayMode, setDayMode] = useState<'weekday' | 'weekend'>('weekday');

  const [wdBed, setWdBed] = useState('23:00');
  const [wdWake, setWdWake] = useState('07:00');
  const [weBed, setWeBed] = useState('00:00');
  const [weWake, setWeWake] = useState('08:00');

  const [morningMins, setMorningMins] = useState(30);
  const [eveningMins, setEveningMins] = useState(30);

  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');

  const navigate = useNavigate();

  const calculateSleepDuration = (bed: string, wake: string): string => {
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let bedMins = bh * 60 + bm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= bedMins) wakeMins += 24 * 60;
    const dur = wakeMins - bedMins;
    const h = Math.floor(dur / 60);
    const m = dur % 60;
    const label = m > 0 ? `${h}h ${m}m` : `${h}h`;
    const emoji = dur >= 420 ? '🟢' : dur >= 360 ? '🟡' : '🔴';
    return `Sleep duration: ${label} ${emoji}`;
  };

  const handleFinish = () => {
    const profile = {
      name,
      wdBed,
      wdWake,
      weBed,
      weWake,
      morningMins,
      eveningMins,
      workStart,
      workEnd,
      setupDone: true,
    };
    saveProfile(profile);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div
        className="w-full max-w-md p-8 rounded-[var(--r-lg)] border border-[var(--border)]"
        style={{ background: 'var(--surface)', boxShadow: '0 8px 32px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)' }}
      >
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <BrandLogo size={68} />
          </div>
          <div
            style={{
              fontFamily: 'var(--ff-head)',
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: '4px',
            }}
          >
            Welcome to DayFlow
          </div>
          <p className="text-[13px] text-[var(--muted2)] leading-relaxed">Let's set up your daily routine</p>
        </div>

        <div className="flex gap-2 justify-center mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                s === step ? 'bg-[var(--accent)] scale-125' : s < step ? 'bg-[var(--accent2)]' : 'bg-[var(--surface3)]'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center text-4xl mb-3">👋</div>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: '17px', fontWeight: 700, marginBottom: '5px' }}>
              What's your name?
            </div>
            <p className="text-[13px] text-[var(--muted2)] mb-5 leading-relaxed">
              We'll use this to personalise your experience
            </p>
            <div>
              <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[15px] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full py-3 mt-4 rounded-[var(--r)] bg-[var(--accent)] text-[var(--bg)] font-semibold text-[15px] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center text-4xl mb-3">😴</div>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: '17px', fontWeight: 700, marginBottom: '5px' }}>
              Sleep schedule
            </div>
            <p className="text-[13px] text-[var(--muted2)] mb-5 leading-relaxed">
              When do you usually sleep and wake up?
            </p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDayMode('weekday')}
                className={`flex-1 py-2 px-3 rounded-[var(--r)] text-[13px] font-medium transition-all ${
                  dayMode === 'weekday'
                    ? 'bg-[var(--accent)] text-[var(--bg)]'
                    : 'bg-[var(--surface2)] text-[var(--muted)] border border-[var(--border)]'
                }`}
              >
                Weekday
              </button>
              <button
                onClick={() => setDayMode('weekend')}
                className={`flex-1 py-2 px-3 rounded-[var(--r)] text-[13px] font-medium transition-all ${
                  dayMode === 'weekend'
                    ? 'bg-[var(--accent)] text-[var(--bg)]'
                    : 'bg-[var(--surface2)] text-[var(--muted)] border border-[var(--border)]'
                }`}
              >
                Weekend
              </button>
            </div>

            {dayMode === 'weekday' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                      Bedtime
                    </label>
                    <input
                      type="time"
                      value={wdBed}
                      onChange={(e) => setWdBed(e.target.value)}
                      className="w-full px-3 py-2 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[14px] outline-none transition-colors focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                      Wake up
                    </label>
                    <input
                      type="time"
                      value={wdWake}
                      onChange={(e) => setWdWake(e.target.value)}
                      className="w-full px-3 py-2 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[14px] outline-none transition-colors focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                <div className="text-[12px] text-[var(--muted2)] text-center py-2">
                  {calculateSleepDuration(wdBed, wdWake)}
                </div>
              </div>
            )}

            {dayMode === 'weekend' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                      Bedtime
                    </label>
                    <input
                      type="time"
                      value={weBed}
                      onChange={(e) => setWeBed(e.target.value)}
                      className="w-full px-3 py-2 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[14px] outline-none transition-colors focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                      Wake up
                    </label>
                    <input
                      type="time"
                      value={weWake}
                      onChange={(e) => setWeWake(e.target.value)}
                      className="w-full px-3 py-2 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[14px] outline-none transition-colors focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                <div className="text-[12px] text-[var(--muted2)] text-center py-2">
                  {calculateSleepDuration(weBed, weWake)}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-[var(--r)] bg-[var(--surface2)] text-[var(--text)] font-semibold text-[15px] transition-opacity hover:opacity-90"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-[var(--r)] bg-[var(--accent)] text-[var(--bg)] font-semibold text-[15px] transition-opacity hover:opacity-90"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center text-4xl mb-3">🌅</div>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: '17px', fontWeight: 700, marginBottom: '5px' }}>
              Morning & evening routines
            </div>
            <p className="text-[13px] text-[var(--muted2)] mb-5 leading-relaxed">
              How much time do you need for your routines?
            </p>

            <div>
              <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                Morning routine (minutes)
              </label>
              <input
                type="number"
                value={morningMins}
                onChange={(e) => setMorningMins(Number(e.target.value))}
                min="0"
                max="180"
                className="w-full px-4 py-3 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[15px] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                Evening wind-down (minutes)
              </label>
              <input
                type="number"
                value={eveningMins}
                onChange={(e) => setEveningMins(Number(e.target.value))}
                min="0"
                max="180"
                className="w-full px-4 py-3 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[15px] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-[var(--r)] bg-[var(--surface2)] text-[var(--text)] font-semibold text-[15px] transition-opacity hover:opacity-90"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-[var(--r)] bg-[var(--accent)] text-[var(--bg)] font-semibold text-[15px] transition-opacity hover:opacity-90"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center text-4xl mb-3">💼</div>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: '17px', fontWeight: 700, marginBottom: '5px' }}>
              Work hours
            </div>
            <p className="text-[13px] text-[var(--muted2)] mb-5 leading-relaxed">
              When do you typically work?
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                  Start time
                </label>
                <input
                  type="time"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[14px] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
                  End time
                </label>
                <input
                  type="time"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[14px] outline-none transition-colors focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-[var(--r)] bg-[var(--surface2)] text-[var(--text)] font-semibold text-[15px] transition-opacity hover:opacity-90"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-3 rounded-[var(--r)] bg-[var(--accent)] text-[var(--bg)] font-semibold text-[15px] transition-opacity hover:opacity-90"
              >
                Finish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
