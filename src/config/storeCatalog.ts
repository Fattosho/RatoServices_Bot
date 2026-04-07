import type { CatalogPlatform } from '../types/service.js';

type StoreServiceCatalogEntry = {
  externalId: string;
  platform: CatalogPlatform;
  type: string;
};

const STORE_SERVICE_CATALOG: StoreServiceCatalogEntry[] = [
  { externalId: '10', platform: 'Instagram', type: 'Seguidores' },
  { externalId: '204', platform: 'Instagram', type: 'Seguidores' },
  { externalId: '195', platform: 'Instagram', type: 'Seguidores' },
  { externalId: '193', platform: 'Instagram', type: 'Seguidores' },
  { externalId: '16', platform: 'Instagram', type: 'Seguidores' },
  { externalId: '59', platform: 'Instagram', type: 'Visualizacoes' },
  { externalId: '189', platform: 'Instagram', type: 'Visualizacoes' },
  { externalId: '13', platform: 'Instagram', type: 'Curtidas' },
  { externalId: '107', platform: 'Instagram', type: 'Curtidas' },
  { externalId: '14', platform: 'Instagram', type: 'Curtidas' },
  { externalId: '15', platform: 'Instagram', type: 'Curtidas' },
  { externalId: '129', platform: 'Instagram', type: 'Curtidas' },
  { externalId: '160', platform: 'Instagram', type: 'Curtidas' },
  { externalId: '161', platform: 'Instagram', type: 'Curtidas' },
  { externalId: '162', platform: 'Facebook', type: 'Seguidores' },
  { externalId: '163', platform: 'Facebook', type: 'Seguidores' },
  { externalId: '164', platform: 'Facebook', type: 'Curtidas + Seguidores' },
  { externalId: '165', platform: 'Facebook', type: 'Curtidas + Seguidores' },
  { externalId: '126', platform: 'TikTok', type: 'Seguidores' },
  { externalId: '127', platform: 'TikTok', type: 'Seguidores' },
  { externalId: '157', platform: 'TikTok', type: 'Seguidores' },
  { externalId: '158', platform: 'TikTok', type: 'Seguidores' },
  { externalId: '159', platform: 'TikTok', type: 'Seguidores' },
  { externalId: '186', platform: 'TikTok', type: 'Seguidores' },
  { externalId: '187', platform: 'TikTok', type: 'Seguidores' },
  { externalId: '61', platform: 'TikTok', type: 'Curtidas' },
  { externalId: '62', platform: 'TikTok', type: 'Curtidas' },
  { externalId: '63', platform: 'TikTok', type: 'Curtidas' },
  { externalId: '64', platform: 'TikTok', type: 'Curtidas' },
  { externalId: '45', platform: 'TikTok', type: 'Visualizacoes' },
  { externalId: '46', platform: 'TikTok', type: 'Visualizacoes' },
  { externalId: '125', platform: 'YouTube', type: 'Seguidores' },
  { externalId: '146', platform: 'YouTube', type: 'Curtidas' },
  { externalId: '147', platform: 'YouTube', type: 'Curtidas' },
  { externalId: '148', platform: 'YouTube', type: 'Curtidas' },
  { externalId: '174', platform: 'Telegram', type: 'Visualizacoes' },
  { externalId: '175', platform: 'Telegram', type: 'Membros' },
  { externalId: '176', platform: 'WhatsApp', type: 'Seguidores' },
  { externalId: '177', platform: 'WhatsApp', type: 'Reacoes' },
  { externalId: '178', platform: 'WhatsApp', type: 'Reacoes' },
  { externalId: '179', platform: 'WhatsApp', type: 'Reacoes' },
  { externalId: '180', platform: 'WhatsApp', type: 'Reacoes' },
  { externalId: '181', platform: 'WhatsApp', type: 'Reacoes' },
  { externalId: '182', platform: 'WhatsApp', type: 'Reacoes' },
  { externalId: '183', platform: 'WhatsApp', type: 'Reacoes' }
];

const STORE_SERVICE_MAP = new Map(
  STORE_SERVICE_CATALOG.map((entry) => [entry.externalId, entry] as const)
);

export function getStoreServiceEntry(externalId: string): StoreServiceCatalogEntry | undefined {
  return STORE_SERVICE_MAP.get(externalId);
}

export function isStoreServiceAllowed(externalId: string): boolean {
  return STORE_SERVICE_MAP.has(externalId);
}

export function getStorePlatforms(): CatalogPlatform[] {
  return [...new Set(STORE_SERVICE_CATALOG.map((entry) => entry.platform))];
}

export function getStoreTypesByPlatform(platform: CatalogPlatform): string[] {
  const types = [...new Set(
    STORE_SERVICE_CATALOG
      .filter((entry) => entry.platform === platform)
      .map((entry) => entry.type)
  )];

  const order = [
    'Seguidores',
    'Membros',
    'Curtidas',
    'Curtidas + Seguidores',
    'Reacoes',
    'Visualizacoes',
    'Comentarios',
    'Metricas',
    'Outros'
  ];

  return types.sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}
