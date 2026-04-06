import { pool } from './pool.js';

export type CheckoutCartStage = 'platform' | 'type' | 'origin' | 'refill' | 'link' | 'package' | 'confirm';
export type CheckoutCartStatus = 'active' | 'cancelled' | 'converted';

export type CheckoutCartRecord = {
  telegram_id: number;
  service_id: number | null;
  platform: string | null;
  service_type: string | null;
  origin: string | null;
  refill_mode: string | null;
  target_link: string | null;
  quantity: number | null;
  amount: string | null;
  stage: CheckoutCartStage;
  status: CheckoutCartStatus;
  reminder_count: number;
  last_interaction_at: string;
  service_name: string | null;
  service_category: string | null;
  service_description: string | null;
  service_price: string | null;
};

export type CheckoutCartInput = {
  serviceId?: number;
  platform?: string;
  serviceType?: string;
  origin?: string;
  refillMode?: string;
  targetLink?: string;
  quantity?: number;
  amount?: number;
  stage: CheckoutCartStage;
  status?: CheckoutCartStatus;
};

export type OrderTrackingRecord = {
  id: number;
  telegram_id: number;
  status: string;
  external_service_status: string;
  external_supplier_order_id: string;
  last_notified_external_status: string | null;
  target_link: string | null;
  quantity: number | null;
  total_amount: string;
  service_id: number | null;
  service_name: string | null;
  service_category: string | null;
  service_description: string | null;
};

export type UserOrderDetails = {
  id: number;
  telegram_id: number;
  service_id: number;
  target_link: string | null;
  quantity: number | null;
  total_amount: string;
  external_service_status: string;
  service_name: string | null;
  platform: string | null;
  service_category: string | null;
  service_description: string | null;
};

export async function upsertCheckoutCart(telegramId: number, cart: CheckoutCartInput): Promise<void> {
  await pool.query(
    `insert into checkout_carts (
       telegram_id,
       service_id,
       platform,
       service_type,
       origin,
       refill_mode,
       target_link,
       quantity,
       amount,
       stage,
       status,
       updated_at,
       last_interaction_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
     on conflict (telegram_id)
     do update set
       service_id = excluded.service_id,
       platform = excluded.platform,
       service_type = excluded.service_type,
       origin = excluded.origin,
       refill_mode = excluded.refill_mode,
       target_link = excluded.target_link,
       quantity = excluded.quantity,
       amount = excluded.amount,
       stage = excluded.stage,
       status = excluded.status,
       reminder_count = case
         when checkout_carts.status <> excluded.status then 0
         when checkout_carts.service_id is distinct from excluded.service_id then 0
         when excluded.stage = 'platform' then 0
         else checkout_carts.reminder_count
       end,
       last_reminder_at = case
         when checkout_carts.status <> excluded.status then null
         when checkout_carts.service_id is distinct from excluded.service_id then null
         when excluded.stage = 'platform' then null
         else checkout_carts.last_reminder_at
       end,
       updated_at = now(),
       last_interaction_at = now()`,
    [
      telegramId,
      cart.serviceId ?? null,
      cart.platform ?? null,
      cart.serviceType ?? null,
      cart.origin ?? null,
      cart.refillMode ?? null,
      cart.targetLink ?? null,
      cart.quantity ?? null,
      cart.amount ?? null,
      cart.stage,
      cart.status ?? 'active'
    ]
  );
}

export async function getCheckoutCartByTelegramId(telegramId: number): Promise<CheckoutCartRecord | null> {
  const result = await pool.query(
    `select c.telegram_id,
            c.service_id,
            c.platform,
            c.service_type,
            c.origin,
            c.refill_mode,
            c.target_link,
            c.quantity,
            c.amount,
            c.stage,
            c.status,
            c.reminder_count,
            c.last_interaction_at,
            s.name as service_name,
            s.category as service_category,
            s.description as service_description,
            s.final_price as service_price
     from checkout_carts c
     left join services s on s.id = c.service_id
     where c.telegram_id = $1
     limit 1`,
    [telegramId]
  );

  return (result.rows[0] as CheckoutCartRecord | undefined) ?? null;
}

export async function markCheckoutCartStatus(
  telegramId: number,
  status: CheckoutCartStatus,
  convertedOrderId?: number
): Promise<void> {
  await pool.query(
    `update checkout_carts
     set status = $2,
         converted_order_id = coalesce($3, converted_order_id),
         updated_at = now()
     where telegram_id = $1`,
    [telegramId, status, convertedOrderId ?? null]
  );
}

export async function markCheckoutCartRecovered(telegramId: number): Promise<void> {
  await pool.query(
    `update checkout_carts
     set recovered_at = now(),
         reminder_count = 0,
         last_reminder_at = null,
         updated_at = now(),
         last_interaction_at = now()
     where telegram_id = $1`,
    [telegramId]
  );
}

export async function markCheckoutCartReminderSent(telegramId: number): Promise<void> {
  await pool.query(
    `update checkout_carts
     set reminder_count = reminder_count + 1,
         last_reminder_at = now(),
         updated_at = now()
     where telegram_id = $1`,
    [telegramId]
  );
}

export async function listRecoverableCheckoutCarts(): Promise<CheckoutCartRecord[]> {
  const result = await pool.query(
    `select c.telegram_id,
            c.service_id,
            c.platform,
            c.service_type,
            c.origin,
            c.refill_mode,
            c.target_link,
            c.quantity,
            c.amount,
            c.stage,
            c.status,
            c.reminder_count,
            c.last_interaction_at,
            s.name as service_name,
            s.category as service_category,
            s.description as service_description,
            s.final_price as service_price
     from checkout_carts c
     left join services s on s.id = c.service_id
     where c.status = 'active'
       and c.service_id is not null
       and (
         (c.reminder_count = 0 and c.last_interaction_at <= now() - interval '15 minutes')
         or
         (c.reminder_count = 1 and c.last_interaction_at <= now() - interval '2 hours')
       )
     order by c.last_interaction_at asc
     limit 30`
  );

  return result.rows as CheckoutCartRecord[];
}

export async function listOrdersForStatusSync(limit = 30): Promise<OrderTrackingRecord[]> {
  const result = await pool.query(
    `select o.id,
            o.telegram_id,
            o.status,
            o.external_service_status,
            o.external_supplier_order_id,
            o.last_notified_external_status,
            o.target_link,
            o.quantity,
            o.total_amount,
            o.service_id,
            coalesce(o.display_service_name, s.name) as service_name,
            s.category as service_category,
            s.description as service_description
     from orders o
     left join services s on s.id = o.service_id
     where o.status = 'paid'
       and o.external_supplier_order_id is not null
       and o.external_supplier_order_id <> ''
       and coalesce(o.external_service_status, 'pending') not in ('completed', 'complete', 'partial', 'cancelled', 'canceled', 'failed', 'refunded')
       and coalesce(o.last_supplier_check_at, o.created_at) <= now() - interval '90 seconds'
     order by coalesce(o.last_supplier_check_at, o.created_at) asc
     limit $1`,
    [limit]
  );

  return result.rows as OrderTrackingRecord[];
}

export async function touchOrderSupplierCheck(orderId: number, supplierStatus?: string): Promise<void> {
  await pool.query(
    `update orders
     set external_service_status = coalesce($2, external_service_status),
         last_supplier_check_at = now()
     where id = $1`,
    [orderId, supplierStatus ?? null]
  );
}

export async function markOrderStatusNotified(orderId: number, supplierStatus: string): Promise<void> {
  await pool.query(
    `update orders
     set last_notified_external_status = $2
     where id = $1`,
    [orderId, supplierStatus]
  );
}

export async function getUserOrderDetails(telegramId: number, orderId: number): Promise<UserOrderDetails | null> {
  const result = await pool.query(
    `select o.id,
            o.telegram_id,
            o.service_id,
            o.target_link,
            o.quantity,
            o.total_amount,
            o.external_service_status,
            coalesce(o.display_service_name, s.name) as service_name,
            s.catalog_platform as platform,
            s.category as service_category,
            s.description as service_description
     from orders o
     left join services s on s.id = o.service_id
     where o.telegram_id = $1 and o.id = $2
     limit 1`,
    [telegramId, orderId]
  );

  return (result.rows[0] as UserOrderDetails | undefined) ?? null;
}
