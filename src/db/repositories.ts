import { pool } from './pool.js';
import { SupplierService } from '../types/service.js';
import { generateReferralCode } from '../utils/referral.js';
import { makeCategoryToken } from '../utils/categoryToken.js';
import { getCatalogPlatformsForMenu, matchesGuidedFilters, type RefillMode } from '../utils/guidedCatalog.js';

type WalletSummary = {
  balance: string;
  total_added: string;
  total_spent: string;
};

type RawPayload = {
  min?: string | number;
  max?: string | number;
  refill?: boolean;
  description?: string;
  type?: string;
};

export type GuidedInstagramService = {
  id: number;
  catalog_platform?: string;
  category: string;
  name: string;
  description: string | null;
  final_price: string;
  external_service_id: string;
  raw_payload: RawPayload;
};

export type ManagedOrderRecord = {
  id: number;
  telegram_id: number;
  service_id: number | null;
  display_service_name: string | null;
  status: string;
  external_service_status: string;
  external_supplier_order_id: string | null;
  total_amount: string;
  target_link: string | null;
  quantity: number | null;
  service_name: string | null;
  service_category: string | null;
  service_description: string | null;
  service_raw_payload: RawPayload | null;
};

function getPlatformCategorySql(platform: string): string {
  const platforms = getCatalogPlatformsForMenu(platform);
  const values = platforms.map((item) => `'${item.replace(/'/g, "''")}'`).join(', ');
  return `catalog_platform in (${values})`;
}

export async function upsertUser(telegramId: number, username: string | undefined, fullName: string): Promise<void> {
  await pool.query(
    `insert into users (telegram_id, username, full_name)
     values ($1, $2, $3)
     on conflict (telegram_id)
     do update set username = excluded.username, full_name = excluded.full_name, updated_at = now()`,
    [telegramId, username ?? null, fullName]
  );

  await pool.query(
    `insert into affiliate_wallets (telegram_id)
     values ($1)
     on conflict (telegram_id) do nothing`,
    [telegramId]
  );

  await pool.query(
    `insert into user_wallets (telegram_id)
     values ($1)
     on conflict (telegram_id) do nothing`,
    [telegramId]
  );
}

export async function captureLead(
  telegramId: number,
  username: string | undefined,
  fullName: string,
  referredByCode?: string
): Promise<{
  isNewLead: boolean;
  shouldNotifyAffiliate: boolean;
}> {
  const normalizedReferralCode = referredByCode?.trim() ? referredByCode.trim() : null;
  const existingLead = await pool.query<{ referred_by_code: string | null }>(
    `select referred_by_code
     from leads
     where telegram_id = $1
     order by id asc
     limit 1`,
    [telegramId]
  );

  const currentLead = existingLead.rows[0];

  if (currentLead) {
    const shouldAttachReferral = !currentLead.referred_by_code && Boolean(normalizedReferralCode);

    await pool.query(
      `update leads
       set username = $2,
           full_name = $3,
           referred_by_code = coalesce(referred_by_code, $4),
           last_contact_at = now()
       where telegram_id = $1`,
      [telegramId, username ?? null, fullName, normalizedReferralCode]
    );

    return {
      isNewLead: false,
      shouldNotifyAffiliate: shouldAttachReferral
    };
  }

  await pool.query(
    `insert into leads (telegram_id, username, full_name, referred_by_code)
     values ($1, $2, $3, $4)`,
    [telegramId, username ?? null, fullName, normalizedReferralCode]
  );

  return {
    isNewLead: true,
    shouldNotifyAffiliate: Boolean(normalizedReferralCode)
  };
}

export async function upsertServices(services: SupplierService[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const service of services) {
      await client.query(
        `insert into services (
           external_service_id,
           category,
           name,
           description,
           supplier_price,
           final_price,
           raw_payload,
           active,
           catalog_platform,
           catalog_reason,
           catalog_score,
           updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         on conflict (external_service_id)
         do update set category = excluded.category,
                       name = excluded.name,
                       description = excluded.description,
                       supplier_price = excluded.supplier_price,
                       final_price = excluded.final_price,
                       raw_payload = excluded.raw_payload,
                       active = excluded.active,
                       catalog_platform = excluded.catalog_platform,
                       catalog_reason = excluded.catalog_reason,
                       catalog_score = excluded.catalog_score,
                       updated_at = now()`,
        [
          service.externalId,
          service.category,
          service.name,
          service.description,
          service.supplierPrice,
          service.finalPrice,
          JSON.stringify(service.rawPayload),
          service.active,
          service.catalogPlatform,
          service.catalogReason,
          service.catalogScore
        ]
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export function getCategoryToken(name: string): string {
  return makeCategoryToken(name);
}

export async function getCategoryByToken(token: string): Promise<string | null> {
  const result = await pool.query(
    `select distinct category
     from services
     where active = true
     order by category asc`
  );

  const match = result.rows.find((row) => makeCategoryToken(row.category as string) === token);
  return (match?.category as string | undefined) ?? null;
}

export async function getCategoriesByPlatform(platform: string): Promise<string[]> {
  const sql = `
    select distinct category
    from services
    where active = true
      and ${getPlatformCategorySql(platform)}
    order by category asc
  `;

  const result = await pool.query(sql);
  return result.rows.map((row) => row.category as string);
}

export async function getServicesByCategory(category: string): Promise<Array<{ id: number; name: string; final_price: string }>> {
  const result = await pool.query(
    `select id, name, final_price
     from services
     where active = true and category = $1
     order by name asc`,
    [category]
  );

  return result.rows as Array<{ id: number; name: string; final_price: string }>;
}

export async function getServiceById(id: number): Promise<any | null> {
  const result = await pool.query(`select * from services where id = $1 limit 1`, [id]);
  return result.rows[0] ?? null;
}

export async function getInstagramGuidedServices(type: string, origin: string, refillMode: RefillMode): Promise<GuidedInstagramService[]> {
  return getGuidedServices('Instagram', type, origin, refillMode);
}

export async function getGuidedServices(
  platform: string,
  type: string,
  variant: string | undefined,
  refillMode: RefillMode
): Promise<GuidedInstagramService[]> {
  const result = await pool.query(
    `select id, catalog_platform, category, name, description, final_price, external_service_id, raw_payload
     from services
     where active = true
       and ${getPlatformCategorySql(platform)}
     order by catalog_score desc, final_price asc, name asc`
  );

  const services = result.rows as GuidedInstagramService[];
  return services.filter((service) => matchesGuidedFilters(service, platform, type, variant, refillMode));
}

export async function getUserAffiliateInfo(telegramId: number): Promise<{ is_affiliate: boolean; affiliate_code: string | null } | null> {
  const result = await pool.query(
    `select is_affiliate, affiliate_code
     from users
     where telegram_id = $1
     limit 1`,
    [telegramId]
  );

  return result.rows[0] ?? null;
}

export async function countPaidOrders(telegramId: number): Promise<number> {
  const result = await pool.query(
    `select count(*)::int as total from orders where telegram_id = $1 and status = 'paid'`,
    [telegramId]
  );

  return result.rows[0]?.total ?? 0;
}

export async function ensureAffiliateEnabled(telegramId: number): Promise<string> {
  const existing = await getUserAffiliateInfo(telegramId);
  if (existing?.is_affiliate && existing.affiliate_code) {
    return existing.affiliate_code;
  }

  const code = generateReferralCode(telegramId);
  await pool.query(
    `update users
     set is_affiliate = true,
         affiliate_code = $2,
         updated_at = now()
     where telegram_id = $1`,
    [telegramId, code]
  );

  return code;
}

export async function getAffiliateWallet(telegramId: number): Promise<{ pending_credits: string; available_credits: string; used_credits: string } | null> {
  const result = await pool.query(
    `select pending_credits, available_credits, used_credits
     from affiliate_wallets
     where telegram_id = $1
     limit 1`,
    [telegramId]
  );

  return result.rows[0] ?? null;
}

export async function getAffiliateOwnerByCode(code: string): Promise<{
  telegram_id: number;
  username: string | null;
  full_name: string | null;
} | null> {
  const result = await pool.query(
    `select telegram_id, username, full_name
     from users
     where affiliate_code = $1
     limit 1`,
    [code]
  );

  return result.rows[0] ?? null;
}

export async function getUserWallet(telegramId: number): Promise<WalletSummary | null> {
  const result = await pool.query(
    `select balance, total_added, total_spent
     from user_wallets
     where telegram_id = $1
     limit 1`,
    [telegramId]
  );

  return result.rows[0] ?? null;
}

export async function createWalletTopup(telegramId: number, amount: number, externalPaymentId: string, referredByCode?: string): Promise<number> {
  const result = await pool.query(
    `insert into wallet_topups (telegram_id, amount, external_payment_id, referred_by_code)
     values ($1, $2, $3, $4)
     returning id`,
    [telegramId, amount, externalPaymentId, referredByCode ?? null]
  );

  return result.rows[0].id;
}

export async function markWalletTopupPaid(topupId: number): Promise<boolean> {
  const result = await pool.query(
    `update wallet_topups
     set status = 'paid',
         paid_at = now()
     where id = $1 and status <> 'paid'
     returning id`,
    [topupId]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function updateWalletTopupStatus(topupId: number, status: string): Promise<void> {
  await pool.query(
    `update wallet_topups
     set status = $2,
         paid_at = case when $2 = 'paid' then now() else paid_at end
     where id = $1`,
    [topupId, status]
  );
}

export async function getWalletTopupById(topupId: number): Promise<any | null> {
  const result = await pool.query(`select * from wallet_topups where id = $1 limit 1`, [topupId]);
  return result.rows[0] ?? null;
}

export async function creditUserWallet(telegramId: number, amount: number, referenceType: string, referenceId: string, description: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update user_wallets
       set balance = balance + $2,
           total_added = total_added + $2,
           updated_at = now()
       where telegram_id = $1`,
      [telegramId, amount]
    );

    await client.query(
      `insert into wallet_transactions (telegram_id, type, amount, description, reference_type, reference_id)
       values ($1, 'credit', $2, $3, $4, $5)`,
      [telegramId, amount, description, referenceType, referenceId]
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function debitUserWallet(telegramId: number, amount: number, referenceType: string, referenceId: string, description: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const walletResult = await client.query(
      `select balance
       from user_wallets
       where telegram_id = $1
       limit 1
       for update`,
      [telegramId]
    );

    const balance = Number(walletResult.rows[0]?.balance ?? 0);
    if (balance < amount) {
      await client.query('rollback');
      return false;
    }

    await client.query(
      `update user_wallets
       set balance = balance - $2,
           total_spent = total_spent + $2,
           updated_at = now()
       where telegram_id = $1`,
      [telegramId, amount]
    );

    await client.query(
      `insert into wallet_transactions (telegram_id, type, amount, description, reference_type, reference_id)
       values ($1, 'debit', $2, $3, $4, $5)`,
      [telegramId, amount, description, referenceType, referenceId]
    );

    await client.query('commit');
    return true;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function createOrder(
  telegramId: number,
  serviceId: number,
  amount: number,
  targetLink: string,
  quantity: number,
  options?: {
    displayServiceName?: string;
    externalPaymentId?: string | null;
    referredByCode?: string;
    creditsUsed?: number;
    pixAmount?: number;
  }
): Promise<number> {
  const result = await pool.query(
    `insert into orders (
       telegram_id,
       service_id,
       display_service_name,
       total_amount,
       pix_amount,
       external_payment_id,
       target_link,
       quantity,
       referred_by_code,
       credits_used
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id`,
    [
      telegramId,
      serviceId,
      options?.displayServiceName ?? null,
      amount,
      options?.pixAmount ?? 0,
      options?.externalPaymentId ?? null,
      targetLink,
      quantity,
      options?.referredByCode ?? null,
      options?.creditsUsed ?? 0
    ]
  );

  return result.rows[0].id;
}

export async function updateOrderStatus(orderId: number, status: string): Promise<void> {
  await pool.query(
    `update orders
     set status = $2,
         paid_at = case when $2 = 'paid' then now() else paid_at end
     where id = $1`,
    [orderId, status]
  );
}

export async function markOrderPaid(orderId: number): Promise<boolean> {
  const result = await pool.query(
    `update orders
     set status = 'paid',
         paid_at = now()
     where id = $1 and status <> 'paid'
     returning id`,
    [orderId]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function updateOrderSupplierResult(orderId: number, supplierStatus: string, supplierOrderId?: string | null): Promise<void> {
  await pool.query(
    `update orders
     set external_service_status = $2,
         external_supplier_order_id = coalesce($3, external_supplier_order_id)
     where id = $1`,
    [orderId, supplierStatus, supplierOrderId ?? null]
  );
}

export async function getOrderById(orderId: number): Promise<any | null> {
  const result = await pool.query(`select * from orders where id = $1`, [orderId]);
  return result.rows[0] ?? null;
}

export async function listRecentOrders(telegramId: number): Promise<Array<{
  id: number;
  status: string;
  external_service_status: string;
  external_supplier_order_id: string | null;
  total_amount: string;
  created_at: string;
  quantity: number | null;
  target_link: string | null;
  service_name: string | null;
  platform: string | null;
}>> {
  const result = await pool.query(
    `select o.id,
            o.status,
            o.external_service_status,
            o.external_supplier_order_id,
            o.total_amount,
            o.created_at,
            o.quantity,
            o.target_link,
            coalesce(o.display_service_name, s.name) as service_name,
            s.catalog_platform as platform
     from orders o
     left join services s on s.id = o.service_id
     where o.telegram_id = $1
     order by o.created_at desc
     limit 10`,
    [telegramId]
  );

  return result.rows as Array<{
    id: number;
    status: string;
    external_service_status: string;
    external_supplier_order_id: string | null;
    total_amount: string;
    created_at: string;
    quantity: number | null;
    target_link: string | null;
    service_name: string | null;
    platform: string | null;
  }>;
}

export async function getManagedOrderForUser(telegramId: number, orderId: number): Promise<ManagedOrderRecord | null> {
  const result = await pool.query(
    `select o.id,
            o.telegram_id,
            o.service_id,
            o.status,
            o.external_service_status,
            o.external_supplier_order_id,
            o.total_amount,
            o.target_link,
            o.quantity,
            coalesce(o.display_service_name, s.name) as service_name,
            o.display_service_name,
            s.category as service_category,
            s.description as service_description,
            s.raw_payload as service_raw_payload
     from orders o
     left join services s on s.id = o.service_id
     where o.telegram_id = $1 and o.id = $2
     limit 1`,
    [telegramId, orderId]
  );

  return (result.rows[0] as ManagedOrderRecord | undefined) ?? null;
}

export async function getUserReferrerCode(telegramId: number): Promise<string | null> {
  const result = await pool.query(
    `select referred_by_code
     from leads
     where telegram_id = $1
     order by first_contact_at asc
     limit 1`,
    [telegramId]
  );

  return result.rows[0]?.referred_by_code ?? null;
}

export async function addAffiliateCredits(
  affiliateCode: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  description: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const userResult = await client.query(
      `select telegram_id from users where affiliate_code = $1 limit 1`,
      [affiliateCode]
    );

    if (userResult.rows.length === 0) {
      await client.query('rollback');
      return;
    }

    const telegramId = userResult.rows[0].telegram_id;
    const transactionResult = await client.query(
      `insert into affiliate_credit_transactions (telegram_id, type, amount, description, reference_type, reference_id)
       values ($1, 'credit', $2, $3, $4, $5)
       on conflict do nothing
       returning id`,
      [telegramId, amount, description, referenceType, referenceId]
    );

    if ((transactionResult.rowCount ?? 0) > 0) {
      await client.query(
        `update affiliate_wallets
         set available_credits = available_credits + $2,
             updated_at = now()
         where telegram_id = $1`,
        [telegramId, amount]
      );
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
