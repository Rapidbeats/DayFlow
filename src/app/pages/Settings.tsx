import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { THEMES, applyThemeToDOM, getTheme } from '../lib/themes';
import { getProfile, getSettings, saveSetting, saveTasks } from '../lib/storage';
import { getSleepHours, getSleepWindow } from '../lib/planner';
import { requestConfirm } from '../components/ConfirmSheet';
import { getPwaInstallState, promptInstall, subscribeToPwaInstallState } from '../lib/pwa';

export default function Settings() {
  const { user, signOut, deleteAllTasksFromCloud } = useAuth();
  const [currentTheme, setCurrentTheme] = useState('emerald');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [reminderMin, setReminderMin] = useState(10);
  const [canInstallApp, setCanInstallApp] = useState(false);
  const [isInstalledApp, setIsInstalledApp] = useState(false);
  const navigate = useNavigate();
  const profile = getProfile();

  useEffect(() => {
    const settings = getSettings();
    setCurrentTheme(getTheme(settings.theme || 'emerald').id);
    setNotificationsEnabled(Boolean(settings.notifications));
    setReminderMin(Number(settings.reminderMin ?? 10));

    const initialPwa = getPwaInstallState();
    setCanInstallApp(initialPwa.canInstall);
    setIsInstalledApp(initialPwa.installed);

    return subscribeToPwaInstallState((state) => {
      setCanInstallApp(state.canInstall);
      setIsInstalledApp(state.installed);
    });
  }, []);

  const handleInstallApp = async () => {
    const installed = await promptInstall();
    if (installed) {
      await requestConfirm({
        title: 'DayFlow installed',
        message: 'DayFlow can now open from your home screen with local storage and cloud sync support.',
        confirmLabel: 'Nice',
        cancelLabel: 'Close',
      });
    }
  };

  const handleThemeChange = (themeId: string) => {
    const theme = getTheme(themeId);
    applyThemeToDOM(theme);
    setCurrentTheme(themeId);
    saveSetting('theme', themeId);
  };

  const handleNotificationsToggle = async () => {
    const nextValue = !notificationsEnabled;

    if (nextValue && 'Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotificationsEnabled(false);
        saveSetting('notifications', false);
        return;
      }
    }

    if (nextValue && 'Notification' in window && Notification.permission === 'denied') {
      await requestConfirm({
        title: 'Notifications are blocked',
        message: 'Enable browser notifications in your device settings to get DayFlow reminders.',
        confirmLabel: 'Okay',
        cancelLabel: 'Close',
      });
      return;
    }

    setNotificationsEnabled(nextValue);
    saveSetting('notifications', nextValue);
  };

  const handleReminderChange = (value: number) => {
    setReminderMin(value);
    saveSetting('reminderMin', value);
  };

  const handleSignOut = async () => {
    const confirmed = await requestConfirm({
      title: 'Sign out?',
      message: 'You can sign back in anytime to sync your DayFlow account again.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay here',
    });
    if (!confirmed) return;

    await signOut();
    navigate('/auth');
  };

  const handleResetOnboarding = async () => {
    const confirmed = await requestConfirm({
      title: 'Redo onboarding?',
      message: 'This will take you through your setup flow again, while keeping your account signed in.',
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    navigate('/onboarding');
  };

  const handleClearAll = async () => {
    const confirmed = await requestConfirm({
      title: 'Clear all tasks?',
      message: 'This removes every scheduled task from this account and device.',
      confirmLabel: 'Clear all',
      cancelLabel: 'Keep tasks',
      danger: true,
    });
    if (!confirmed) return;

    saveTasks([]);
    await deleteAllTasksFromCloud();
  };

  const weekdayDate = dateForWeekday(2);
  const weekendDate = dateForWeekday(0);
  const weekdaySleep = getSleepWindow(profile, weekdayDate);
  const weekendSleep = getSleepWindow(profile, weekendDate);
  const weekdaySleepHours = getSleepHours(profile, weekdayDate).length;
  const weekendSleepHours = getSleepHours(profile, weekendDate).length;

  return (
    <div className="max-w-4xl mx-auto p-5 space-y-5">
      <h1
        style={{
          fontFamily: 'var(--ff-head)',
          fontSize: '24px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        Settings
      </h1>

      <div className="p-6 rounded-[var(--r-lg)] border border-[var(--border)] dayflow-install-card" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-4 mb-4">
          <img src="/dayflow-app-icon.jpg" alt="DayFlow" className="w-16 h-16 rounded-[18px] border border-[var(--border)]" />
          <div>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: '18px', fontWeight: 700 }}>Install DayFlow</div>
            <div className="text-[13px] text-[var(--muted2)] mt-1">
              Add DayFlow to your home screen and use it like an app with local-first planning and cloud sync.
            </div>
          </div>
        </div>

        {canInstallApp ? (
          <button
            onClick={() => void handleInstallApp()}
            className="w-full py-3 px-4 rounded-[var(--r)] bg-[var(--accent)] text-[var(--bg)] text-[14px] font-semibold hover:opacity-90 transition-opacity"
          >
            Install app
          </button>
        ) : (
          <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface2)] p-4">
            <div className="text-[13px] font-medium text-[var(--text)] mb-2">
              {isInstalledApp ? 'DayFlow is already installed on this device.' : 'Use your browser menu to add DayFlow to the home screen.'}
            </div>
            <ol className="text-[12px] text-[var(--muted2)] space-y-2 list-decimal pl-5">
              <li>Open DayFlow in Chrome or Safari on your phone.</li>
              <li>Tap the browser share/menu action.</li>
              <li>Choose `Install app` or `Add to Home Screen`.</li>
            </ol>
          </div>
        )}
      </div>

      <div className="p-6 rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-2">
          <div style={{ fontFamily: 'var(--ff-head)', fontSize: '15px', fontWeight: 700 }}>Accent colour</div>
          <div className="text-[12px] font-medium" style={{ color: 'var(--accent)' }}>
            {getTheme(currentTheme).name}
          </div>
        </div>
        <p className="text-[12px] text-[var(--muted2)] mb-4">Tap a colour to change the app theme</p>
        <div className="grid grid-cols-4 gap-3">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className="flex flex-col items-center gap-2 p-2 rounded-[var(--r)] transition-all hover:bg-[var(--surface2)]"
            >
              <div
                className={`w-14 h-14 rounded-full ${
                  currentTheme === theme.id ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : ''
                }`}
                style={{ background: theme.swatch }}
              />
              <span
                className="text-[11px] text-center"
                style={{
                  color: currentTheme === theme.id ? 'var(--accent)' : 'var(--muted2)',
                  fontWeight: currentTheme === theme.id ? 600 : 400,
                }}
              >
                {theme.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: '15px', fontWeight: 700 }}>Reminders</div>
            <p className="text-[12px] text-[var(--muted2)] mt-1">Browser notifications with an in-app chime while DayFlow is open.</p>
          </div>
          <button
            type="button"
            onClick={() => void handleNotificationsToggle()}
            className={`dayflow-toggle ${notificationsEnabled ? 'is-on' : ''}`}
            aria-pressed={notificationsEnabled}
            aria-label={notificationsEnabled ? 'Disable reminders' : 'Enable reminders'}
          >
            <span className="dayflow-toggle-thumb" />
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-[11px] text-[var(--muted2)] font-medium mb-2 uppercase tracking-wider">
            Remind me before task time
          </label>
          <select
            value={reminderMin}
            onChange={(event) => handleReminderChange(Number(event.target.value))}
            className="w-full px-3 py-3 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[14px] outline-none"
          >
            <option value="5">5 minutes before</option>
            <option value="10">10 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
          </select>
        </div>
      </div>

      <div className="p-6 rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <div style={{ fontFamily: 'var(--ff-head)', fontSize: '15px', fontWeight: 700 }}>Daily reflection</div>
            <p className="text-[12px] text-[var(--muted2)] mt-1">A fast end-of-day check-in that turns your task history into useful insight.</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/reflection')}
          className="w-full py-3 px-4 rounded-[var(--r)] bg-[var(--surface2)] text-[var(--text)] text-[14px] font-medium hover:bg-[var(--surface3)] transition-colors"
        >
          Open daily reflection
        </button>
      </div>

      <div className="p-6 rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div style={{ fontFamily: 'var(--ff-head)', fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
          Sleep schedule
        </div>
        <div className="space-y-3">
          <SleepRow label="Weekdays" hours={weekdaySleepHours} bed={weekdaySleep.bed} wake={weekdaySleep.wake} />
          <SleepRow label="Weekends" hours={weekendSleepHours} bed={weekendSleep.bed} wake={weekendSleep.wake} />
        </div>
      </div>

      <div className="p-6 rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div style={{ fontFamily: 'var(--ff-head)', fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>
          Cloud sync
        </div>
        <div className="text-[13px] text-[var(--muted2)] leading-relaxed">
          Cloud sync is <span style={{ color: 'var(--accent)', fontWeight: 600 }}>active</span> - your tasks are
          automatically saved and synced across your devices.
        </div>
      </div>

      <div className="p-6 rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div style={{ fontFamily: 'var(--ff-head)', fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>
          Account
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-[var(--r)] bg-[var(--surface2)]">
            <div>
              <div className="text-[13px] font-medium">Email</div>
              <div className="text-[12px] text-[var(--muted2)] mt-1">{user?.email}</div>
            </div>
          </div>
          {profile.name && (
            <div className="flex items-center justify-between p-3 rounded-[var(--r)] bg-[var(--surface2)]">
              <div>
                <div className="text-[13px] font-medium">Name</div>
                <div className="text-[12px] text-[var(--muted2)] mt-1">{profile.name}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div className="space-y-3">
          <button
            onClick={() => void handleClearAll()}
            className="w-full py-3 px-4 rounded-[var(--r)] bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.24)] text-[var(--danger)] text-[14px] font-medium hover:bg-[rgba(248,113,113,0.18)] transition-colors"
          >
            Clear all tasks
          </button>
          <button
            onClick={() => void handleResetOnboarding()}
            className="w-full py-3 px-4 rounded-[var(--r)] bg-[var(--surface2)] text-[var(--text)] text-[14px] font-medium hover:bg-[var(--surface3)] transition-colors"
          >
            Reset onboarding
          </button>
          <button
            onClick={() => void handleSignOut()}
            className="w-full py-3 px-4 rounded-[var(--r)] bg-[var(--surface2)] text-[var(--danger)] text-[14px] font-medium hover:bg-[var(--surface3)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function SleepRow({ label, hours, bed, wake }: { label: string; hours: number; bed: string; wake: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-[var(--r)] bg-[var(--surface2)] text-[13px] text-[var(--muted2)]">
      <div>
        <div className="text-[13px] font-medium text-[var(--text)]">{label}</div>
        <div className="mt-1">
          {bed} to {wake}
        </div>
      </div>
      <div className="text-[var(--accent)] font-semibold">{hours}h</div>
    </div>
  );
}

function dateForWeekday(targetDay: number) {
  const date = new Date();
  const diff = targetDay - date.getDay();
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
}
