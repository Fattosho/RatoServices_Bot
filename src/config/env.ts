import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === null || value.trim() === '') {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }

  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value === null || value.trim() === '') {
    return fallback;
  }

  return value;
}

function numberFromEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`Variavel numerica invalida: ${name}`);
  }

  return value;
}

function booleanFromEnv(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null || rawValue.trim() === '') {
    return fallback;
  }

  return rawValue.toLowerCase() === 'true';
}

export const env = {
  botToken: required('BOT_TOKEN'),
  botUsername: optional('BOT_USERNAME', 'RatoServices_bot'),
  publicBotUrl: optional('PUBLIC_BOT_URL', 'https://t.me/RatoServices_bot'),
  supportContact: optional('SUPPORT_CONTACT', ''),
  supportChatId: optional('SUPPORT_CHAT_ID', ''),
  databaseUrl: required('DATABASE_URL'),
  databaseSsl: booleanFromEnv('DATABASE_SSL', false),
  databaseSslRejectUnauthorized: booleanFromEnv('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
  supplierApiBaseUrl: required('SUPPLIER_API_BASE_URL'),
  supplierApiServicesPath: optional('SUPPLIER_API_SERVICES_PATH', '/api/v2'),
  supplierApiToken: required('SUPPLIER_API_TOKEN'),
  supplierApiTokenHeader: optional('SUPPLIER_API_TOKEN_HEADER', 'Authorization'),
  supplierApiTokenPrefix: optional('SUPPLIER_API_TOKEN_PREFIX', 'Bearer'),
  priceMarkupMultiplier: numberFromEnv('PRICE_MARKUP_MULTIPLIER', 2.5),
  affiliateCommissionPercent: numberFromEnv('AFFILIATE_COMMISSION_PERCENT', 10),
  syncOnStart: (process.env.SYNC_ON_START ?? 'true').toLowerCase() === 'true',
  mercadopagoToken: required('MERCADOPAGO_ACCESS_TOKEN')
};
