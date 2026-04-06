import { pool } from './pool.js';
export async function createOrderActionLog(input) {
    await pool.query(`insert into order_action_logs (
       telegram_id,
       order_id,
       action,
       supplier_order_id,
       success,
       message,
       response_payload
     )
     values ($1, $2, $3, $4, $5, $6, $7)`, [
        input.telegramId,
        input.orderId ?? null,
        input.action,
        input.supplierOrderId ?? null,
        input.success,
        input.message ?? null,
        input.responsePayload ? JSON.stringify(input.responsePayload) : null
    ]);
}
export async function countRecentOrderActionLogs(telegramId, seconds, action, orderId) {
    const conditions = ['telegram_id = $1', `created_at >= now() - ($2::text || ' seconds')::interval`];
    const values = [telegramId, seconds];
    let cursor = values.length + 1;
    if (action) {
        conditions.push(`action = $${cursor}`);
        values.push(action);
        cursor += 1;
    }
    if (typeof orderId === 'number') {
        conditions.push(`order_id = $${cursor}`);
        values.push(orderId);
    }
    const result = await pool.query(`select count(*)::int as total
     from order_action_logs
     where ${conditions.join(' and ')}`, values);
    return result.rows[0]?.total ?? 0;
}
