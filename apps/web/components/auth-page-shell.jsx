import Head from 'next/head';
import Link from 'next/link';
import { HamiBrand } from './hami-brand';

export function AuthPageShell({ mode = 'login', title, description, children }) {
  const isRegister = mode === 'register';
  return <div className="auth-experience" dir="rtl" lang="fa">
    <Head>
      <title>{isRegister ? 'ثبت‌نام' : 'ورود'} | حامی‌کارت</title>
      <meta name="description" content={description} />
    </Head>
    <header className="auth-site-header">
      <HamiBrand />
      <Link className="auth-home-link" href="/">بازگشت به صفحه اصلی</Link>
    </header>
    <main className="auth-stage">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-panel-heading">
          <span className="auth-kicker">{isRegister ? 'شروع عضویت' : 'ورود به حساب کاربری'}</span>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </div>
        {children}
        <p className="auth-switch-copy">
          {isRegister ? 'حساب کاربری دارید؟' : 'هنوز عضو حامی‌کارت نشده‌اید؟'}{' '}
          <Link href={isRegister ? '/login' : '/register'}>{isRegister ? 'ورود' : 'ساخت حساب'}</Link>
        </p>
      </section>
      <aside className="auth-visual" aria-label="معرفی حامی‌کارت">
        <div className="auth-visual-orbit auth-visual-orbit--one" />
        <div className="auth-visual-orbit auth-visual-orbit--two" />
        <div className="auth-visual-copy">
          <span className="auth-visual-label">همراه مسیر سلامت</span>
          <h2>خدمات درمانی،<br /><span>با مزایای روشن</span></h2>
          <p>پیش از انتخاب، جزئیات هر خدمت و شرایط استفاده را بررسی کنید.</p>
        </div>
        <div className="auth-card-preview" aria-hidden="true">
          <HamiBrand compact />
          <span className="auth-card-chip">H+</span>
          <span className="auth-card-caption">کارت خدمات درمانی</span>
          <strong>حامی‌کارت</strong>
          <span className="auth-card-lines"><i /><i /><i /><i /></span>
        </div>
        <div className="auth-visual-note"><span aria-hidden="true">✓</span> اطلاعات حساب شما برای ورود امن استفاده می‌شود.</div>
      </aside>
    </main>
    <footer className="auth-site-footer"><HamiBrand compact /><span>خدمات درمانی، با انتخابی آگاهانه</span></footer>
  </div>;
}
