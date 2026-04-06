import { addAffiliateCredits, ensureAffiliateEnabled, getAffiliateWallet, getOrderById, getWalletTopupById } from '../db/repositories.js';
import { env } from '../config/env.js';

export async function getAffiliatePanel(telegramId: number): Promise<string> {
  const code = await ensureAffiliateEnabled(telegramId);
  const wallet = await getAffiliateWallet(telegramId);

  return [
    '🤝 Indique e ganhe',
    '',
    'Compartilhe seu link de indicacao e acumule creditos no bot.',
    '',
    'Quando alguem entrar pelo seu link e concluir uma compra ou recarga, o valor vira credito para sua carteira.',
    '',
    `💰 Creditos disponiveis: R$ ${wallet?.available_credits ?? '0.00'}`,
    '🔔 Voce recebe aviso quando alguem iniciar o chat com o seu link.',
    '',
    `🔗 Seu link de indicacao: ${env.publicBotUrl}?start=${code}`
  ].join('\n');
}

export async function processOrderCommission(orderId: number): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order || !order.referred_by_code || order.status !== 'paid') {
    return;
  }

  const commissionAmount = Number((Number(order.total_amount) * (env.affiliateCommissionPercent / 100)).toFixed(2));
  if (commissionAmount > 0) {
    await addAffiliateCredits(
      order.referred_by_code,
      commissionAmount,
      'order',
      String(orderId),
      `Credito de indicacao do pedido #${orderId}`
    );
  }
}

export async function processTopupCommission(topupId: number): Promise<void> {
  const topup = await getWalletTopupById(topupId);
  if (!topup || !topup.referred_by_code || topup.status !== 'paid') {
    return;
  }

  const commissionAmount = Number((Number(topup.amount) * (env.affiliateCommissionPercent / 100)).toFixed(2));
  if (commissionAmount > 0) {
    await addAffiliateCredits(
      topup.referred_by_code,
      commissionAmount,
      'topup',
      String(topupId),
      `Credito de indicacao da recarga #${topupId}`
    );
  }
}
