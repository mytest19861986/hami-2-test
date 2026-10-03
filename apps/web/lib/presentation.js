export const statusLabels = {
  ACTIVE: 'فعال', EXPIRED: 'منقضی', INACTIVE: 'غیرفعال', DRAFT: 'پیش‌نویس', PENDING: 'در انتظار',
  PENDING_REVIEW: 'در انتظار بررسی', APPROVED: 'تأییدشده', REJECTED: 'ردشده', INITIATED: 'در انتظار تأیید', CONFIRMED: 'تأیید شده',
  SUSPENDED: 'معلق', DISABLED: 'غیرفعال', PENDING_APPROVAL: 'در انتظار تأیید',
  PAID: 'پرداخت‌شده', CANCELLED: 'لغوشده', FROZEN: 'منجمد و نیازمند بررسی', FAILED: 'ناموفق', PAYOUT_PENDING: 'در حال پرداخت', PAYOUT_UNKNOWN: 'در حال بررسی؛ اقدامی لازم نیست', ATTRIBUTED: 'ثبت‌شده',
  QUALIFIED: 'واجد شرایط', REWARDED: 'پاداش‌داده‌شده', REVERSED: 'برگشت‌خورده', EXPIRED: 'منقضی شده',
  PENDING_PAYMENT: 'در انتظار پرداخت', COMPLETED: 'تکمیل‌شده', REFUNDED: 'بازپرداخت‌شده',
};

export function labelStatus(value) { return statusLabels[value] || value || '—'; }

export function formatMoney(value, currency = 'IRR') {
  if (value && typeof value === 'object') {
    currency = value.currency_code || currency;
    value = value.amount_minor;
  }
  const amount = typeof value === 'string' && /^-?\d+$/.test(value)
    ? BigInt(value).toLocaleString('fa-IR')
    : Number(value || 0).toLocaleString('fa-IR');
  return `${amount} ${currency}`;
}
