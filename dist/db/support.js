import { pool } from './pool.js';
function buildPreview(messageText) {
    const compact = messageText.replace(/\s+/g, ' ').trim();
    if (compact.length <= 160) {
        return compact;
    }
    return `${compact.slice(0, 157)}...`;
}
export async function createSupportTicket(input) {
    const client = await pool.connect();
    try {
        await client.query('begin');
        const ticketResult = await client.query(`insert into support_tickets (
         telegram_id,
         category,
         order_id,
         status,
         last_message_preview,
         last_customer_message_at,
         updated_at
       )
       values ($1, $2, $3, 'waiting_support', $4, now(), now())
       returning *`, [
            input.telegramId,
            input.category,
            input.orderId ?? null,
            buildPreview(input.messageText)
        ]);
        const ticket = ticketResult.rows[0];
        await client.query(`insert into support_messages (ticket_id, sender_role, telegram_id, message_text)
       values ($1, 'customer', $2, $3)`, [ticket.id, input.telegramId, input.messageText.trim()]);
        await client.query('commit');
        return ticket;
    }
    catch (error) {
        await client.query('rollback');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function addSupportMessage(input) {
    const client = await pool.connect();
    try {
        await client.query('begin');
        await client.query(`insert into support_messages (ticket_id, sender_role, telegram_id, message_text)
       values ($1, $2, $3, $4)`, [input.ticketId, input.senderRole, input.telegramId, input.messageText.trim()]);
        await client.query(`update support_tickets
       set status = $2,
           assigned_to = coalesce($3, assigned_to),
           assigned_to_name = coalesce($4, assigned_to_name),
           last_message_preview = $5,
           last_customer_message_at = case when $6 = 'customer' then now() else last_customer_message_at end,
           last_support_message_at = case when $6 = 'support' then now() else last_support_message_at end,
           updated_at = now(),
           closed_at = case when status = 'closed' then null else closed_at end
       where id = $1`, [
            input.ticketId,
            input.senderRole === 'support' ? 'waiting_customer' : 'waiting_support',
            input.assignedTo ?? null,
            input.assignedToName ?? null,
            buildPreview(input.messageText),
            input.senderRole
        ]);
        await client.query('commit');
    }
    catch (error) {
        await client.query('rollback');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function closeSupportTicket(ticketId, assignedTo, assignedToName) {
    await pool.query(`update support_tickets
     set status = 'closed',
         assigned_to = coalesce($2, assigned_to),
         assigned_to_name = coalesce($3, assigned_to_name),
         updated_at = now(),
         closed_at = now()
     where id = $1`, [ticketId, assignedTo ?? null, assignedToName ?? null]);
}
export async function reopenSupportTicket(ticketId) {
    await pool.query(`update support_tickets
     set status = 'waiting_support',
         updated_at = now(),
         closed_at = null
     where id = $1`, [ticketId]);
}
export async function listUserSupportTickets(telegramId) {
    const result = await pool.query(`select t.*,
            s.name as service_name,
            o.target_link,
            o.total_amount
     from support_tickets t
     left join orders o on o.id = t.order_id
     left join services s on s.id = o.service_id
     where t.telegram_id = $1
     order by
       case when t.status = 'closed' then 1 else 0 end asc,
       t.updated_at desc
     limit 10`, [telegramId]);
    return result.rows;
}
export async function listSupportTicketsForTeam(limit = 10) {
    const result = await pool.query(`select t.*,
            s.name as service_name,
            o.target_link,
            o.total_amount
     from support_tickets t
     left join orders o on o.id = t.order_id
     left join services s on s.id = o.service_id
     order by
       case when t.status = 'closed' then 1 else 0 end asc,
       t.updated_at desc
     limit $1`, [limit]);
    return result.rows;
}
export async function getSupportTicketForUser(telegramId, ticketId) {
    const result = await pool.query(`select t.*,
            s.name as service_name,
            o.target_link,
            o.total_amount
     from support_tickets t
     left join orders o on o.id = t.order_id
     left join services s on s.id = o.service_id
     where t.id = $1 and t.telegram_id = $2
     limit 1`, [ticketId, telegramId]);
    return result.rows[0] ?? null;
}
export async function getSupportTicketById(ticketId) {
    const result = await pool.query(`select t.*,
            s.name as service_name,
            o.target_link,
            o.total_amount
     from support_tickets t
     left join orders o on o.id = t.order_id
     left join services s on s.id = o.service_id
     where t.id = $1
     limit 1`, [ticketId]);
    return result.rows[0] ?? null;
}
export async function listSupportMessages(ticketId, limit = 10) {
    const result = await pool.query(`select *
     from support_messages
     where ticket_id = $1
     order by created_at desc
     limit $2`, [ticketId, limit]);
    return result.rows.reverse();
}
