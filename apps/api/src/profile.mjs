import { createHmac } from 'node:crypto';
import { cookieAuth, normalizeMobile, prisma } from './auth.mjs';

export function normalizeNationalId(value) {
  const nationalId = String(value ?? '').trim().replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(nationalId) || /^([0-9])\1{9}$/.test(nationalId)) throw new Error('INVALID_NATIONAL_ID');
  const check = Number(nationalId[9]);
  const sum = nationalId.slice(0, 9).split('').reduce((total, digit, index) => total + Number(digit) * (10 - index), 0) % 11;
  if ((sum < 2 ? sum : 11 - sum) !== check) throw new Error('INVALID_NATIONAL_ID');
  return nationalId;
}

export function doctorNationalIdIdentity(value, { secret = process.env.DOCTOR_NATIONAL_ID_HMAC_KEY, keyVersion = 1 } = {}) {
  const nationalId = normalizeNationalId(value);
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32 || !Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error('DOCTOR_NATIONAL_ID_KEY_UNAVAILABLE');
  }
  const nationalIdHmac = createHmac('sha256', secret)
    .update(`hami:doctor-national-id:v${keyVersion}\0${nationalId}`, 'utf8')
    .digest('hex');
  return { nationalIdHmac, nationalIdKeyVersion: keyVersion };
}

export function requireUser(req) {
  if (!req?.headers) throw new Error('UNAUTHORIZED');
  let auth;
  try { auth = cookieAuth(req).auth; } catch { throw new Error('UNAUTHORIZED'); }
  if (!auth) throw new Error('UNAUTHORIZED');
  return prisma.user.findUnique({ where: { id: auth.sub }, select: { id: true, status: true } }).then((user) => {
    if (!user || user.status !== 'ACTIVE') throw new Error('UNAUTHORIZED');
    return user;
  });
}

export function validateProfileInput(body) {
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  if (firstName.length < 1 || firstName.length > 100 || lastName.length < 1 || lastName.length > 100) throw new Error('INVALID_PROFILE');
  const data = { firstName, lastName };
  if (body.nationalId !== undefined && body.nationalId !== null && body.nationalId !== '') data.nationalId = normalizeNationalId(body.nationalId);
  if (body.birthDate !== undefined && body.birthDate !== null && body.birthDate !== '') {
    const date = new Date(body.birthDate);
    if (Number.isNaN(date.valueOf())) throw new Error('INVALID_PROFILE');
    data.birthDate = date;
  }
  return data;
}

export function validateAddressInput(body) {
  const required = ['title', 'recipientName', 'provinceId', 'cityId', 'postalCode', 'line1'];
  if (required.some((key) => typeof body[key] !== 'string' || body[key].trim().length === 0)) throw new Error('INVALID_ADDRESS');
  if (!/^\d{10}$/.test(String(body.postalCode).trim())) throw new Error('INVALID_ADDRESS');
  const data = Object.fromEntries(required.map((key) => [key, body[key].trim()]));
  data.recipientName = data.recipientName.slice(0, 150);
  data.phone = normalizeMobile(body.phone);
  if (body.line2 !== undefined && body.line2 !== null) data.line2 = String(body.line2).trim();
  data.isDefault = Boolean(body.isDefault);
  return data;
}
