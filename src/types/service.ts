export type CatalogPlatform =
  | 'Instagram'
  | 'TikTok'
  | 'YouTube'
  | 'Facebook'
  | 'Telegram'
  | 'WhatsApp'
  | 'X'
  | 'Kwai'
  | 'Kick'
  | 'SnackVideo'
  | 'Google'
  | 'Reddit'
  | 'Outros';

export type SupplierService = {
  externalId: string;
  name: string;
  description: string;
  category: string;
  supplierPrice: number;
  finalPrice: number;
  rawPayload: unknown;
  active: boolean;
  catalogPlatform: CatalogPlatform;
  catalogReason: string | null;
  catalogScore: number;
};

export type ServiceCategory = {
  name: string;
  services: SupplierService[];
};
