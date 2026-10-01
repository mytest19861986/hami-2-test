/** Shared FW-01 foundation primitives. They are presentation-only and do not
 * invent API state or financial authority. */
export function Stack({ children, className = '' }) {
  return <div className={`ui-stack ${className}`.trim()}>{children}</div>;
}

export function Card({ title, children, className = '', as: Element = 'section' }) {
  return <Element className={`ui-card ${className}`.trim()}>{title && <h2>{title}</h2>}{children}</Element>;
}

export function LoadingState({ label = 'در حال بارگذاری…' }) {
  return <p className="ui-state ui-state--loading" role="status" aria-live="polite">{label}</p>;
}

export function EmptyState({ title = 'داده‌ای وجود ندارد', children }) {
  return <div className="ui-state ui-state--empty" role="status"><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function ErrorState({ title = 'بارگذاری ناموفق بود', onRetry }) {
  return <div className="ui-state ui-state--error" role="alert"><strong>{title}</strong>{onRetry && <button type="button" onClick={onRetry}>تلاش دوباره</button>}</div>;
}

export function DegradedState({ retryAfterMs, children = 'خدمت موقتاً با ظرفیت محدود در دسترس است.' }) {
  const retryText = Number.isFinite(retryAfterMs) ? ` تلاش بعدی پس از ${Math.ceil(retryAfterMs / 1000)} ثانیه انجام می‌شود.` : '';
  return <p className="ui-state ui-state--degraded" role="status" aria-live="polite">{children}{retryText}</p>;
}

export function VisuallyHidden({ children }) {
  return <span className="ui-visually-hidden">{children}</span>;
}
