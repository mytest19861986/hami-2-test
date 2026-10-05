export function AuthPageShell({ eyebrow, title, description, footer, children }) {
  return (
    <main className="auth-page" dir="rtl" lang="fa">
      <div className="auth-shell">
        <section className="auth-brand-panel" aria-label="حامی کارت">
          <div className="auth-brand-copy">
            <p className="auth-wordmark">حامی کارت</p>
            <p className="auth-brand-description">سامانه خدمات درمانی و طرح‌های حمایتی</p>
          </div>
          <span className="auth-brand-rule" aria-hidden="true" />
          <p className="auth-brand-note">دسترسی به حساب کاربری</p>
        </section>

        <section className="auth-panel" aria-labelledby="auth-page-title">
          <header className="auth-header">
            <p className="auth-eyebrow">{eyebrow}</p>
            <h1 id="auth-page-title">{title}</h1>
            <p className="auth-description">{description}</p>
          </header>
          {children}
          <footer className="auth-footer">{footer}</footer>
        </section>
      </div>
    </main>
  );
}
