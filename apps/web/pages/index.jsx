import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';

const searchTabs = [
  { id: 'doctor', label: 'پزشک', icon: 'doctor', placeholder: 'نام پزشک یا نوع خدمت را جستجو کنید' },
  { id: 'center', label: 'مرکز درمانی', icon: 'building', placeholder: 'نام مرکز درمانی را جستجو کنید' },
  { id: 'service', label: 'خدمات و آزمایش‌ها', icon: 'flask', placeholder: 'نام خدمت یا آزمایش را جستجو کنید' },
];

const suggestions = ['تصویربرداری MRI', 'متخصص زنان', 'دندان‌پزشکی', 'آزمایش خون'];
const categories = [
  { title: 'دندان‌پزشکی', meta: 'خدمات دندان‌پزشکی', icon: 'tooth' },
  { title: 'تصویربرداری', meta: 'رادیولوژی و MRI', icon: 'scan' },
  { title: 'پوست و مو', meta: 'خدمات تخصصی', icon: 'spark' },
  { title: 'آزمایشگاه', meta: 'آزمایش و چکاپ', icon: 'flask' },
  { title: 'ارتوپدی', meta: 'سلامت استخوان', icon: 'bone' },
  { title: 'زنان و زایمان', meta: 'مراقبت تخصصی', icon: 'care' },
  { title: 'داروخانه', meta: 'دارو و نسخه', icon: 'pill' },
];

const demoProviders = [
  { kind: 'doctor', name: 'پزشک نمونه', specialty: 'پزشک عمومی', location: 'اطلاعات موقعیت نمایشی', image: '/home-demo-doctor-a.png', tone: 'mint' },
  { kind: 'center', name: 'مرکز نمونه تصویربرداری', specialty: 'تصویربرداری پزشکی', location: 'اطلاعات موقعیت نمایشی', image: '/home-demo-imaging.png', tone: 'peach' },
  { kind: 'doctor', name: 'متخصص نمونه', specialty: 'متخصص پوست و مو', location: 'اطلاعات موقعیت نمایشی', image: '/home-demo-doctor-b.png', tone: 'blue' },
  { kind: 'center', name: 'آزمایشگاه نمونه', specialty: 'آزمایش‌های تشخیصی', location: 'اطلاعات موقعیت نمایشی', image: '/home-demo-doctor-c.png', tone: 'lilac' },
  { kind: 'doctor', name: 'پزشک نمونه دوم', specialty: 'خدمات تخصصی', location: 'اطلاعات موقعیت نمایشی', image: '/home-demo-doctor-a.png', tone: 'mint' },
];

const benefits = [
  { title: 'انتخاب آگاهانه', copy: 'اطلاعات خدمات را پیش از مراجعه بررسی کنید.', icon: 'users' },
  { title: 'جستجوی ساده', copy: 'پزشک، مرکز یا خدمت موردنیازتان را پیدا کنید.', icon: 'search' },
  { title: 'مزایای حامی‌کارت', copy: 'جزئیات هر مزیت در صفحه همان خدمت نمایش داده می‌شود.', icon: 'percent' },
  { title: 'همراهی در مسیر', copy: 'از جستجو تا انتخاب، مسیر روشن و قابل پیگیری است.', icon: 'headset' },
];

function Icon({ name, size = 22, className = '' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></>,
    doctor: <><path d="M8 4v4a4 4 0 0 0 8 0V4" /><path d="M6 4h4M14 4h4M12 12v3a5 5 0 0 0 10 0" /><circle cx="22" cy="14" r="1" /><path d="M9 21h7" /></>,
    building: <><path d="M4 21V5l8-3 8 3v16M2 21h20" /><path d="M8 8h1m6 0h1M8 12h1m6 0h1M10 21v-4h4v4" /></>,
    flask: <><path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3" /><path d="M7 16h10" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
    arrow: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    percent: <><path d="M19 5 5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2" /><path d="M3 13h4v7H5a2 2 0 0 1-2-2v-5Zm18 0h-4v7h2a2 2 0 0 0 2-2v-5ZM17 20a5 5 0 0 1-5 2h-1" /></>,
    tooth: <><path d="M12 4C7 1 3 5 4 11c1 5 3 10 5 10 2 0 1-6 3-6s1 6 3 6c2 0 4-5 5-10 1-6-3-10-8-7Z" /></>,
    scan: <><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" /><circle cx="12" cy="12" r="5" /><path d="M12 9v6m-3-3h6" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
    bone: <><path d="M7 7a3 3 0 1 1 4-4l6 6a3 3 0 1 1 4 4l-6 6a3 3 0 1 1-4 4l-6-6a3 3 0 1 1-4-4l6-6Z" /></>,
    care: <><path d="M20.8 8.8c0 5.3-8.8 11-8.8 11S3.2 14.1 3.2 8.8a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z" /><path d="M12 8v5m-2.5-2.5h5" /></>,
    pill: <><path d="m4.9 19.1-.1-.1a5 5 0 0 1 0-7.1l7.1-7.1a5 5 0 0 1 7.1 7.1l-7.1 7.1a5 5 0 0 1-7 0Z" /><path d="m8 8 8 8" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    chevronLeft: <path d="m14 18-6-6 6-6" />,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  };
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name] || paths.spark}</svg>;
}

function Brand({ compact = false }) {
  return <a className={`home-brand${compact ? ' home-brand--compact' : ''}`} href="/" aria-label="حامی‌کارت، صفحه اصلی">
    <img src="/hami-card-logo.png" alt="" width="48" height="48" />
    <span><strong>حامی‌کارت</strong><small>سامانه تخفیف درمانی</small></span>
  </a>;
}

function ProviderCard({ provider }) {
  return <article className="home-provider-card">
    <span className="home-provider-demo">نمونه نمایشی</span>
    <a className={`home-provider-art home-provider-art--${provider.tone}`} href="/providers" aria-label={`مشاهده فهرست خدمات ${provider.name}`}>
      <img src={provider.image} alt="" width="96" height="100" loading="lazy" />
    </a>
    <div className="home-provider-copy">
      <span className="home-provider-kind">{provider.kind === 'doctor' ? 'پزشک' : 'مرکز درمانی'}</span>
      <h3>{provider.name}</h3>
      <p>{provider.specialty}</p>
      <p className="home-provider-location"><Icon name="pin" size={15} />{provider.location}</p>
      <div className="home-provider-meta"><span>اطلاعات تخفیف در دسترس نیست</span><span>امتیاز ثبت نشده</span></div>
      <a className="home-provider-link" href="/providers">مشاهده فهرست خدمات <Icon name="arrow" size={16} /></a>
    </div>
  </article>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('doctor');
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [searchState, setSearchState] = useState('idle');
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [providerPage, setProviderPage] = useState(0);
  const searchTimer = useRef(null);
  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const activeSearchTab = searchTabs.find((tab) => tab.id === activeTab) || searchTabs[0];
  const visibleProviders = Array.from({ length: 4 }, (_, index) => demoProviders[(providerPage + index) % demoProviders.length]);
  const autocompleteItems = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('fa');
    if (!text) return suggestions;
    return [query.trim(), ...suggestions.filter((item) => item.toLocaleLowerCase('fa').includes(text) && item !== query.trim())].slice(0, 4);
  }, [query]);

  useEffect(() => () => globalThis.clearTimeout(searchTimer.current), []);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = globalThis.document.body.style.overflow;
    const previousFocus = globalThis.document.activeElement;
    globalThis.document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector('a, button')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setDrawerOpen(false); return; }
      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll('a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"]):not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    globalThis.document.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.document.body.style.overflow = previousOverflow;
      globalThis.document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof globalThis.HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [drawerOpen]);

  function chooseSuggestion(value) {
    setQuery(value);
    setSuggestionIndex(-1);
    setSearchState('idle');
    globalThis.document.getElementById('home-search-input')?.focus();
  }

  function submitSearch(event) {
    event.preventDefault();
    globalThis.clearTimeout(searchTimer.current);
    setSearchState('loading');
    setSuggestionIndex(-1);
    searchTimer.current = globalThis.setTimeout(() => {
      const term = query.trim().toLocaleLowerCase('fa');
      const empty = !term || /zzz|ناموجود|بدون.?نتیجه/.test(term);
      setSearchState(empty ? 'empty' : 'results');
      globalThis.document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 650);
  }

  function handleQueryKeyDown(event) {
    if (event.key === 'Escape') { setSearchState('idle'); setSuggestionIndex(-1); }
    if (event.key === 'ArrowDown' && searchState === 'autocomplete') {
      event.preventDefault();
      setSuggestionIndex((index) => Math.min(index + 1, autocompleteItems.length - 1));
    }
    if (event.key === 'ArrowUp' && searchState === 'autocomplete') {
      event.preventDefault();
      setSuggestionIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && searchState === 'autocomplete' && suggestionIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(autocompleteItems[suggestionIndex]);
    }
  }

  function startSearch(term = '') {
    if (term) setQuery(term);
    setSearchState(term ? 'idle' : 'autocomplete');
    globalThis.document.getElementById('home-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    globalThis.setTimeout(() => globalThis.document.getElementById('home-search-input')?.focus(), 250);
  }

  const nav = <>
    <a href="#home">خانه</a><a href="#providers">پزشکان و مراکز</a><a href="/plans">طرح‌های عضویت</a><a href="#how-it-works">درباره ما</a>
  </>;

  return <div className="home-page" dir="rtl" lang="fa">
    <Head><title>حامی‌کارت | خدمات درمانی با مزایای ویژه</title><meta name="description" content="پزشک، مرکز درمانی یا خدمت موردنیازتان را در حامی‌کارت جستجو کنید." /></Head>
    <header className="home-header" id="home">
      <div className="home-header-inner">
        <Brand />
        <nav className="home-desktop-nav" aria-label="ناوبری اصلی">{nav}</nav>
        <div className="home-header-actions">
          <a className="home-button home-button--outline home-login" href="/login">ورود</a>
          <a className="home-button home-button--orange home-header-cta" href="/register">دریافت حامی‌کارت</a>
        </div>
        <button className="home-menu-button" ref={menuButtonRef} type="button" aria-label="باز کردن منو" aria-expanded={drawerOpen} aria-controls="home-mobile-drawer" onClick={() => setDrawerOpen(true)}><Icon name="menu" size={24} /></button>
      </div>
    </header>

    {drawerOpen && <>
      <button className="home-drawer-backdrop" type="button" aria-label="بستن منو" onClick={() => setDrawerOpen(false)} />
      <aside className="home-mobile-drawer" id="home-mobile-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label="منوی اصلی">
        <div className="home-drawer-head"><Brand compact /><button type="button" className="home-icon-button" aria-label="بستن منو" onClick={() => setDrawerOpen(false)}><Icon name="close" /></button></div>
        <nav aria-label="ناوبری موبایل" onClick={(event) => { if (event.target.closest('a')) setDrawerOpen(false); }}>{nav}</nav>
        <div className="home-drawer-actions"><a className="home-button home-button--outline" href="/login">ورود</a><a className="home-button home-button--orange" href="/register">دریافت حامی‌کارت</a></div>
      </aside>
    </>}

    <main>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <p className="home-eyebrow"><span className="home-eyebrow-dot" />عضویت در حامی‌کارت؛ کاهش هزینه‌های درمان</p>
            <h1 id="home-title">همان خدمات درمانی،<br /><span>با هزینه‌ای کمتر</span></h1>
            <p className="home-hero-description">پزشک، مرکز درمانی و خدمات موردنیازت را پیدا کن؛ جزئیات هر مزیت را پیش از انتخاب ببین.</p>
            <div className="home-hero-actions"><a className="home-button home-button--orange" href="/register">دریافت حامی‌کارت <Icon name="card" size={18} /></a><a className="home-button home-button--light" href="#providers">مشاهده پزشکان و مراکز <Icon name="chevronLeft" size={18} /></a></div>
            <p className="home-hero-note"><Icon name="shield" size={17} /> اطلاعات نمونه این صفحه صرفاً نمایشی است.</p>
          </div>
          <div className="home-hero-art" aria-label="پیش‌نمایش گرافیکی حامی‌کارت">
            <div className="home-art-orbit home-art-orbit--one" /><div className="home-art-orbit home-art-orbit--two" />
            <div className="home-promo-panel">
              <div className="home-promo-image"><div className="home-medical-illustration"><span className="home-medical-plus">+</span><span className="home-illustration-cross">✚</span><div className="home-illustration-ring" /></div>
                <div className="home-demo-card">
                  <div className="home-demo-card-top"><Brand compact /><span className="home-card-chip">H+</span></div>
                  <p className="home-demo-card-kicker">کارت خدمات درمانی</p><strong>حامی‌کارت</strong>
                  <div className="home-demo-card-bottom"><span>نمونه نمایشی</span><span className="home-card-bars"><i /><i /><i /><i /></span></div>
                </div>
              </div>
              <div className="home-promo-details"><span className="home-promo-label">نمونه خدمت</span><h2>MRI کمری</h2><p>خدمت تصویربرداری</p><div className="home-promo-rule" /><div className="home-savings-panel"><Icon name="percent" size={22} /><span><small>جزئیات مزیت</small><strong>وابسته به مرکز درمانی</strong></span></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-search-wrap" id="home-search" aria-label="جستجوی خدمات درمانی">
        <form className="home-search-card" onSubmit={submitSearch}>
          <div className="home-search-tabs" role="tablist" aria-label="نوع جستجو">
            {searchTabs.map((tab) => <button key={tab.id} type="button" role="tab" id={`search-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls="search-panel" className={activeTab === tab.id ? 'home-search-tab is-active' : 'home-search-tab'} onClick={() => { setActiveTab(tab.id); setSearchState('idle'); }}><Icon name={tab.icon} size={19} />{tab.label}</button>)}
          </div>
          <div className="home-search-fields" id="search-panel" role="tabpanel" aria-labelledby={`search-tab-${activeTab}`}>
            <div className="home-query-field">
              <Icon name="search" size={20} />
              <label className="home-visually-hidden" htmlFor="home-search-input">{activeSearchTab.placeholder}</label>
              <input id="home-search-input" type="search" autoComplete="off" value={query} placeholder={activeSearchTab.placeholder} aria-expanded={searchState === 'autocomplete'} aria-controls="home-search-suggestions" aria-activedescendant={suggestionIndex >= 0 ? `home-suggestion-${suggestionIndex}` : undefined} onFocus={() => { if (searchState === 'idle' || searchState === 'results' || searchState === 'empty') setSearchState('autocomplete'); }} onChange={(event) => { setQuery(event.target.value); setSearchState('autocomplete'); setSuggestionIndex(-1); }} onKeyDown={handleQueryKeyDown} />
              {query && <button className="home-clear-query" type="button" aria-label="پاک کردن جستجو" onClick={() => { setQuery(''); setSearchState('autocomplete'); globalThis.document.getElementById('home-search-input')?.focus(); }}>×</button>}
              {searchState === 'autocomplete' && <div className="home-autocomplete" id="home-search-suggestions" role="listbox" aria-label="پیشنهادهای جستجو">
                <p>{query.trim() ? 'پیشنهاد جستجو' : 'جستجوهای پرطرفدار'}</p>
                {autocompleteItems.map((item, index) => <button key={`${item}-${index}`} id={`home-suggestion-${index}`} type="button" role="option" aria-selected={suggestionIndex === index} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(item)}><Icon name="search" size={17} /><span>{item}</span><Icon name="arrow" size={15} /></button>)}
              </div>}
            </div>
            <label className="home-select-field"><span className="home-visually-hidden">تخصص پزشکی</span><select value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option value="">همه تخصص‌ها</option><option>دندان‌پزشکی</option><option>تصویربرداری</option><option>پوست و مو</option><option>آزمایشگاه</option><option>ارتوپدی</option></select><Icon name="chevron" size={17} /></label>
            <label className="home-select-field"><span className="home-visually-hidden">استان و شهر</span><select value={city} onChange={(event) => setCity(event.target.value)}><option value="">استان و شهر</option><option>تهران</option><option>اصفهان</option><option>شیراز</option><option>مشهد</option><option>تبریز</option></select><Icon name="pin" size={18} /></label>
            <button type="submit" className="home-button home-button--orange home-search-submit" disabled={searchState === 'loading'}><Icon name="search" size={19} /> جستجوی مراکز</button>
          </div>
          <div className={`home-search-feedback home-search-feedback--${searchState}`} id="search-results" aria-live="polite" aria-atomic="true">
            {searchState === 'loading' && <><span className="home-spinner" aria-hidden="true" />در حال جستجوی خدمات…</>}
            {searchState === 'empty' && <div className="home-empty-state"><span className="home-empty-icon"><Icon name="search" size={24} /></span><div><strong>موردی با این مشخصات پیدا نشد</strong><span>نام خدمت یا فیلترها را تغییر بده و دوباره جستجو کن.</span></div><button type="button" onClick={() => { setQuery(''); setSearchState('autocomplete'); globalThis.document.getElementById('home-search-input')?.focus(); }}>پاک کردن فیلترها</button></div>}
            {searchState === 'results' && <div className="home-result-state"><strong>نتایج جستجوی نمایشی</strong><span>این پیش‌نمایش به داده واقعی مراکز متصل نیست.</span><a href="#providers">دیدن نمونه کارت‌ها</a></div>}
          </div>
        </form>
      </section>

      <section className="home-benefits" aria-label="مزایای استفاده از حامی‌کارت"><div className="home-benefits-grid">{benefits.map((item) => <article className="home-benefit" key={item.title}><span className="home-benefit-icon"><Icon name={item.icon} size={26} /></span><div><h2>{item.title}</h2><p>{item.copy}</p></div></article>)}</div></section>

      <section className="home-section home-categories" id="categories" aria-labelledby="categories-title">
        <div className="home-section-heading"><div><p className="home-section-kicker">پوشش خدمات درمانی</p><h2 id="categories-title">پوشش گسترده خدمات درمانی</h2><p>دسته‌بندی موردنظرت را انتخاب کن و جستجو را ادامه بده.</p></div><button className="home-text-link" type="button" onClick={() => startSearch('')}>مشاهده همه خدمات <Icon name="arrow" size={17} /></button></div>
        <div className="home-category-grid">{categories.map((item) => <button key={item.title} className="home-category-card" type="button" onClick={() => { setActiveTab('service'); startSearch(item.title); }}><span className="home-category-icon"><Icon name={item.icon} size={27} /></span><span className="home-category-copy"><strong>{item.title}</strong><small>{item.meta}</small></span><Icon className="home-category-arrow" name="chevronLeft" size={17} /></button>)}</div>
      </section>

      <section className="home-section home-providers" id="providers" aria-labelledby="providers-title">
        <div className="home-section-heading"><div><p className="home-section-kicker">برای آشنایی با تجربه جستجو</p><h2 id="providers-title">پزشکان و مراکز</h2><p>کارت‌های زیر نمونه طراحی‌اند؛ اطلاعات واقعی هنوز به این صفحه متصل نیست.</p></div><a className="home-text-link" href="/providers">مشاهده همه مراکز <Icon name="arrow" size={17} /></a></div>
        <div className="home-provider-carousel">
          <button className="home-provider-control home-provider-control--previous" type="button" aria-label="نمایش نمونه‌های قبلی" onClick={() => setProviderPage((page) => (page + demoProviders.length - 1) % demoProviders.length)}><Icon name="chevronLeft" size={20} /></button>
          <div className="home-provider-grid" aria-live="polite">{visibleProviders.map((provider, index) => <ProviderCard key={`${provider.name}-${providerPage}-${index}`} provider={provider} />)}</div>
          <button className="home-provider-control home-provider-control--next" type="button" aria-label="نمایش نمونه‌های بعدی" onClick={() => setProviderPage((page) => (page + 1) % demoProviders.length)}><Icon name="chevronLeft" size={20} /></button>
        </div>
      </section>

      <section className="home-how" id="how-it-works" aria-labelledby="how-title">
        <div className="home-how-heading"><p className="home-section-kicker">مسیر روشن، انتخاب ساده</p><h2 id="how-title">چگونه کار می‌کند؟</h2><p>سه قدم تا پیدا کردن خدمت متناسب با نیازتان.</p></div>
        <ol className="home-steps"><li><span className="home-step-number">۱</span><div><h3>عضویت و انتخاب طرح</h3><p>طرح مناسب خود را انتخاب و عضو حامی‌کارت شوید.</p></div></li><li><span className="home-step-number">۲</span><div><h3>مراجعه به مرکز طرف قرارداد</h3><p>با کارت حامی‌کارت به مرکز درمانی مراجعه کنید.</p></div></li><li><span className="home-step-number">۳</span><div><h3>استفاده از مزایای طرح</h3><p>شرایط هر مزیت را در همان مرکز بررسی کنید.</p></div></li></ol>
      </section>

      <section className="home-final-cta" aria-label="دریافت حامی‌کارت"><div className="home-final-cta-mark"><Icon name="card" size={38} /></div><div><p>انتخاب درمانی، با دیدی روشن‌تر</p><h2>حامی‌کارت را بیشتر بشناسید</h2></div><a className="home-button home-button--orange" href="/register">آشنایی و ثبت‌نام <Icon name="arrow" size={17} /></a></section>
    </main>

    <footer className="home-footer">
      <div className="home-footer-main"><div className="home-footer-brand"><Brand /><p>ابزاری برای یافتن خدمات درمانی و بررسی مزایای حامی‌کارت.</p></div><div className="home-footer-col"><h2>دسترسی سریع</h2><a href="#categories">خدمات درمانی</a><a href="#providers">پزشکان و مراکز</a><a href="#how-it-works">چطور کار می‌کند</a></div><div className="home-footer-col"><h2>حساب کاربری</h2><a href="/login">ورود</a><a href="/register">ثبت‌نام</a><a href="/dashboard">داشبورد</a></div><div className="home-footer-col"><h2>راهنما</h2><a href="/support">پشتیبانی</a><a href="/providers">فهرست مراکز</a><a href="#home">بازگشت به بالا</a></div></div>
      <div className="home-footer-bottom"><span>حامی‌کارت</span><span>نمایش نمونه‌ها در این صفحه صرفاً برای پیش‌نمایش رابط کاربری است.</span></div>
    </footer>
    <div className="home-mobile-quickbar"><a className="home-button home-button--orange" href="/register"><Icon name="card" size={18} />دریافت حامی‌کارت</a></div>
  </div>;
}
