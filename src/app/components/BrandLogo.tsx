import { DAYFLOW_LOGO_SRC } from '../lib/branding';

interface BrandLogoProps {
  size?: number;
  compact?: boolean;
}

export default function BrandLogo({ size = 42, compact = false }: BrandLogoProps) {
  return (
    <div className={`dayflow-brand ${compact ? 'dayflow-brand-compact' : ''}`}>
      <img
        src={DAYFLOW_LOGO_SRC}
        alt="DayFlow"
        width={size}
        height={size}
        className="dayflow-brand-image"
        style={{ width: size, height: size }}
      />
      <div className="dayflow-brand-text">
        <span style={{ color: '#fff' }}>Day</span>
        <span style={{ color: 'var(--accent)' }}>Flow</span>
      </div>
    </div>
  );
}
