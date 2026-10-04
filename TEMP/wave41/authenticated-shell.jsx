import { useEffect, useState } from 'react';

export function AuthenticatedShell({ area, brandHref, brandSubtitle, accountLabel, logout, logoutError, links, title, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationId = `authenticated-navigation-${area}`;

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeOnEscape(event) { if (event.key === 'Escape') setMenuOpen(false); }
    globalThis.addEventListener('keydown', closeOnEscape);
    return () => globalThis.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return <main dir="rtl" lang="fa" className="authenticated-shell">
    <header className="app-header">
      <a className="brand" href={brandHref}>
        <span className={`brand-mark${area === 'admin' ? ' brand-mark--admin' : ''}`} aria-hidden="true">ح</span>
        <span><strong>حامی کارت</strong><small>{brandSubtitle}</small></span>
      </a>
      <div className="header-account">
        <span className="account-label">{accountLabel}</span>
        <button className="button button--ghost" type="button" onClick={logout}>خروج</button>
      </div>
      <button className="button button--ghost navigation-toggle" type="button" aria-label={menuOpen ? 'بستن ناوبری' : 'بازکردن ناوبری'} aria-expanded={menuOpen} aria-controls={navigationId} onClick={() => setMenuOpen((open) => !open)}>
        <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
      </button>
    </header>
    {logoutError && <p className="logout-error" role="alert">{logoutError}</p>}
    <div className="app-layout">
      {menuOpen && <button className="navigation-backdrop" type="button" aria-label="بستن ناوبری" onClick={() => setMenuOpen(false)} />}
      <aside id={navigationId} className={`app-sidebar${menuOpen ? ' app-sidebar--open' : ''}`}>
        <p className="nav-heading">{area === 'admin' ? 'مرکز عملیات' : area === 'support' ? 'مرکز پشتیبانی' : 'فضای کاربری'}</p>
        <nav aria-label={area === 'admin' ? 'ناوبری مدیریت' : area === 'support' ? 'ناوبری پشتیبانی' : 'ناوبری کاربر'}>
          {links.map(([href, label]) => href === 'section' ? <p className="nav-heading nav-heading--spaced" key={label}>{label}</p> : href ? <a className="nav-link" href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</a> : <p className="nav-heading nav-heading--spaced" key={label}>{label}</p>)}
        </nav>
      </aside>
      <section className="app-content"><div className="content-title"><p className="page-eyebrow">{area === 'admin' ? 'مدیریت' : area === 'support' ? 'دسترسی محدود' : 'حامی کارت'}</p><h1>{title}</h1></div>{children}</section>
    </div>
  </main>;
}
