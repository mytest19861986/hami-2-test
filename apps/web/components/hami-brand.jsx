export function HamiBrand({ compact = false, className = '' }) {
  const classes = ['home-brand', compact && 'home-brand--compact', className].filter(Boolean).join(' ');
  return <a className={classes} href="/" aria-label="حامی‌کارت، صفحه اصلی">
    <img src="/hami-card-logo.png" alt="" width="48" height="48" />
    <span><strong>حامی‌کارت</strong><small>سامانه تخفیف درمانی</small></span>
  </a>;
}
