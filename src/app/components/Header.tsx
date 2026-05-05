import BrandLogo from './BrandLogo';

export default function Header() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <header className="lg:hidden sticky top-0 z-50 h-[72px] flex items-center justify-between px-5 bg-[rgba(11,15,26,0.82)] backdrop-blur-[18px] border-b border-[var(--border)]">
      <BrandLogo size={30} compact />
      <div className="text-[12px] text-[var(--muted2)]">{dateStr}</div>
    </header>
  );
}
