import type { CatalogPlatform } from '../types/service.js';
import { getStoreServiceEntry, isStoreServiceAllowed } from '../config/storeCatalog.js';

type CatalogDecision = {
  active: boolean;
  platform: CatalogPlatform;
  reason: string | null;
  score: number;
};

type CatalogEntry = {
  externalId: string;
  category: string;
  name: string;
  description?: string | null;
  supplierPrice: number;
  finalPrice: number;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function detectCatalogPlatform(category: string, name: string, description?: string | null): CatalogPlatform {
  const normalizedCategory = normalizeText(category).trim();
  const normalizedName = normalizeText(name).trim();
  const text = `${normalizedCategory} ${normalizedName}`;

  if (normalizedCategory.startsWith('ig') || containsAny(text, ['instagram'])) return 'Instagram';
  if (normalizedCategory.startsWith('tk') || containsAny(text, ['tiktok'])) return 'TikTok';
  if (normalizedCategory.startsWith('yt') || containsAny(text, ['youtube'])) return 'YouTube';
  if (normalizedCategory.startsWith('fb') || containsAny(text, ['facebook'])) return 'Facebook';
  if (containsAny(text, ['telegram'])) return 'Telegram';
  if (containsAny(text, ['whatsapp'])) return 'WhatsApp';
  if (containsAny(text, ['twitter', 'x/twitter'])) return 'X';
  if (containsAny(text, ['kwai'])) return 'Kwai';
  if (containsAny(text, ['kick'])) return 'Kick';
  if (containsAny(text, ['snackvideo'])) return 'SnackVideo';
  if (containsAny(text, ['google maps', 'google'])) return 'Google';
  if (containsAny(text, ['reddit'])) return 'Reddit';

  return 'Outros';
}

export function curateCatalogEntry(entry: CatalogEntry): CatalogDecision {
  const text = normalizeText(`${entry.category} ${entry.name} ${entry.description ?? ''}`);
  const category = normalizeText(entry.category);
  const storeEntry = getStoreServiceEntry(entry.externalId);
  const platform = storeEntry?.platform ?? detectCatalogPlatform(entry.category, entry.name, entry.description);
  let score = 70;

  if (!isStoreServiceAllowed(entry.externalId)) {
    return {
      active: false,
      platform,
      reason: 'not_in_store_catalog',
      score: 0
    };
  }

  if (entry.supplierPrice <= 0 || entry.finalPrice <= 0) {
    return {
      active: false,
      platform,
      reason: 'invalid_price',
      score: 0
    };
  }

  if (category === 'primeiro clique aqui' || text.includes('leia a descricao deste servico')) {
    return {
      active: false,
      platform,
      reason: 'instructional_entry',
      score: 0
    };
  }

  if (containsAny(category, ['promocao - smmhub', 'promocao'])) {
    return {
      active: false,
      platform,
      reason: 'internal_promotion',
      score: 5
    };
  }

  if (containsAny(text, ['denuncia', 'denuncias', 'report', 'banimento', 'strike'])) {
    return {
      active: false,
      platform,
      reason: 'risky_or_non_store_service',
      score: 0
    };
  }

  if (containsAny(text, ['scripts', 'telas', 'paineis', 'painel', 'lovable', 'coinmarketcap'])) {
    return {
      active: false,
      platform,
      reason: 'non_core_inventory',
      score: 10
    };
  }

  if (platform === 'Outros') {
    return {
      active: false,
      platform,
      reason: 'unsupported_platform',
      score: 15
    };
  }

  if (containsAny(text, ['premium', 'organico', 'reais', 'estavel'])) score += 10;
  if (containsAny(text, ['reposicao', ' refill ', 'r30', 'r60', 'r90', 'r365'])) score += 8;
  if (containsAny(text, ['instaneo', 'instantaneo', 'rapido', 'hq'])) score += 4;
  if (containsAny(text, ['[ pacote ]', '1 mes', '30 dias'])) score -= 3;

  return {
    active: true,
    platform,
    reason: null,
    score: Math.max(1, Math.min(100, score))
  };
}
