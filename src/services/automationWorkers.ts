import type { Telegraf } from 'telegraf';
import { cartRecoveryInline, recentOrdersInline } from '../bot/keyboards.js';
import { getCartRecoveryMessage, getOrderStatusUpdateMessage } from '../bot/messages.js';
import {
  listOrdersForStatusSync,
  listRecoverableCheckoutCarts,
  markCheckoutCartReminderSent,
  markOrderStatusNotified,
  touchOrderSupplierCheck
} from '../db/commerce.js';
import { fetchSupplierOrderStatus } from '../integrations/supplierApi.js';

async function runCartRecovery(bot: Telegraf<any>): Promise<void> {
  const carts = await listRecoverableCheckoutCarts();
  for (const cart of carts) {
    await bot.telegram.sendMessage(
      cart.telegram_id,
      getCartRecoveryMessage(cart),
      cartRecoveryInline()
    );
    await markCheckoutCartReminderSent(cart.telegram_id);
  }
}

async function runOrderTracking(bot: Telegraf<any>): Promise<void> {
  const orders = await listOrdersForStatusSync();
  for (const order of orders) {
    const supplierStatus = await fetchSupplierOrderStatus(order.external_supplier_order_id);
    if (!supplierStatus) {
      await touchOrderSupplierCheck(order.id);
      continue;
    }

    await touchOrderSupplierCheck(order.id, supplierStatus.normalizedStatus);
    if (supplierStatus.normalizedStatus === order.last_notified_external_status) {
      continue;
    }

    await bot.telegram.sendMessage(
      order.telegram_id,
      getOrderStatusUpdateMessage(order, supplierStatus),
      supplierStatus.normalizedStatus === 'completed'
        ? recentOrdersInline([{ id: order.id }])
        : undefined
    );

    await markOrderStatusNotified(order.id, supplierStatus.normalizedStatus);
  }
}

export function startAutomationWorkers(bot: Telegraf<any>): () => void {
  let cartRunning = false;
  let orderRunning = false;

  const cartTick = async () => {
    if (cartRunning) return;
    cartRunning = true;
    try {
      await runCartRecovery(bot);
    } catch (error) {
      console.error('Falha no worker de carrinho:', error);
    } finally {
      cartRunning = false;
    }
  };

  const orderTick = async () => {
    if (orderRunning) return;
    orderRunning = true;
    try {
      await runOrderTracking(bot);
    } catch (error) {
      console.error('Falha no worker de status do pedido:', error);
    } finally {
      orderRunning = false;
    }
  };

  const cartInterval = setInterval(() => void cartTick(), 60 * 1000);
  const orderInterval = setInterval(() => void orderTick(), 90 * 1000);

  void cartTick();
  void orderTick();

  return () => {
    clearInterval(cartInterval);
    clearInterval(orderInterval);
  };
}
