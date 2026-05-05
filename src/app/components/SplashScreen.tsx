import { useEffect, useMemo, useState } from 'react';
import BrandLogo from './BrandLogo';
import { DAYFLOW_TAGLINE } from '../lib/branding';

interface SplashScreenProps {
  visible: boolean;
}

export default function SplashScreen({ visible }: SplashScreenProps) {
  const [rendered, setRendered] = useState(visible);
  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: `${8 + ((index * 17) % 84)}%`,
        bottom: `${4 + ((index * 11) % 28)}%`,
        duration: `${6 + (index % 5)}s`,
        delay: `${(index % 6) * 0.4}s`,
      })),
    []
  );

  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }

    const timeout = window.setTimeout(() => setRendered(false), 650);
    return () => window.clearTimeout(timeout);
  }, [visible]);

  if (!rendered) return null;

  return (
    <div className={`dayflow-splash ${visible ? '' : 'hide'}`}>
      <div className="dayflow-splash-bg" />
      <div className="dayflow-splash-particles">
        {sparks.map((spark) => (
          <span
            key={spark.id}
            className="dayflow-spark"
            style={{
              left: spark.left,
              bottom: spark.bottom,
              animationDuration: spark.duration,
              animationDelay: spark.delay,
            }}
          />
        ))}
      </div>
      <div className="dayflow-splash-content">
        <div className="dayflow-splash-logo-wrap">
          <div className="dayflow-splash-ring dayflow-splash-ring-1" />
          <div className="dayflow-splash-ring dayflow-splash-ring-2" />
          <BrandLogo size={100} />
        </div>
        <h1 className="dayflow-splash-title">
          <span style={{ color: '#fff' }}>Day</span>
          <span style={{ color: 'var(--accent)' }}>Flow</span>
        </h1>
        <p className="dayflow-splash-tagline">{DAYFLOW_TAGLINE}</p>
        <div className="dayflow-splash-loader">
          <div className="dayflow-splash-bar" />
        </div>
      </div>
    </div>
  );
}
