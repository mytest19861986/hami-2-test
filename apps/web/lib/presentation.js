export const statusLabels = {
  ACTIVE: 'فعال', EXPIRED: 'منقضی', INACTIVE: 'غیرفعال', DRAFT: 'پیش‌نویس', PENDING: 'در انتظار',
  PENDING_REVIEW: 'در انتظار بررسی', APPROVED: 'تأییدشده', REJECTED: 'ردشده',
  SUSPENDED: 'معلق', DISABLED: 'غیرفعال', PENDING_APPROVAL: 'در انتظار تأیید',
  PAID: 'پرداخت‌شده', CANCELLED: 'لغوشده', FROZEN: 'منجمد و نیازمند بررسی', PAYOUT_PENDING: 'در حال پرداخت', PAYOUT_UNKNOWN: 'در حال بررسی؛ اقدامی لازم نیست', ATTRIBUTED: 'ثبت‌شده',
  QUALIFIED: 'واجد شرایط', REWARDED: 'پاداش‌داده‌شده', REVERSED: 'برگشت‌خورده',
  PENDING_PAYMENT: 'در انتظار پرداخت', COMPLETED: 'تکمیل‌شده', REFUNDED: 'بازپرداخت‌شده',
};

export function labelStatus(value) { return statusLabels[value] || value || '—'; }

export function formatMoney(value, currency = 'IRR') {
  return `${Number(value || 0).toLocaleString('fa-IR')} ${currency}`;
}
