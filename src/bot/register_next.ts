import { Telegraf, session, Context } from 'telegraf';
import {
  checkoutCancelInline,
  guidedPackageOptionsInline,
  guidedPaymentOptionsInline,
  guidedPlatformsInline,
  guidedInstructionsInline,
  guidedSummaryInline,
  guidedSimpleOptionsInline,
  guidedTypesInline,
  orderCareEntryInline,
  orderCarePromptInline,
  orderCareResultInline,
  profileHubInline,
  recentOrdersInline,
  refillUpsellInline,
  storeMainMenu as mainMenu,
  supportAdminTicketInline,
  supportAbortInline,
  supportCategoriesInline,
  supportHubInline,
  supportOrderSelectionInline,
  supportTicketDetailInline,
  supportTicketsInline,
  topupAmountsInline,
  upsellOptionsInline
} from './keyboards.js';
import {
  getBalancePurchaseSummary,
  getBotGuideMessage,
  getCheckoutLinkPrompt,
  getGuidedServiceSummary,
  getGuidedPlatformPrompt,
  getHowItWorksMessage,
  getInvalidLinkMessage,
  getCommercialServiceName,
  getMandatoryInstructionsMessage,
  getManualOrderStatusMessage,
  getPackagePrompt,
  getPlatformTypePrompt,
  getOrderCareEntryMessage,
  getOrderCareManualPrompt,
  getOrderCareOrderNotFoundMessage,
  getOrderCareRateLimitMessage,
  getReadableSupplierStatusLabel,
  getFallbackOrderStatusMessage,
  getCancelBlockedMessage,
  getCancelSuccessMessage,
  getRefillBlockedMessage,
  getRefillSuccessMessage,
  getRepeatOrderPrompt,
  getSupportAdminNotificationMessage,
  getSupportAdminReplyPrompt,
  getSupportAdminReplySentMessage,
  getSupportAdminTicketClosedMessage,
  getSupportCategoryPrompt,
  getSupportCloseUsageMessage,
  getSupportClosedForCustomerMessage,
  getSupportGroupSetupMessage,
  getSupportMessage,
  getSupportDescriptionPrompt,
  getSupportHubMessage,
  getSupportOrderPrompt,
  getSupportReplyUsageMessage,
  getSupportReplyConfirmation,
  getSupportReplyFromTeamMessage,
  getSupportReplyPrompt,
  getSupportTicketCreatedMessage,
  getSupportTicketDetailMessage,
  getSupportTicketsListMessage,
  getUpsellMessage,
  getVariantPrompt,
  getWalletHubMessage,
  getWalletPrompt,
  getWalletSummary,
  getWelcomeMessage
} from './messages.js';
import {
  captureLead,
  createOrder,
  createWalletTopup,
  debitUserWallet,
  getAffiliateOwnerByCode,
  getManagedOrderForUser,
  getGuidedServices,
  getOrderById,
  getServiceById,
  getUserReferrerCode,
  getUserWallet,
  listRecentOrders,
  markOrderPaid,
  markWalletTopupPaid,
  updateOrderStatus,
  updateOrderSupplierResult,
  updateWalletTopupStatus,
  upsertUser,
  creditUserWallet
} from '../db/repositories.js';
import {
  getCheckoutCartByTelegramId,
  getUserOrderDetails,
  markCheckoutCartRecovered,
  markCheckoutCartStatus,
  markOrderStatusNotified,
  touchOrderSupplierCheck,
  upsertCheckoutCart,
  type CheckoutCartRecord,
  type CheckoutCartStage
} from '../db/commerce.js';
import {
  countRecentOrderActionLogs,
  createOrderActionLog,
  type OrderCareAction
} from '../db/orderCare.js';
import {
  addSupportMessage,
  closeSupportTicket,
  createSupportTicket,
  getSupportTicketById,
  getSupportTicketForUser,
  listSupportMessages,
  listSupportTicketsForTeam,
  listUserSupportTickets,
  reopenSupportTicket,
  type SupportTicketRecord
} from '../db/support.js';
import { getAffiliatePanel, processOrderCommission, processTopupCommission } from '../services/affiliateService.js';
import {
  getUpsellSuggestions,
  rankInstagramOffers,
  type InstagramServiceType
} from '../services/offerRanking.js';
import { createPixPayment, getPaymentStatus } from '../integrations/mercadopagoApi.js';
import {
  fetchSupplierOrderStatus,
  requestSupplierCancel,
  requestSupplierRefill,
  submitOrder
} from '../integrations/supplierApi.js';
import { env } from '../config/env.js';
import {
  inferServiceType,
  serviceHasRefillSignal,
  getVariantStep,
  normalizeGuidedCheckoutLink,
  type RefillMode
} from '../utils/guidedCatalog.js';
import type { GuidedInstagramService } from '../db/repositories.js';

type PurchaseStep = 'link' | 'confirm';
type SupportSessionMode = 'awaiting_description' | 'awaiting_user_reply' | 'awaiting_admin_reply';
type OrderCareStep = 'awaiting_order_id';

type PurchaseSession = {
  platform?: string;
  type?: string;
  origin?: string;
  refillMode?: 'with_refill' | 'without_refill' | 'any';
  serviceId?: number;
  baseServiceId?: number;
  step?: PurchaseStep;
  link?: string;
  quantity?: number;
  amount?: number;
  orderId?: number;
  pixPaymentId?: string;
  refillUpsellServiceId?: number;
  refillUpsellExtra?: number;
  refillUpsellAccepted?: boolean;
};

type SupportSession = {
  mode: SupportSessionMode;
  category?: string;
  orderId?: number;
  ticketId?: number;
  customerTelegramId?: number;
};

type OrderCareSession = {
  action: OrderCareAction;
  step: OrderCareStep;
};

export interface MyContext extends Context {
  session: {
    purchase?: PurchaseSession;
    support?: SupportSession;
    orderCare?: OrderCareSession;
    lastActiveAt?: number;
  };
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const ORDER_ACTION_WINDOW_SECONDS = 60;
const ORDER_ACTION_MAX_PER_WINDOW = 6;
const ORDER_ACTION_SAME_ORDER_WINDOW_SECONDS = 90;
const ORDER_ACTION_SAME_ORDER_MAX = 2;
const MIN_COMMERCIAL_PACKAGE_AMOUNT = 5;
let resolvedSupportChatId = env.supportChatId;

function parseStartPayload(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const parts = text.split(' ');
  return parts[1];
}

function setResolvedSupportChatId(chatId: string | number | null | undefined): void {
  if (chatId === undefined || chatId === null) {
    return;
  }

  const normalized = String(chatId).trim();
  if (!normalized) {
    return;
  }

  resolvedSupportChatId = normalized;
}

function getSupportChatIdCandidates(preferredChatId?: string | number | null): string[] {
  const values = [preferredChatId, resolvedSupportChatId, env.supportChatId];
  const unique = new Set<string>();

  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }

    const normalized = String(value).trim();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

function getMigratedSupportChatId(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const migrated = (error as {
    response?: {
      parameters?: {
        migrate_to_chat_id?: string | number;
      };
    };
  }).response?.parameters?.migrate_to_chat_id;

  if (migrated === undefined || migrated === null) {
    return undefined;
  }

  const normalized = String(migrated).trim();
  return normalized || undefined;
}

async function callSupportChatApi<T>(
  bot: Telegraf<MyContext>,
  method: 'sendMessage' | 'pinChatMessage' | 'unpinAllChatMessages',
  payload: Record<string, unknown>
): Promise<T> {
  const candidates = getSupportChatIdCandidates(payload.chat_id as string | number | null | undefined);
  let lastError: unknown;

  for (const chatId of candidates) {
    try {
      const response = await bot.telegram.callApi(method, {
        ...payload,
        chat_id: chatId
      });
      setResolvedSupportChatId(chatId);
      return response as T;
    } catch (error) {
      const migratedChatId = getMigratedSupportChatId(error);
      if (migratedChatId && migratedChatId !== chatId) {
        try {
          const response = await bot.telegram.callApi(method, {
            ...payload,
            chat_id: migratedChatId
          });
          setResolvedSupportChatId(migratedChatId);
          return response as T;
        } catch (retryError) {
          lastError = retryError;
          continue;
        }
      }

      lastError = error;
    }
  }

  throw lastError ?? new Error('Nao foi possivel acessar o chat de suporte.');
}

async function notifyAffiliateLeadStart(
  ctx: MyContext,
  referredByCode: string | undefined,
  lead: {
    telegramId: number;
    username?: string;
    fullName: string;
  }
): Promise<void> {
  if (!referredByCode) {
    return;
  }

  const affiliateOwner = await getAffiliateOwnerByCode(referredByCode);
  if (!affiliateOwner || affiliateOwner.telegram_id === lead.telegramId) {
    return;
  }

  const displayName = lead.username ? `@${lead.username}` : lead.fullName;

  try {
    await ctx.telegram.sendMessage(
      affiliateOwner.telegram_id,
      [
        '🎉 Novo lead no seu link de indicacao',
        '',
        `👤 Usuario: ${displayName}`,
        '💬 Ele acabou de iniciar o chat pelo seu link.',
        '⚡ Se essa pessoa concluir compra ou recarga, os creditos entram no seu bot.'
      ].join('\n')
    );
  } catch (error) {
    console.error('Falha ao notificar lead do afiliado:', error);
  }
}

function getNumeric(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return fallback;
}

function formatQuantity(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toString().replace('.0', '')}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toString().replace('.0', '')}K`;
  }

  return String(value);
}

function getQuantityNoun(type?: string, platform?: string): string {
  if (platform === 'YouTube' && type === 'Seguidores') return 'inscritos';
  if (type === 'Seguidores') return 'seguidores';
  if (type === 'Membros') return 'membros';
  if (type === 'Curtidas') return 'curtidas';
  if (type === 'Curtidas + Seguidores') return 'curtidas + seguidores';
  if (type === 'Reacoes') return 'reacoes';
  if (type === 'Visualizacoes') return 'visualizacoes';
  if (type === 'Comentarios') return 'comentarios';
  if (type === 'Metricas') return 'metricas';
  return 'unidades';
}

function formatCommercialQuantity(quantity: number, type?: string, platform?: string): string {
  return `${formatQuantity(quantity)} ${getQuantityNoun(type, platform)}`;
}

function getSuggestedQuantities(type?: string, platform?: string): number[] {
  if (type === 'Seguidores') {
    return [100, 200, 500, 1000, 2000, 5000, 10000];
  }

  if (platform === 'Instagram') {
    return [100, 200, 500, 1000, 5000, 10000];
  }

  if (type === 'Comentarios') {
    return platform === 'Instagram'
      ? [100, 200, 500, 1000, 5000, 10000]
      : [50, 100, 250, 500, 1000, 2000];
  }

  if (platform === 'YouTube' && type === 'Seguidores') {
    return [100, 200, 500, 1000, 2500, 5000];
  }

  if ((platform === 'Facebook' || platform === 'WhatsApp') && type === 'Seguidores') {
    return [100, 250, 500, 1000, 2500, 5000];
  }

  if (platform === 'Telegram' && type === 'Visualizacoes') {
    return [5000, 10000, 20000, 50000, 100000];
  }

  if (type === 'Reacoes') {
    return [100, 250, 500, 1000, 2500, 5000];
  }

  if (type === 'Membros' || type === 'Curtidas + Seguidores') {
    return [100, 250, 500, 1000, 2500, 5000];
  }

  if (type === 'Outros') {
    return [100, 500, 1000, 2000, 5000, 10000];
  }

  return [1000, 2000, 5000, 10000, 20000, 50000];
}

function getQuantityStep(type?: string, platform?: string): number {
  if (platform === 'Instagram') return 100;
  if (type === 'Comentarios') return 50;
  if (type === 'Reacoes') return 50;
  if (platform === 'YouTube' && type === 'Seguidores') return 100;
  if ((platform === 'Facebook' || platform === 'WhatsApp') && type === 'Seguidores') return 100;
  if (type === 'Membros' || type === 'Curtidas + Seguidores') return 100;
  if (type === 'Outros') return 100;
  return 1000;
}

function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function buildPackages(service: GuidedInstagramService, type?: string): Array<{ quantity: number; amount: number; amountCents: number; label: string }> {
  const min = getNumeric(service.raw_payload?.min, 1);
  const max = getNumeric(service.raw_payload?.max, 1000000);
  const serviceType = String(service.raw_payload?.type ?? '').toLowerCase();
  const servicePrice = Number(service.final_price);
  const isFixedPackage = serviceType === 'package' || max <= 10 || min === max;

  if (isFixedPackage) {
    const fixedQuantity = Math.max(min, 1);
    return [{
      quantity: fixedQuantity,
      amount: servicePrice,
      amountCents: Math.round(servicePrice * 100),
      label: `${formatCommercialQuantity(fixedQuantity, type, service.catalog_platform)} - R$ ${servicePrice.toFixed(2)}`
    }];
  }

  const unitPrice = servicePrice / 1000;
  const packages: Array<{ quantity: number; amount: number; amountCents: number; label: string }> = [];
  const seen = new Set<number>();
  const quantityStep = getQuantityStep(type, service.catalog_platform);
  const budgetStartQuantity = roundUpToStep(
    Math.max(min, Math.ceil(MIN_COMMERCIAL_PACKAGE_AMOUNT / Math.max(unitPrice, 0.000001))),
    quantityStep
  );
  const suggestions = service.catalog_platform === 'Instagram'
    ? getSuggestedQuantities(type, service.catalog_platform)
    : [
      min,
      min * 2,
      min * 5,
      budgetStartQuantity,
      budgetStartQuantity * 2,
      ...getSuggestedQuantities(type, service.catalog_platform)
    ];

  for (const suggestion of suggestions) {
    const adjustedQuantity = Math.max(suggestion, min);
    if (adjustedQuantity > max || seen.has(adjustedQuantity)) {
      continue;
    }

    const amount = Number((adjustedQuantity * unitPrice).toFixed(2));
    if (amount < MIN_COMMERCIAL_PACKAGE_AMOUNT) {
      continue;
    }

    seen.add(adjustedQuantity);
    packages.push({
      quantity: adjustedQuantity,
      amount,
      amountCents: Math.round(amount * 100),
      label: `${formatCommercialQuantity(adjustedQuantity, type, service.catalog_platform)} - R$ ${amount.toFixed(2)}`
    });
  }

  if (!packages.length) {
    const minimumBudgetQuantity = roundUpToStep(
      Math.max(min, Math.ceil(MIN_COMMERCIAL_PACKAGE_AMOUNT / unitPrice)),
      quantityStep
    );
    const fallbackCandidates = [
      minimumBudgetQuantity,
      minimumBudgetQuantity * 2,
      minimumBudgetQuantity * 5
    ];

    for (const candidate of fallbackCandidates) {
      const adjustedQuantity = Math.max(candidate, min);
      if (adjustedQuantity > max || seen.has(adjustedQuantity)) {
        continue;
      }

      const amount = Number((adjustedQuantity * unitPrice).toFixed(2));
      seen.add(adjustedQuantity);
      packages.push({
        quantity: adjustedQuantity,
        amount,
        amountCents: Math.round(amount * 100),
        label: `${formatCommercialQuantity(adjustedQuantity, type, service.catalog_platform)} - R$ ${amount.toFixed(2)}`
      });
    }
  }

  if (!packages.length) {
    const minimumQuantity = Math.max(min, 1);
    const amount = Number((minimumQuantity * unitPrice).toFixed(2));
    packages.push({
      quantity: minimumQuantity,
      amount,
      amountCents: Math.round(amount * 100),
      label: `${formatCommercialQuantity(minimumQuantity, type, service.catalog_platform)} - R$ ${amount.toFixed(2)}`
    });
  }

  return packages
    .sort((left, right) => left.quantity - right.quantity || left.amount - right.amount)
    .slice(0, 7);
}

function formatOrderTarget(platform: string | undefined, link: string | null | undefined): string {
  if (!link) return 'Nao informado';

  if (platform === 'Instagram') {
    const handle = link.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/$/, '');
    return handle.startsWith('@') ? handle : link;
  }

  if (platform === 'Telegram') {
    const channel = link.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '@').replace(/\/$/, '');
    return channel.startsWith('@') ? channel : link;
  }

  return link;
}

function calculateRefillUpsellAmount(baseAmount: number, apiDifference: number): number {
  const suggested = baseAmount >= 25
    ? 10
    : baseAmount >= 15
      ? 7
      : baseAmount >= 10
        ? 5
        : 4;

  return Number(Math.max(suggested, apiDifference + 2).toFixed(2));
}

async function resolveRefillUpsell(
  purchase: PurchaseSession,
  baseService: GuidedInstagramService
): Promise<{ service: GuidedInstagramService; extraAmount: number } | null> {
  if (!purchase.platform || !purchase.type || !purchase.quantity || !purchase.amount) {
    return null;
  }

  if (serviceHasRefillSignal(baseService)) {
    return null;
  }

  const refillServices = await getGuidedServices(
    purchase.platform,
    purchase.type,
    purchase.origin,
    'with_refill'
  );

  if (!refillServices.length) {
    return null;
  }

  const [refillService] = sortGuidedServices(
    purchase.platform,
    purchase.type,
    purchase.origin,
    refillServices.filter((service) => service.id !== baseService.id)
  );

  if (!refillService) {
    return null;
  }

  const apiDifference = Math.max(
    0,
    Number((((Number(refillService.final_price) - Number(baseService.final_price)) / 1000) * purchase.quantity).toFixed(2))
  );

  return {
    service: refillService,
    extraAmount: calculateRefillUpsellAmount(purchase.amount, apiDifference)
  };
}

async function openWalletHome(ctx: MyContext): Promise<void> {
  const senderId = ctx.from?.id;
  if (!senderId) return;

  const wallet = await getUserWallet(senderId);
  await ctx.reply(
    getWalletHubMessage(
      wallet?.balance ?? '0.00',
      wallet?.total_added ?? '0.00',
      wallet?.total_spent ?? '0.00'
    ),
    topupAmountsInline()
  );
}

async function openProfileHome(ctx: MyContext): Promise<void> {
  await ctx.reply(
    [
      '👤 PERFIL',
      '',
      'Acompanhe seus pedidos, consulte status e fale com o suporte por aqui.'
    ].join('\n'),
    profileHubInline()
  );
}

function getCartStage(purchase: PurchaseSession | undefined): CheckoutCartStage {
  if (!purchase?.platform) return 'platform';
  if (!purchase.type) return 'type';
  if (getVariantStep(purchase.platform, purchase.type).kind !== 'none' && !purchase.origin) return 'origin';
  if (!purchase.quantity || !purchase.amount) return 'package';
  if (!purchase.serviceId) return 'package';
  if (!purchase.link) return 'link';
  return 'confirm';
}

async function syncPurchase(ctx: MyContext, purchase: PurchaseSession): Promise<void> {
  ctx.session.purchase = purchase;
  const senderId = ctx.from?.id;
  if (!senderId) {
    return;
  }

  await upsertCheckoutCart(senderId, {
    serviceId: purchase.serviceId,
    platform: purchase.platform,
    serviceType: purchase.type,
    origin: purchase.origin,
    refillMode: purchase.refillMode,
    targetLink: purchase.link,
    quantity: purchase.quantity,
    amount: purchase.amount,
    stage: getCartStage(purchase),
    status: 'active'
  });
}

async function finalizePurchaseSession(
  ctx: MyContext,
  status: 'cancelled' | 'converted',
  convertedOrderId?: number
): Promise<void> {
  const senderId = ctx.from?.id;
  ctx.session.purchase = undefined;

  if (!senderId) {
    return;
  }

  await markCheckoutCartStatus(senderId, status, convertedOrderId);
}

function getPurchaseFromCart(cart: CheckoutCartRecord): PurchaseSession {
  return {
    platform: cart.platform ?? undefined,
    type: cart.service_type ?? undefined,
    origin: cart.origin ?? undefined,
    refillMode: (cart.refill_mode as PurchaseSession['refillMode']) ?? undefined,
    serviceId: cart.service_id ?? undefined,
    link: cart.target_link ?? undefined,
    quantity: cart.quantity ?? undefined,
    amount: cart.amount ? Number(cart.amount) : undefined,
    step: cart.stage === 'link' ? 'link' : cart.stage === 'confirm' ? 'confirm' : undefined
  };
}

function sortGuidedServices(
  platform: string,
  type: string,
  variant: string | undefined,
  services: GuidedInstagramService[]
): GuidedInstagramService[] {
  if (platform === 'Instagram') {
    return rankInstagramOffers(services, {
      type,
      origin: variant ?? 'Todos'
    }).map((offer) => offer.service);
  }

  return [...services].sort((left, right) => Number(left.final_price) - Number(right.final_price));
}

async function resolveBestGuidedService(
  purchase: PurchaseSession,
  requestedRefillMode: RefillMode
): Promise<{ service: GuidedInstagramService; appliedRefillMode: RefillMode; note?: string } | null> {
  if (!purchase.platform || !purchase.type) {
    return null;
  }

  const attempts: Array<{ variant: string | undefined; refillMode: RefillMode; note?: string }> = [
    { variant: purchase.origin, refillMode: requestedRefillMode },
    {
      variant: purchase.origin,
      refillMode: 'any',
      note: 'Selecionei a melhor opcao disponivel dentro deste filtro para agilizar sua compra.'
    }
  ];

  if (purchase.origin) {
    attempts.push({
      variant: undefined,
      refillMode: 'any',
      note: 'Selecionei a melhor opcao disponivel dentro do tipo escolhido.'
    });
  }

  for (const attempt of attempts) {
    const services = await getGuidedServices(
      purchase.platform,
      purchase.type,
      attempt.variant,
      attempt.refillMode
    );
    if (!services.length) {
      continue;
    }

    const [service] = sortGuidedServices(purchase.platform, purchase.type, attempt.variant, services);
    if (!service) {
      continue;
    }

    return {
      service,
      appliedRefillMode: attempt.refillMode,
      note: attempt.note
    };
  }

  return null;
}

async function openPackageStep(
  ctx: MyContext,
  purchase: PurchaseSession,
  requestedRefillMode: RefillMode,
  editCurrentMessage = true,
  backAction = 'guided_back_variant'
): Promise<void> {
  if (!purchase.platform || !purchase.type) {
    await ctx.reply(getGuidedPlatformPrompt(), guidedPlatformsInline());
    return;
  }

  const resolved = await resolveBestGuidedService(purchase, requestedRefillMode);
  if (!resolved) {
    await ctx.reply('😕 Nao encontrei servicos disponiveis para esse filtro agora. Tente outro tipo ou ajuste a selecao.', mainMenu());
    await finalizePurchaseSession(ctx, 'cancelled');
    return;
  }

  const packages = buildPackages(resolved.service, purchase.type);
  if (!packages.length) {
    await ctx.reply('😕 Nao encontrei quantidades prontas para essa oferta agora. Escolha outro filtro.', mainMenu());
    await finalizePurchaseSession(ctx, 'cancelled');
    return;
  }

  const nextPurchase: PurchaseSession = {
    ...purchase,
    refillMode: resolved.appliedRefillMode,
    serviceId: resolved.service.id,
    baseServiceId: resolved.service.id,
    quantity: undefined,
    amount: undefined,
    link: undefined,
    orderId: undefined,
    pixPaymentId: undefined,
    refillUpsellServiceId: undefined,
    refillUpsellExtra: undefined,
    refillUpsellAccepted: undefined
  };

  await syncPurchase(ctx, nextPurchase);
  const text = getPackagePrompt(
    resolved.service,
    {
      platform: nextPurchase.platform!,
      type: nextPurchase.type!,
      variant: nextPurchase.origin,
      refillMode: nextPurchase.refillMode
    },
    resolved.note
  );
  const keyboard = guidedPackageOptionsInline(
    packages.map((item) => ({
      quantity: item.quantity,
      amountCents: item.amountCents,
      label: item.label
    })),
    backAction
  );

  if (editCurrentMessage) {
    await ctx.editMessageText(text, keyboard);
    return;
  }

  await ctx.reply(text, keyboard);
}

async function continueGuidedPurchaseFlow(
  ctx: MyContext,
  purchase: PurchaseSession,
  editCurrentMessage = true
): Promise<void> {
  if (!purchase.platform || !purchase.type) {
    await ctx.reply(getGuidedPlatformPrompt(), guidedPlatformsInline());
    return;
  }

  await openPackageStep(
    ctx,
    purchase,
    'without_refill',
    editCurrentMessage,
    getVariantStep(purchase.platform, purchase.type).kind === 'none'
      ? 'guided_back_type'
      : 'guided_back_variant'
  );
}

async function showSelectedPackageSummary(
  ctx: MyContext,
  service: GuidedInstagramService,
  purchase: PurchaseSession,
  editCurrentMessage = true
): Promise<void> {
  if (!purchase.platform || !purchase.type || !purchase.quantity || !purchase.amount) {
    return;
  }

  const text = getGuidedServiceSummary(service, {
    platform: purchase.platform,
    type: purchase.type,
    variant: purchase.origin,
    refillMode: purchase.refillMode,
    quantity: purchase.quantity,
    amount: purchase.amount
  });
  const linkLabel = purchase.platform === 'Instagram' && purchase.type === 'Seguidores'
    ? '👤 Enviar @ do Instagram'
    : '🔗 Enviar link';

  if (editCurrentMessage) {
    await ctx.editMessageText(text, guidedSummaryInline(linkLabel));
    return;
  }

  await ctx.reply(text, guidedSummaryInline(linkLabel));
}

function isSupportTeamContext(ctx: MyContext): boolean {
  if (!env.supportChatId && !resolvedSupportChatId) {
    return false;
  }

  const currentChatId = String(ctx.chat?.id ?? '');
  return getSupportChatIdCandidates().includes(currentChatId);
}

function resetSupportSession(ctx: MyContext): void {
  ctx.session.support = undefined;
}

async function openSupportHome(ctx: MyContext, editCurrentMessage = false): Promise<void> {
  const senderId = ctx.from?.id;
  const tickets = senderId ? await listUserSupportTickets(senderId) : [];
  const text = getSupportHubMessage(env.supportContact);
  const keyboard = supportHubInline({
    hasTickets: tickets.length > 0,
    hasContact: Boolean(env.supportContact)
  });

  resetSupportSession(ctx);
  resetOrderCareSession(ctx);
  ctx.session.purchase = undefined;

  if (editCurrentMessage) {
    await ctx.editMessageText(text, keyboard);
    return;
  }

  await ctx.reply(text, keyboard);
}

async function notifySupportTeam(
  bot: Telegraf<MyContext>,
  ticket: SupportTicketRecord,
  messageText: string
): Promise<void> {
  if (!env.supportChatId && !resolvedSupportChatId) {
    return;
  }

  try {
    const sent = await callSupportChatApi<{ message_id: number; chat: { id: number | string } }>(bot, 'sendMessage', {
      text: getSupportAdminNotificationMessage(ticket, messageText),
      disable_notification: true,
      ...supportAdminTicketInline(ticket.id, ticket.status === 'closed')
    });

    const supportChatId = String(sent.chat.id);
    setResolvedSupportChatId(supportChatId);

    try {
      await callSupportChatApi(bot, 'unpinAllChatMessages', {
        chat_id: supportChatId
      });
    } catch (pinCleanupError) {
      console.error('Falha ao limpar fixacao anterior do suporte:', pinCleanupError);
    }

    try {
      await callSupportChatApi(bot, 'pinChatMessage', {
        chat_id: supportChatId,
        message_id: sent.message_id,
        disable_notification: true
      });
    } catch (pinError) {
      console.error('Falha ao fixar ticket mais recente no suporte:', pinError);
    }
  } catch (error) {
    console.error('Falha ao notificar suporte:', error);
  }
}

function getSupportAgentDisplayName(from?: MyContext['from']): string {
  if (!from) {
    return 'Equipe RatoAcess';
  }

  if (from.username) {
    return `@${from.username}`;
  }

  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
  return fullName || 'Equipe RatoAcess';
}

function buildSupportReplyMessage(agentName: string, reply: string): string {
  return [
    `👤 Atendente: ${agentName}`,
    '',
    reply.trim()
  ].join('\n');
}

function extractTicketIdFromSupportThreadMessage(message: any): number | null {
  const rawText = String(message?.text ?? message?.caption ?? '');
  const match = rawText.match(/ticket\s*#(\d+)/i);
  if (!match) {
    return null;
  }

  const ticketId = Number(match[1]);
  return Number.isInteger(ticketId) && ticketId > 0 ? ticketId : null;
}

async function notifyCustomerReply(
  bot: Telegraf<MyContext>,
  ticketId: number,
  customerTelegramId: number,
  reply: string,
  closed = false
): Promise<void> {
  try {
    await bot.telegram.sendMessage(
      customerTelegramId,
      closed ? getSupportClosedForCustomerMessage(ticketId) : getSupportReplyFromTeamMessage(ticketId, reply),
      supportTicketDetailInline(ticketId, closed)
    );
  } catch (error) {
    console.error('Falha ao notificar cliente do suporte:', error);
  }
}

async function replyToSupportTicket(
  bot: Telegraf<MyContext>,
  ctx: MyContext,
  ticketId: number,
  reply: string
): Promise<void> {
  const senderId = ctx.from?.id;
  if (!senderId) {
    return;
  }

  const ticket = await getSupportTicketById(ticketId);
  if (!ticket || ticket.status === 'closed') {
    await ctx.reply('⚠️ Esse ticket nao esta disponivel para resposta.');
    return;
  }

  const agentName = getSupportAgentDisplayName(ctx.from);
  const decoratedReply = buildSupportReplyMessage(agentName, reply);

  await addSupportMessage({
    ticketId: ticket.id,
    senderRole: 'support',
    telegramId: senderId,
    messageText: decoratedReply,
    assignedTo: senderId,
    assignedToName: agentName
  });

  await ctx.reply(getSupportAdminReplySentMessage(ticket.id));
  await notifyCustomerReply(bot, ticket.id, ticket.telegram_id, decoratedReply, false);
}

async function closeSupportTicketFromTeam(
  bot: Telegraf<MyContext>,
  ctx: MyContext,
  ticketId: number
): Promise<void> {
  const ticket = await getSupportTicketById(ticketId);
  if (!ticket) {
    await ctx.reply('⚠️ Ticket nao encontrado.');
    return;
  }

  await closeSupportTicket(ticketId, ctx.from?.id, getSupportAgentDisplayName(ctx.from));
  await notifyCustomerReply(bot, ticketId, ticket.telegram_id, '', true);
  await ctx.reply(getSupportAdminTicketClosedMessage(ticketId));
}

async function sendSupportTicketDetailToUser(
  ctx: MyContext,
  ticket: SupportTicketRecord,
  editCurrentMessage = false
): Promise<void> {
  const messages = await listSupportMessages(ticket.id, 8);
  const text = getSupportTicketDetailMessage(ticket, messages);
  const keyboard = supportTicketDetailInline(ticket.id, ticket.status === 'closed');

  if (editCurrentMessage) {
    await ctx.editMessageText(text, keyboard);
    return;
  }

  await ctx.reply(text, keyboard);
}

function resetOrderCareSession(ctx: MyContext): void {
  ctx.session.orderCare = undefined;
}

function canAttemptRefill(orderStatus: string): boolean {
  return ['completed', 'partial'].includes(orderStatus);
}

function canAttemptCancel(orderStatus: string): boolean {
  return ['pending', 'processing', 'submitted'].includes(orderStatus);
}

async function hitOrderActionRateLimit(
  telegramId: number,
  action: OrderCareAction,
  orderId?: number
): Promise<boolean> {
  const totalAttempts = await countRecentOrderActionLogs(telegramId, ORDER_ACTION_WINDOW_SECONDS);
  if (totalAttempts >= ORDER_ACTION_MAX_PER_WINDOW) {
    return true;
  }

  if (typeof orderId === 'number') {
    const sameOrderAttempts = await countRecentOrderActionLogs(
      telegramId,
      ORDER_ACTION_SAME_ORDER_WINDOW_SECONDS,
      action,
      orderId
    );

    if (sameOrderAttempts >= ORDER_ACTION_SAME_ORDER_MAX) {
      return true;
    }
  }

  return false;
}

async function openOrderCareEntry(
  ctx: MyContext,
  action: OrderCareAction,
  editCurrentMessage = false
): Promise<void> {
  const senderId = ctx.from?.id;
  if (!senderId) {
    return;
  }

  resetSupportSession(ctx);
  resetOrderCareSession(ctx);

  const orders = await listRecentOrders(senderId);
  const text = getOrderCareEntryMessage(action, orders.length > 0);
  const keyboard = orders.length
    ? orderCareEntryInline(action, orders.slice(0, 5).map((order) => ({
      id: order.id,
      service_name: order.service_name
    })))
    : orderCarePromptInline(action);

  if (editCurrentMessage) {
    await ctx.editMessageText(text, keyboard);
    return;
  }

  await ctx.reply(text, keyboard);
}

async function handleManualOrderAction(
  ctx: MyContext,
  action: OrderCareAction,
  orderId: number
): Promise<void> {
  const senderId = ctx.from?.id;
  if (!senderId) {
    return;
  }

  if (await hitOrderActionRateLimit(senderId, action, orderId)) {
    await createOrderActionLog({
      telegramId: senderId,
      orderId,
      action,
      success: false,
      message: 'rate_limited'
    });
    await ctx.reply(getOrderCareRateLimitMessage(), mainMenu());
    return;
  }

  const order = await getManagedOrderForUser(senderId, orderId);
  if (!order) {
    await createOrderActionLog({
      telegramId: senderId,
      orderId,
      action,
      success: false,
      message: 'order_not_found'
    });
    await ctx.reply(getOrderCareOrderNotFoundMessage(orderId), mainMenu());
    return;
  }

  const supplierOrderId = order.external_supplier_order_id ?? undefined;

  if (action === 'status') {
    if (!supplierOrderId) {
      await createOrderActionLog({
        telegramId: senderId,
        orderId: order.id,
        action,
        supplierOrderId: null,
        success: true,
        message: 'fallback_local_status'
      });
      await ctx.reply(getFallbackOrderStatusMessage(order), orderCareResultInline(order.id));
      return;
    }

    const details = await fetchSupplierOrderStatus(supplierOrderId);
    if (!details) {
      await createOrderActionLog({
        telegramId: senderId,
        orderId: order.id,
        action,
        supplierOrderId,
        success: false,
        message: 'supplier_status_unavailable'
      });
      await ctx.reply(getFallbackOrderStatusMessage(order), orderCareResultInline(order.id));
      return;
    }

    await touchOrderSupplierCheck(order.id, details.normalizedStatus);
    await createOrderActionLog({
      telegramId: senderId,
      orderId: order.id,
      action,
      supplierOrderId,
      success: true,
      message: details.rawStatus,
      responsePayload: details.raw
    });

    const canRefill = Boolean(order.service_raw_payload?.refill) && canAttemptRefill(details.normalizedStatus);
    const canCancel = canAttemptCancel(details.normalizedStatus);

    await ctx.reply(
      getManualOrderStatusMessage(order, {
        supplierStatusLabel: getReadableSupplierStatusLabel(details.normalizedStatus),
        supplierStatusRaw: details.rawStatus,
        remains: details.remains,
        startCount: details.startCount,
        canRefill,
        canCancel
      }),
      orderCareResultInline(order.id, {
        canRefill,
        canCancel
      })
    );
    return;
  }

  if (action === 'refill') {
    if (!supplierOrderId) {
      await createOrderActionLog({
        telegramId: senderId,
        orderId: order.id,
        action,
        success: false,
        message: 'missing_supplier_order'
      });
      await ctx.reply(
        getRefillBlockedMessage(order, 'Esse pedido ainda nao entrou na etapa de processamento necessaria para solicitar refil.'),
        orderCareResultInline(order.id)
      );
      return;
    }

    if (!order.service_raw_payload?.refill) {
      await createOrderActionLog({
        telegramId: senderId,
        orderId: order.id,
        action,
        supplierOrderId,
        success: false,
        message: 'service_without_refill'
      });
      await ctx.reply(
        getRefillBlockedMessage(order, 'Essa oferta foi cadastrada sem suporte a refil.'),
        orderCareResultInline(order.id, {
          canCancel: canAttemptCancel(order.external_service_status)
        })
      );
      return;
    }

    const details = await fetchSupplierOrderStatus(supplierOrderId);
    if (details) {
      await touchOrderSupplierCheck(order.id, details.normalizedStatus);
      if (!canAttemptRefill(details.normalizedStatus)) {
        await createOrderActionLog({
          telegramId: senderId,
          orderId: order.id,
          action,
          supplierOrderId,
          success: false,
          message: `refill_blocked_${details.normalizedStatus}`,
          responsePayload: details.raw
        });
        await ctx.reply(
          getRefillBlockedMessage(
            order,
            `No momento o pedido esta como ${getReadableSupplierStatusLabel(details.normalizedStatus)}. O refil costuma fazer sentido depois que a entrega fecha ou fica parcial.`
          ),
          orderCareResultInline(order.id, {
            canCancel: canAttemptCancel(details.normalizedStatus)
          })
        );
        return;
      }
    }

    const refillResult = await requestSupplierRefill(supplierOrderId);
    await createOrderActionLog({
      telegramId: senderId,
      orderId: order.id,
      action,
      supplierOrderId,
      success: refillResult.success,
      message: refillResult.message,
      responsePayload: refillResult.raw
    });

    if (!refillResult.success) {
      await ctx.reply(getRefillBlockedMessage(order, refillResult.message), orderCareResultInline(order.id));
      return;
    }

    await ctx.reply(getRefillSuccessMessage(order, refillResult.message), orderCareResultInline(order.id));
    return;
  }

  if (order.status === 'pending' && !supplierOrderId) {
    await updateOrderStatus(order.id, 'cancelled');
    await createOrderActionLog({
      telegramId: senderId,
      orderId: order.id,
      action,
      success: true,
      message: 'pending_order_cancelled_locally'
    });
    await ctx.reply(
      getCancelSuccessMessage(order, 'O pedido estava pendente no bot e foi cancelado antes de iniciar o processamento.'),
      orderCareResultInline(order.id)
    );
    return;
  }

  if (!supplierOrderId) {
    await createOrderActionLog({
      telegramId: senderId,
      orderId: order.id,
      action,
      success: false,
      message: 'missing_supplier_order'
    });
    await ctx.reply(
      getCancelBlockedMessage(order, 'Ainda nao existe uma etapa de processamento ativa para este pedido.'),
      orderCareResultInline(order.id)
    );
    return;
  }

  const details = await fetchSupplierOrderStatus(supplierOrderId);
  if (details) {
    await touchOrderSupplierCheck(order.id, details.normalizedStatus);
    if (!canAttemptCancel(details.normalizedStatus)) {
      await createOrderActionLog({
        telegramId: senderId,
        orderId: order.id,
        action,
        supplierOrderId,
        success: false,
        message: `cancel_blocked_${details.normalizedStatus}`,
        responsePayload: details.raw
      });
      await ctx.reply(
        getCancelBlockedMessage(
          order,
          `No momento o pedido esta como ${getReadableSupplierStatusLabel(details.normalizedStatus)} e nao parece elegivel para cancelamento.`
        ),
        orderCareResultInline(order.id, {
          canRefill: Boolean(order.service_raw_payload?.refill) && canAttemptRefill(details.normalizedStatus)
        })
      );
      return;
    }
  }

  const cancelResult = await requestSupplierCancel(supplierOrderId);
  await createOrderActionLog({
    telegramId: senderId,
    orderId: order.id,
    action,
    supplierOrderId,
    success: cancelResult.success,
    message: cancelResult.message,
    responsePayload: cancelResult.raw
  });

  if (!cancelResult.success) {
    await ctx.reply(getCancelBlockedMessage(order, cancelResult.message), orderCareResultInline(order.id));
    return;
  }

  await touchOrderSupplierCheck(order.id, 'cancelled');
  await markOrderStatusNotified(order.id, 'cancelled');
  await ctx.reply(getCancelSuccessMessage(order, cancelResult.message), orderCareResultInline(order.id));
}

async function sendRecentOrders(ctx: MyContext): Promise<void> {
  const senderId = ctx.from?.id;
  if (!senderId) return;

  const orders = await listRecentOrders(senderId);
  if (!orders.length) {
    await ctx.reply('📭 Voce ainda nao possui pedidos registrados por aqui.', mainMenu());
    return;
  }

  const text = orders.map((order) => (
    [
      `📦 Pedido #${order.id}`,
      `🛍️ Servico: ${order.service_name ?? 'Servico removido'}`,
      `🎯 Destino: ${formatOrderTarget(order.platform ?? undefined, order.target_link)}`,
      `📍 Status: ${order.status}`,
      `💸 Valor: R$ ${order.total_amount}`,
      order.quantity ? `📦 Quantidade: ${formatQuantity(order.quantity)}` : null
    ].filter(Boolean).join('\n')
  )).join('\n\n');

  await ctx.reply(text, recentOrdersInline(orders.slice(0, 5).map((order) => ({ id: order.id }))));
}

async function sendUpsellSuggestions(ctx: MyContext, service: GuidedInstagramService): Promise<void> {
  if (service.catalog_platform && service.catalog_platform !== 'Instagram') {
    return;
  }

  const suggestions = getUpsellSuggestions(service);
  if (!suggestions.length) {
    return;
  }

  await ctx.reply(
    getUpsellMessage(service, suggestions),
    upsellOptionsInline(suggestions.map((item) => ({
      token: item.token,
      label: item.label
    })))
  );
}

async function presentCheckoutOptions(
  ctx: MyContext,
  service: GuidedInstagramService,
  purchase: PurchaseSession
): Promise<void> {
  const senderId = ctx.from?.id;
  if (!senderId || !purchase.platform || !purchase.type || !purchase.link || !purchase.quantity || !purchase.amount) {
    return;
  }

  const nextPurchase: PurchaseSession = {
    ...purchase,
    step: 'confirm'
  };

  if (purchase.refillUpsellAccepted === undefined) {
    const refillUpsell = await resolveRefillUpsell(nextPurchase, service);
    if (refillUpsell) {
      await syncPurchase(ctx, {
        ...nextPurchase,
        baseServiceId: purchase.baseServiceId ?? service.id,
        refillUpsellServiceId: refillUpsell.service.id,
        refillUpsellExtra: refillUpsell.extraAmount
      });
      await ctx.reply(
        [
          '🛡️ PROTEÇÃO EXTRA DISPONÍVEL',
          '',
          `Seu pedido base fica em R$ ${purchase.amount.toFixed(2)}.`,
          `Você pode adicionar reposição por mais R$ ${refillUpsell.extraAmount.toFixed(2)}.`,
          '',
          'Se houver queda durante o prazo da oferta com reposição, você fica com uma camada extra de proteção neste pedido.'
        ].join('\n'),
        refillUpsellInline()
      );
      return;
    }

    nextPurchase.refillUpsellAccepted = false;
  }

  await syncPurchase(ctx, nextPurchase);

  const wallet = await getUserWallet(senderId);
  const balanceText = wallet?.balance ?? '0.00';
  const balance = Number(balanceText);
  const hasEnoughBalance = balance >= nextPurchase.amount!;

  await ctx.reply(
    getBalancePurchaseSummary(
      service,
      nextPurchase.platform!,
      nextPurchase.type!,
      nextPurchase.quantity!,
      nextPurchase.amount!,
      nextPurchase.link!,
      balanceText,
      hasEnoughBalance
    ),
    guidedPaymentOptionsInline(hasEnoughBalance)
  );
}

async function sendTopupSuggestion(ctx: MyContext): Promise<void> {
  const senderId = ctx.from?.id;
  const purchase = ctx.session.purchase;
  if (!senderId || !purchase?.amount) {
    await openWalletHome(ctx);
    return;
  }

  const wallet = await getUserWallet(senderId);
  const balance = Number(wallet?.balance ?? 0);
  const shortage = Math.max(purchase.amount - balance, 0);

  await ctx.reply(
    [
      `💸 Faltam R$ ${shortage.toFixed(2)} para concluir este pedido.`,
      `🧾 Pedido atual: R$ ${purchase.amount.toFixed(2)}`,
      `💰 Saldo atual: R$ ${(wallet?.balance ?? '0.00')}`,
      '',
      '⚡ Escolha uma recarga para manter o carrinho salvo e finalizar depois.'
    ].join('\n'),
    topupAmountsInline()
  );
}

async function sendTopupPix(ctx: MyContext, amount: number): Promise<void> {
  const senderId = ctx.from?.id;
  if (!senderId) {
    await ctx.reply('⚠️ Nao foi possivel identificar o usuario para gerar a recarga.');
    return;
  }

  await ctx.reply(`💳 Gerando Pix de recarga no valor de R$ ${amount.toFixed(2)}...`);

  const payment = await createPixPayment(amount, 'Recarga de saldo', `user_${senderId}@telegram.com`);
  if (!payment) {
    await ctx.reply('🚨 Erro ao gerar o Pix da recarga. Tente novamente em instantes.', mainMenu());
    return;
  }

  const referredBy = await getUserReferrerCode(senderId);
  const topupId = await createWalletTopup(senderId, amount, String(payment.id), referredBy || undefined);

  await ctx.reply(`✅ Recarga #${topupId} criada.\n\n🖼️ Escaneie o QR Code abaixo. O codigo Pix copia e cola vai logo em seguida.`);
  if (payment.qrCodeBase64) {
    const buffer = Buffer.from(payment.qrCodeBase64, 'base64');
    await ctx.replyWithPhoto({ source: buffer }, { caption: 'QR Code da recarga' });
  }

  if (payment.qrCode) {
    await ctx.reply(payment.qrCode);
    await ctx.reply(
      [
        '📋 COPIE ESTE PIX E COLE NO SEU APP DE PAGAMENTOS.',
        '',
        '⚡ APOS A CONFIRMACAO, SEU SALDO SERA LIBERADO IMEDIATAMENTE.'
      ].join('\n')
    );
  }

  let isPolling = false;
  const pollInterval = setInterval(async () => {
    if (isPolling) return;

    isPolling = true;
    try {
      const status = await getPaymentStatus(payment.id);
      if (status === 'approved' || status === 'paid') {
        clearInterval(pollInterval);
        const markedPaid = await markWalletTopupPaid(topupId);
        if (!markedPaid) return;

        await creditUserWallet(senderId, amount, 'topup', String(topupId), `Recarga #${topupId}`);
        await processTopupCommission(topupId);

        const wallet = await getUserWallet(senderId);
        const purchase = ctx.session.purchase;
        const currentBalance = Number(wallet?.balance ?? 0);

        if (purchase?.serviceId && purchase.link && purchase.quantity && purchase.amount && currentBalance >= purchase.amount) {
          const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
          if (service) {
            await ctx.reply('✅ Recarga confirmada. Seu pedido continua salvo e pronto para finalizar.');
            await presentCheckoutOptions(ctx, service, purchase);
            return;
          }
        }

        await ctx.reply(
          [
            '✅ Recarga confirmada com sucesso.',
            `💰 Saldo atual: R$ ${wallet?.balance ?? '0.00'}`
          ].join('\n'),
          mainMenu()
        );
      } else if (status === 'cancelled' || status === 'rejected') {
        clearInterval(pollInterval);
        await updateWalletTopupStatus(topupId, 'cancelled');
        await ctx.reply('⚠️ A recarga foi cancelada ou recusada.', mainMenu());
      }
    } finally {
      isPolling = false;
    }
  }, 7000);

  setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);
}

async function finalizeSupplierSubmission(
  ctx: MyContext,
  orderId: number,
  service: GuidedInstagramService,
  link: string,
  quantity: number
): Promise<void> {
  const supplierOrderId = await submitOrder(service.external_service_id, link, quantity);
  if (supplierOrderId) {
    await updateOrderSupplierResult(orderId, 'submitted', supplierOrderId);
    await markOrderStatusNotified(orderId, 'submitted');
    await ctx.reply(
      `🚀 Pedido #${orderId} confirmado e iniciado com sucesso.`,
      mainMenu()
    );
    await sendUpsellSuggestions(ctx, service);
    return;
  }

  await updateOrderSupplierResult(orderId, 'failed');
  await ctx.reply(
    `⚠️ O pagamento do pedido #${orderId} foi confirmado, mas houve uma falha ao iniciar o pedido automaticamente.`,
    mainMenu()
  );
}

async function sendOrderPix(ctx: MyContext): Promise<void> {
  const senderId = ctx.from?.id;
  const purchase = ctx.session.purchase;
  if (!senderId || !purchase?.serviceId || !purchase.link || !purchase.quantity || !purchase.amount) {
    await ctx.reply('⚠️ Nao foi possivel localizar os dados deste pedido. Inicie novamente pelo menu.');
    ctx.session.purchase = undefined;
    return;
  }

  const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
  if (!service) {
    ctx.session.purchase = undefined;
    await ctx.reply('⚠️ Servico nao encontrado. Escolha outra oferta pelo menu principal.', mainMenu());
    return;
  }

  if (purchase.pixPaymentId) {
    await ctx.reply('⏳ Ja existe um Pix em aberto para este pedido. Se ele expirar, voce pode gerar outro.');
    return;
  }

  const orderLink = purchase.link;
  const orderQuantity = purchase.quantity;
  const orderAmount = purchase.amount;

  await syncPurchase(ctx, {
    ...purchase,
    pixPaymentId: 'creating',
    step: 'confirm'
  });

  await ctx.reply(`💳 Gerando Pix do pedido no valor de R$ ${orderAmount.toFixed(2)}...`);

  const payment = await createPixPayment(orderAmount, `Pedido ${service.name}`, `user_${senderId}@telegram.com`);
  if (!payment) {
    await syncPurchase(ctx, {
      ...purchase,
      pixPaymentId: undefined,
      step: 'confirm'
    });
    await presentCheckoutOptions(ctx, service, purchase);
    return;
  }

  const referredBy = await getUserReferrerCode(senderId);
  const orderId = await createOrder(
    senderId,
    purchase.serviceId,
    orderAmount,
    orderLink,
    orderQuantity,
    {
      displayServiceName: getCommercialServiceName(service.name),
      externalPaymentId: String(payment.id),
      referredByCode: referredBy || undefined,
      creditsUsed: 0,
      pixAmount: orderAmount
    }
  );

  await syncPurchase(ctx, {
    ...purchase,
    orderId,
    pixPaymentId: String(payment.id),
    step: 'confirm'
  });

  await ctx.reply(`🧾 Pedido #${orderId} reservado.\n\n🖼️ Escaneie o QR Code abaixo. O codigo Pix copia e cola vai logo em seguida.`);
  if (payment.qrCodeBase64) {
    const buffer = Buffer.from(payment.qrCodeBase64, 'base64');
    await ctx.replyWithPhoto({ source: buffer }, { caption: `QR Code do pedido #${orderId}` });
  }

  if (payment.qrCode) {
    await ctx.reply(payment.qrCode);
    await ctx.reply(
      [
        '📋 COPIE ESTE PIX E COLE NO SEU APP DE PAGAMENTOS.',
        '',
        '🚀 APOS A CONFIRMACAO, SEU PEDIDO SERA INICIADO AUTOMATICAMENTE.'
      ].join('\n')
    );
  }

  let isPolling = false;
  const pollInterval = setInterval(async () => {
    if (isPolling) return;

    isPolling = true;
    try {
      const status = await getPaymentStatus(payment.id);
      if (status === 'approved' || status === 'paid') {
        clearInterval(pollInterval);
        const markedPaid = await markOrderPaid(orderId);
        if (!markedPaid) return;

        await processOrderCommission(orderId);
        await ctx.reply(`✅ Pagamento do pedido #${orderId} confirmado. Iniciando agora...`);
        await finalizeSupplierSubmission(ctx, orderId, service, orderLink, orderQuantity);
        await finalizePurchaseSession(ctx, 'converted', orderId);
      } else if (status === 'cancelled' || status === 'rejected') {
        clearInterval(pollInterval);
        await updateOrderStatus(orderId, 'cancelled');
        await syncPurchase(ctx, {
          ...purchase,
          orderId: undefined,
          pixPaymentId: undefined,
          step: 'confirm'
        });
        await ctx.reply(`⚠️ O Pix do pedido #${orderId} foi cancelado ou expirou.`);
        await presentCheckoutOptions(ctx, service, {
          ...purchase,
          orderId: undefined,
          pixPaymentId: undefined,
          step: 'confirm'
        });
      }
    } finally {
      isPolling = false;
    }
  }, 7000);

  setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);
}

async function resumeCart(ctx: MyContext): Promise<void> {
  const senderId = ctx.from?.id;
  if (!senderId) {
    return;
  }

  const cart = await getCheckoutCartByTelegramId(senderId);
  if (!cart || cart.status !== 'active') {
    await ctx.reply('🛒 Nao encontrei um carrinho ativo para retomar.', mainMenu());
    return;
  }

  const purchase = getPurchaseFromCart(cart);
  await markCheckoutCartRecovered(senderId);
  await syncPurchase(ctx, purchase);

  if (!purchase.platform) {
    await ctx.reply(getGuidedPlatformPrompt(), guidedPlatformsInline());
    return;
  }

  if (!purchase.type) {
    await ctx.reply(getPlatformTypePrompt(purchase.platform), guidedTypesInline(purchase.platform));
    return;
  }

  const variantStep = getVariantStep(purchase.platform, purchase.type);
  if (variantStep.kind !== 'none' && !purchase.origin) {
    await ctx.reply(
      getVariantPrompt(purchase.platform, purchase.type),
      guidedSimpleOptionsInline('gorigin', variantStep.options, 'guided_back_type')
    );
    return;
  }

  if (!purchase.refillMode) {
    await continueGuidedPurchaseFlow(ctx, purchase, false);
    return;
  }

  if (!purchase.serviceId || !purchase.quantity || !purchase.amount) {
    await openPackageStep(ctx, purchase, purchase.refillMode, false);
    return;
  }

  const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
  if (!service) {
    await finalizePurchaseSession(ctx, 'cancelled');
    await ctx.reply('⚠️ A oferta salva no carrinho nao esta mais disponivel. Escolha outra pelo menu.', mainMenu());
    return;
  }

  if (!purchase.link) {
    await showSelectedPackageSummary(ctx, service, purchase, false);
    return;
  }

  await presentCheckoutOptions(ctx, service, purchase);
}

async function openUpsellFlow(ctx: MyContext, type: InstagramServiceType): Promise<void> {
  const purchase: PurchaseSession = {
    platform: 'Instagram',
    type
  };
  const variantStep = getVariantStep('Instagram', type);

  await syncPurchase(ctx, purchase);
  if (variantStep.kind === 'none') {
    await continueGuidedPurchaseFlow(ctx, purchase, false);
    return;
  }

  await ctx.reply(
    `✨ Abrindo ofertas de ${type}. Primeiro escolha ${variantStep.kind === 'origin' ? 'a origem' : 'o subtipo'} para receber recomendacoes mais precisas.`,
    guidedSimpleOptionsInline('gorigin', variantStep.options, 'guided_back_type')
  );
}

export function registerBotHandlers(bot: Telegraf<MyContext>) {
  bot.use(session());
  bot.use((ctx, next) => {
    ctx.session ??= {};
    const now = Date.now();
    if (ctx.session.lastActiveAt && now - ctx.session.lastActiveAt > SESSION_TIMEOUT_MS) {
      ctx.session.purchase = undefined;
      ctx.session.support = undefined;
      ctx.session.orderCare = undefined;
    }
    ctx.session.lastActiveAt = now;
    return next();
  });

  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ').trim() || 'Sem nome';
    const username = ctx.from.username;
    const referredByCode = parseStartPayload(ctx.message.text);

    await upsertUser(telegramId, username, fullName);
    const leadCapture = await captureLead(telegramId, username, fullName, referredByCode);
    if (leadCapture.shouldNotifyAffiliate) {
      await notifyAffiliateLeadStart(ctx, referredByCode, {
        telegramId,
        username,
        fullName
      });
    }

    ctx.session.purchase = undefined;
    ctx.session.support = undefined;
    ctx.session.orderCare = undefined;
    await ctx.reply(getWelcomeMessage(), mainMenu());
    await ctx.reply(getBotGuideMessage());
  });

  bot.command('menu', async (ctx) => {
    ctx.session.purchase = undefined;
    ctx.session.support = undefined;
    ctx.session.orderCare = undefined;
    await ctx.reply('🏠 Menu principal liberado novamente.', mainMenu());
  });

  bot.hears(['Servicos', 'Serviços', 'Comprar servicos', 'SERVICOS', 'SERVIÇOS', '🛒 SERVICOS', '🛒 SERVIÇOS', 'Comprar agora'], async (ctx) => {
    resetSupportSession(ctx);
    resetOrderCareSession(ctx);
    await syncPurchase(ctx, {});
    await ctx.reply(getGuidedPlatformPrompt(), guidedPlatformsInline());
  });

  bot.hears(['Como funciona', '✨ Como funciona'], async (ctx) => {
    resetSupportSession(ctx);
    resetOrderCareSession(ctx);
    await ctx.reply(getHowItWorksMessage(), mainMenu());
  });

  bot.hears(['Saldo', 'SALDO', '💰 SALDO', 'Recarregar', 'RECARREGAR', 'Recarregar saldo', 'RECARREGAR SALDO', '💳 RECARREGAR', '💳 RECARREGAR SALDO'], async (ctx) => {
    resetSupportSession(ctx);
    resetOrderCareSession(ctx);
    await openWalletHome(ctx);
  });

  bot.hears(['Meu saldo', 'MEU SALDO', '💰 MEU SALDO'], async (ctx) => {
    resetSupportSession(ctx);
    resetOrderCareSession(ctx);
    await openWalletHome(ctx);
  });

  bot.hears(['Meu painel de afiliado', 'Indique e ganhe', 'INDIQUE E GANHE', '🤝 INDIQUE E GANHE'], async (ctx) => {
    resetSupportSession(ctx);
    resetOrderCareSession(ctx);
    const senderId = ctx.from?.id;
    if (!senderId) return;

    const panel = await getAffiliatePanel(senderId);
    await ctx.reply(panel, mainMenu());
  });

  bot.hears(['Perfil', 'PERFIL', '👤 PERFIL'], async (ctx) => {
    resetSupportSession(ctx);
    resetOrderCareSession(ctx);
    await openProfileHome(ctx);
  });

  bot.hears(['Meus pedidos', 'MEUS PEDIDOS', '📦 MEUS PEDIDOS'], async (ctx) => {
    resetSupportSession(ctx);
    resetOrderCareSession(ctx);
    await sendRecentOrders(ctx);
  });

  bot.hears(['Suporte', 'SUPORTE', '🆘 SUPORTE'], async (ctx) => {
    resetOrderCareSession(ctx);
    await openSupportHome(ctx);
  });

  bot.hears(['Refil', 'REFIL', '🔄 REFIL'], async (ctx) => {
    await openOrderCareEntry(ctx, 'refill');
  });

  bot.hears(['Cancelar', '❌ Cancelar'], async (ctx) => {
    await openOrderCareEntry(ctx, 'cancel');
  });

  bot.hears(['Status', 'STATUS', '📊 STATUS'], async (ctx) => {
    await openOrderCareEntry(ctx, 'status');
  });

  bot.command('tickets', async (ctx) => {
    if (!isSupportTeamContext(ctx)) {
      return;
    }

    const tickets = await listSupportTicketsForTeam(10);
    if (!tickets.length) {
      await ctx.reply('📭 Nenhum ticket encontrado no momento.');
      return;
    }

    for (const ticket of tickets) {
      await ctx.reply(
        getSupportAdminNotificationMessage(ticket, ticket.last_message_preview ?? ''),
        supportAdminTicketInline(ticket.id, ticket.status === 'closed')
      );
    }
  });

  bot.command('chatid', async (ctx) => {
    const chatId = String(ctx.chat?.id ?? '');
    if (!chatId) {
      return;
    }

    const title = 'title' in (ctx.chat ?? {}) ? (ctx.chat as { title?: string }).title : undefined;
    await ctx.reply(
      getSupportGroupSetupMessage(chatId, {
        title,
        isConfigured: chatId === env.supportChatId
      })
    );
  });

  bot.command('reply', async (ctx) => {
    if (!isSupportTeamContext(ctx)) {
      return;
    }

    const rawText = ('text' in ctx.message ? ctx.message.text : '').trim();
    const parsed = rawText.replace(/^\/reply(@[A-Za-z0-9_]+)?\s*/i, '');
    const match = parsed.match(/^(\d+)\s+([\s\S]+)$/);

    if (!match) {
      await ctx.reply(getSupportReplyUsageMessage());
      return;
    }

    const ticketId = Number(match[1]);
    const reply = match[2].trim();
    if (!ticketId || reply.length < 2) {
      await ctx.reply(getSupportReplyUsageMessage());
      return;
    }

    await replyToSupportTicket(bot, ctx, ticketId, reply);
  });

  bot.command('close', async (ctx) => {
    if (!isSupportTeamContext(ctx)) {
      return;
    }

    const rawText = ('text' in ctx.message ? ctx.message.text : '').trim();
    const parsed = rawText.replace(/^\/close(@[A-Za-z0-9_]+)?\s*/i, '');
    const ticketId = Number(parsed);

    if (!ticketId) {
      await ctx.reply(getSupportCloseUsageMessage());
      return;
    }

    await closeSupportTicketFromTeam(bot, ctx, ticketId);
  });

  bot.action('guided_home', async (ctx) => {
    await syncPurchase(ctx, {});
    await ctx.editMessageText(getGuidedPlatformPrompt(), guidedPlatformsInline());
    await ctx.answerCbQuery();
  });

  bot.action('support_home', async (ctx) => {
    await ctx.answerCbQuery();
    await openSupportHome(ctx, true);
  });

  bot.action('support_contact', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(getSupportMessage(env.supportContact), mainMenu());
  });

  bot.action('support_open', async (ctx) => {
    resetSupportSession(ctx);
    await ctx.answerCbQuery();
    await ctx.editMessageText(getSupportCategoryPrompt(), supportCategoriesInline());
  });

  bot.action(/support_category:(.+)/, async (ctx) => {
    const category = ctx.match[1];
    const senderId = ctx.from?.id;
    if (!senderId) {
      await ctx.answerCbQuery('Nao consegui identificar seu usuario.');
      return;
    }

    const recentOrders = await listRecentOrders(senderId);
    if (recentOrders.length) {
      ctx.session.support = {
        mode: 'awaiting_description',
        category
      };
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        getSupportOrderPrompt(category),
        supportOrderSelectionInline(recentOrders.slice(0, 5).map((order) => ({ id: order.id })))
      );
      return;
    }

    ctx.session.support = {
      mode: 'awaiting_description',
      category
    };
    await ctx.answerCbQuery();
    await ctx.editMessageText(getSupportDescriptionPrompt(category), supportAbortInline());
  });

  bot.action(/support_order:(.+)/, async (ctx) => {
    const support = ctx.session.support;
    if (!support?.category) {
      await ctx.answerCbQuery('Reinicie o suporte.');
      return;
    }

    const rawOrder = ctx.match[1];
    const orderId = rawOrder === 'none' ? undefined : Number(rawOrder);

    ctx.session.support = {
      mode: 'awaiting_description',
      category: support.category,
      orderId
    };

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      getSupportDescriptionPrompt(support.category, orderId),
      supportAbortInline()
    );
  });

  bot.action('support_my_tickets', async (ctx) => {
    const senderId = ctx.from?.id;
    if (!senderId) {
      await ctx.answerCbQuery('Nao consegui identificar seu usuario.');
      return;
    }

    const tickets = await listUserSupportTickets(senderId);
    if (!tickets.length) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        '📭 Voce ainda nao possui tickets abertos ou recentes.',
        supportHubInline({ hasContact: Boolean(env.supportContact) })
      );
      return;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      getSupportTicketsListMessage(tickets),
      supportTicketsInline(tickets.map((ticket) => ({
        id: ticket.id,
        status: ticket.status
      })))
    );
  });

  bot.action(/support_view:(\d+)/, async (ctx) => {
    const senderId = ctx.from?.id;
    if (!senderId) {
      await ctx.answerCbQuery('Nao consegui identificar seu usuario.');
      return;
    }

    const ticketId = Number(ctx.match[1]);
    const ticket = await getSupportTicketForUser(senderId, ticketId);
    if (!ticket) {
      await ctx.answerCbQuery('Ticket nao encontrado.');
      return;
    }

    await ctx.answerCbQuery();
    await sendSupportTicketDetailToUser(ctx, ticket, true);
  });

  bot.action(/support_reply:(\d+)/, async (ctx) => {
    const senderId = ctx.from?.id;
    if (!senderId) {
      await ctx.answerCbQuery('Nao consegui identificar seu usuario.');
      return;
    }

    const ticketId = Number(ctx.match[1]);
    const ticket = await getSupportTicketForUser(senderId, ticketId);
    if (!ticket || ticket.status === 'closed') {
      await ctx.answerCbQuery('Esse ticket nao pode mais receber mensagens.');
      return;
    }

    ctx.session.support = {
      mode: 'awaiting_user_reply',
      ticketId
    };

    await ctx.answerCbQuery();
    await ctx.reply(getSupportReplyPrompt(ticket), supportAbortInline());
  });

  bot.action(/support_admin_reply:(\d+)/, async (ctx) => {
    if (!isSupportTeamContext(ctx)) {
      await ctx.answerCbQuery('Acao restrita ao suporte.');
      return;
    }

    const ticketId = Number(ctx.match[1]);
    const ticket = await getSupportTicketById(ticketId);
    if (!ticket || ticket.status === 'closed') {
      await ctx.answerCbQuery('Ticket indisponivel.');
      return;
    }

    ctx.session.support = {
      mode: 'awaiting_admin_reply',
      ticketId,
      customerTelegramId: ticket.telegram_id
    };

    await ctx.answerCbQuery();
    await ctx.reply(getSupportAdminReplyPrompt(ticket), {
      reply_markup: {
        force_reply: true,
        selective: true
      }
    });
  });

  bot.action(/support_admin_close:(\d+)/, async (ctx) => {
    if (!isSupportTeamContext(ctx)) {
      await ctx.answerCbQuery('Acao restrita ao suporte.');
      return;
    }

    const ticketId = Number(ctx.match[1]);
    const ticket = await getSupportTicketById(ticketId);
    if (!ticket) {
      await ctx.answerCbQuery('Ticket nao encontrado.');
      return;
    }

    await closeSupportTicket(ticketId, ctx.from?.id);
    await notifyCustomerReply(bot, ticketId, ticket.telegram_id, '', true);
    await ctx.answerCbQuery('Ticket encerrado.');
    await ctx.reply(getSupportAdminTicketClosedMessage(ticketId));
  });

  bot.action(/care_start:(status|refill|cancel)/, async (ctx) => {
    const action = ctx.match[1] as OrderCareAction;
    await ctx.answerCbQuery();
    await openOrderCareEntry(ctx, action, true);
  });

  bot.action(/care_manual:(status|refill|cancel)/, async (ctx) => {
    const action = ctx.match[1] as OrderCareAction;
    resetSupportSession(ctx);
    ctx.session.purchase = undefined;
    ctx.session.orderCare = {
      action,
      step: 'awaiting_order_id'
    };
    await ctx.answerCbQuery();
    await ctx.reply(getOrderCareManualPrompt(action), orderCarePromptInline(action));
  });

  bot.action(/care_pick:(status|refill|cancel):(\d+)/, async (ctx) => {
    const action = ctx.match[1] as OrderCareAction;
    const orderId = Number(ctx.match[2]);
    resetSupportSession(ctx);
    resetOrderCareSession(ctx);
    ctx.session.purchase = undefined;
    await ctx.answerCbQuery();
    await handleManualOrderAction(ctx, action, orderId);
  });

  bot.action('resume_cart', async (ctx) => {
    await ctx.answerCbQuery();
    await resumeCart(ctx);
  });

  bot.action('return_main_menu', async (ctx) => {
    ctx.session.purchase = undefined;
    ctx.session.support = undefined;
    ctx.session.orderCare = undefined;
    await ctx.answerCbQuery();
    await ctx.reply('🏠 Menu principal novamente disponivel.', mainMenu());
  });

  bot.action('return_orders', async (ctx) => {
    resetOrderCareSession(ctx);
    await ctx.answerCbQuery();
    await sendRecentOrders(ctx);
  });

  bot.action(/reorder:(\d+)/, async (ctx) => {
    const senderId = ctx.from?.id;
    if (!senderId) {
      await ctx.answerCbQuery('Nao consegui identificar seu usuario.');
      return;
    }

    const orderId = Number(ctx.match[1]);
    const order = await getUserOrderDetails(senderId, orderId);
    if (!order || !order.service_id || !order.target_link || !order.quantity) {
      await ctx.answerCbQuery('Nao foi possivel repetir este pedido.');
      return;
    }

    const service = await getServiceById(order.service_id) as GuidedInstagramService | null;
    if (!service) {
      await ctx.answerCbQuery('A oferta original nao esta mais disponivel.');
      return;
    }

    const platform = service.catalog_platform ?? order.platform ?? 'Instagram';
    const type = inferServiceType(platform, service);
    const purchase: PurchaseSession = {
      platform,
      type,
      serviceId: order.service_id,
      baseServiceId: order.service_id,
      link: order.target_link,
      quantity: order.quantity,
      amount: Number(order.total_amount),
      step: 'confirm',
      refillUpsellAccepted: false
    };

    await syncPurchase(ctx, purchase);
    await ctx.reply(getRepeatOrderPrompt(order), checkoutCancelInline());
    await presentCheckoutOptions(ctx, service, purchase);
    await ctx.answerCbQuery();
  });

  bot.action(/upsell:(.+)/, async (ctx) => {
    const type = ctx.match[1] as InstagramServiceType;
    await ctx.answerCbQuery();
    await openUpsellFlow(ctx, type);
  });

  bot.action(/gplat:(.+)/, async (ctx) => {
    const platform = ctx.match[1];
    await syncPurchase(ctx, { platform });
    await ctx.editMessageText(getPlatformTypePrompt(platform), guidedTypesInline(platform));
    await ctx.answerCbQuery();
  });

  bot.action(/gtype:(.+)/, async (ctx) => {
    const type = ctx.match[1];
    const purchase = ctx.session.purchase;
    if (!purchase?.platform) {
      await ctx.answerCbQuery('Reinicie a escolha do servico.');
      return;
    }

    const nextPurchase: PurchaseSession = {
      ...purchase,
      type,
      origin: undefined,
      refillMode: undefined,
      serviceId: undefined,
      baseServiceId: undefined,
      quantity: undefined,
      amount: undefined,
      link: undefined,
      orderId: undefined,
      pixPaymentId: undefined,
      refillUpsellServiceId: undefined,
      refillUpsellExtra: undefined,
      refillUpsellAccepted: undefined
    };
    await syncPurchase(ctx, nextPurchase);

    const variantStep = getVariantStep(nextPurchase.platform!, type);
    if (variantStep.kind === 'none') {
      await continueGuidedPurchaseFlow(ctx, nextPurchase);
      await ctx.answerCbQuery();
      return;
    }

    await ctx.editMessageText(
      getVariantPrompt(nextPurchase.platform!, type),
      guidedSimpleOptionsInline('gorigin', variantStep.options, 'guided_back_type')
    );
    await ctx.answerCbQuery();
  });

  bot.action('guided_back_type', async (ctx) => {
    const purchase = ctx.session.purchase;
    if (!purchase?.platform) {
      await ctx.answerCbQuery('Reinicie a escolha do servico.');
      return;
    }

    await ctx.editMessageText(getPlatformTypePrompt(purchase.platform), guidedTypesInline(purchase.platform));
    await ctx.answerCbQuery();
  });

  bot.action(/gorigin:(.+)/, async (ctx) => {
    const origin = ctx.match[1];
    const purchase = ctx.session.purchase;
    if (!purchase?.platform || !purchase.type) {
      await ctx.answerCbQuery('Reinicie a escolha do servico.');
      return;
    }

    const nextPurchase: PurchaseSession = {
      ...purchase,
      origin,
      refillMode: undefined,
      serviceId: undefined,
      baseServiceId: undefined,
      quantity: undefined,
      amount: undefined,
      link: undefined,
      orderId: undefined,
      pixPaymentId: undefined,
      refillUpsellServiceId: undefined,
      refillUpsellExtra: undefined,
      refillUpsellAccepted: undefined
    };
    await syncPurchase(ctx, nextPurchase);

    await continueGuidedPurchaseFlow(ctx, nextPurchase);
    await ctx.answerCbQuery();
  });

  bot.action('guided_back_variant', async (ctx) => {
    const purchase = ctx.session.purchase;
    if (!purchase?.platform || !purchase.type) {
      await ctx.answerCbQuery('Reinicie a escolha do servico.');
      return;
    }

    const variantStep = getVariantStep(purchase.platform, purchase.type);
    if (variantStep.kind === 'none') {
      await ctx.editMessageText(
        getPlatformTypePrompt(purchase.platform),
        guidedTypesInline(purchase.platform)
      );
      await ctx.answerCbQuery();
      return;
    }

    await ctx.editMessageText(
      getVariantPrompt(purchase.platform, purchase.type),
      guidedSimpleOptionsInline('gorigin', variantStep.options, 'guided_back_type')
    );
    await ctx.answerCbQuery();
  });

  bot.action('refill_upsell_accept', async (ctx) => {
    const purchase = ctx.session.purchase;
    if (!purchase?.serviceId || !purchase.refillUpsellServiceId || !purchase.refillUpsellExtra) {
      await ctx.answerCbQuery('Nao encontrei essa protecao agora.');
      return;
    }

    const refillService = await getServiceById(purchase.refillUpsellServiceId) as GuidedInstagramService | null;
    if (!refillService) {
      await ctx.answerCbQuery('Oferta com reposicao indisponivel agora.');
      return;
    }

    const nextPurchase: PurchaseSession = {
      ...purchase,
      baseServiceId: purchase.baseServiceId ?? purchase.serviceId,
      serviceId: purchase.refillUpsellServiceId,
      amount: Number(((purchase.amount ?? 0) + purchase.refillUpsellExtra).toFixed(2)),
      refillMode: 'with_refill',
      refillUpsellAccepted: true
    };

    await ctx.answerCbQuery('Reposicao adicionada.');
    await presentCheckoutOptions(ctx, refillService, nextPurchase);
  });

  bot.action('refill_upsell_skip', async (ctx) => {
    const purchase = ctx.session.purchase;
    if (!purchase?.serviceId) {
      await ctx.answerCbQuery('Reinicie a compra.');
      return;
    }

    const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
    if (!service) {
      await ctx.answerCbQuery('Servico nao encontrado.');
      return;
    }

    const nextPurchase: PurchaseSession = {
      ...purchase,
      refillUpsellAccepted: false
    };

    await ctx.answerCbQuery();
    await presentCheckoutOptions(ctx, service, nextPurchase);
  });

  bot.action(/topup:(\d+)/, async (ctx) => {
    const amount = Number(ctx.match[1]);
    await ctx.answerCbQuery();
    await sendTopupPix(ctx, amount);
  });

  bot.action('suggest_topup_for_order', async (ctx) => {
    await ctx.answerCbQuery();
    await sendTopupSuggestion(ctx);
  });

  bot.action('cancel_checkout', async (ctx) => {
    const purchase = ctx.session.purchase;
    if (purchase?.orderId) {
      const order = await getOrderById(purchase.orderId);
      if (order?.status === 'pending') {
        await updateOrderStatus(purchase.orderId, 'cancelled');
      }
    }

    await finalizePurchaseSession(ctx, 'cancelled');
    await ctx.answerCbQuery('Fluxo cancelado.');
    await ctx.reply('❌ Operacao cancelada. Quando quiser, voce pode iniciar novamente pelo menu principal.', mainMenu());
  });

  bot.action(/gpack:(\d+):(\d+)/, async (ctx) => {
    const purchase = ctx.session.purchase;
    if (!purchase?.serviceId || !purchase.platform || !purchase.type) {
      await ctx.answerCbQuery('Reinicie o fluxo da compra.');
      return;
    }

    const quantity = Number(ctx.match[1]);
    const amount = Number(ctx.match[2]) / 100;
    const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
    if (!service) {
      await finalizePurchaseSession(ctx, 'cancelled');
      await ctx.answerCbQuery('Servico nao encontrado.');
      return;
    }

    const nextPurchase = {
      ...purchase,
      baseServiceId: purchase.serviceId,
      quantity,
      amount,
      step: undefined,
      orderId: undefined,
      pixPaymentId: undefined,
      refillUpsellServiceId: undefined,
      refillUpsellExtra: undefined,
      refillUpsellAccepted: undefined
    };

    await syncPurchase(ctx, nextPurchase);
    await showSelectedPackageSummary(ctx, service, nextPurchase);
    await ctx.answerCbQuery();
  });

  bot.action('guided_back_package', async (ctx) => {
    const purchase = ctx.session.purchase;
    if (!purchase?.platform || !purchase.type) {
      await ctx.answerCbQuery('Reinicie a escolha do pacote.');
      return;
    }
    await ctx.answerCbQuery();
    await openPackageStep(
      ctx,
      purchase,
      'without_refill',
      true,
      getVariantStep(purchase.platform, purchase.type).kind === 'none'
        ? 'guided_back_type'
        : 'guided_back_variant'
    );
  });

  bot.action('guided_instructions', async (ctx) => {
    const purchase = ctx.session.purchase;
    if (!purchase?.serviceId || !purchase.platform || !purchase.type) {
      await ctx.answerCbQuery('Reinicie a compra.');
      return;
    }

    const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
    if (!service) {
      await finalizePurchaseSession(ctx, 'cancelled');
      await ctx.answerCbQuery('Servico nao encontrado.');
      return;
    }

    if (!purchase.link) {
      await syncPurchase(ctx, {
        ...purchase,
        step: 'link'
      });

      await ctx.answerCbQuery();
      await ctx.reply(
        getCheckoutLinkPrompt(service, {
          platform: purchase.platform,
          type: purchase.type
        }),
        checkoutCancelInline()
      );
      return;
    }

    await ctx.answerCbQuery();
    await presentCheckoutOptions(ctx, service, purchase);
  });

  bot.action('guided_request_link', async (ctx) => {
    const purchase = ctx.session.purchase;
    if (!purchase?.serviceId || !purchase.platform || !purchase.type) {
      await ctx.answerCbQuery('Reinicie a compra.');
      return;
    }

    const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
    if (!service) {
      await finalizePurchaseSession(ctx, 'cancelled');
      await ctx.answerCbQuery('Servico nao encontrado.');
      return;
    }

    await syncPurchase(ctx, {
      ...purchase,
      step: 'link'
    });

    await ctx.answerCbQuery();
    await ctx.reply(
      getCheckoutLinkPrompt(service, {
        platform: purchase.platform,
        type: purchase.type
      }),
      checkoutCancelInline()
    );
  });

  bot.action('confirm_balance_purchase', async (ctx) => {
    const purchase = ctx.session.purchase;
    const senderId = ctx.from?.id;
    if (!purchase?.serviceId || !purchase.link || !purchase.quantity || !purchase.amount) {
      await ctx.answerCbQuery('Nao foi possivel confirmar essa compra.');
      return;
    }

    if (!senderId) {
      await ctx.answerCbQuery('Nao foi possivel identificar o usuario.');
      return;
    }

    const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
    if (!service) {
      await finalizePurchaseSession(ctx, 'cancelled');
      await ctx.answerCbQuery('Servico nao encontrado.');
      return;
    }

    const debited = await debitUserWallet(
      senderId,
      purchase.amount,
      'order',
      String(purchase.serviceId),
      `Compra do servico ${getCommercialServiceName(service.name)}`
    );

    if (!debited) {
      await ctx.answerCbQuery();
      await presentCheckoutOptions(ctx, service, purchase);
      return;
    }

    const referredBy = await getUserReferrerCode(senderId);
    const orderId = await createOrder(
      senderId,
      purchase.serviceId,
      purchase.amount,
      purchase.link,
      purchase.quantity,
      {
        displayServiceName: getCommercialServiceName(service.name),
        externalPaymentId: null,
        referredByCode: referredBy || undefined,
        creditsUsed: purchase.amount,
        pixAmount: 0
      }
    );

    await markOrderPaid(orderId);
    await processOrderCommission(orderId);

    await ctx.reply(`✅ Pedido #${orderId} confirmado com saldo. Iniciando agora...`);
    await finalizeSupplierSubmission(ctx, orderId, service, purchase.link, purchase.quantity);
    await finalizePurchaseSession(ctx, 'converted', orderId);
    await ctx.answerCbQuery();
  });

  bot.action('confirm_pix_purchase', async (ctx) => {
    await ctx.answerCbQuery();
    await sendTopupSuggestion(ctx);
  });

  bot.on('text', async (ctx, next) => {
    const senderId = ctx.from?.id;
    const supportSession = ctx.session.support;
    if (supportSession && senderId) {
      const messageText = ctx.message.text.trim();
      if (messageText.length < 6) {
        await ctx.reply('✍️ Me envie um pouco mais de contexto para eu abrir ou atualizar o atendimento.');
        return;
      }

      if (supportSession.mode === 'awaiting_description' && supportSession.category) {
        const createdTicket = await createSupportTicket({
          telegramId: senderId,
          category: supportSession.category,
          orderId: supportSession.orderId,
          messageText
        });

        resetSupportSession(ctx);
        const fullTicket = await getSupportTicketForUser(senderId, createdTicket.id);
        if (fullTicket) {
          await ctx.reply(
            getSupportTicketCreatedMessage(fullTicket),
            supportTicketDetailInline(fullTicket.id, false)
          );
          await notifySupportTeam(bot, fullTicket, messageText);
          return;
        }

        await ctx.reply(`✅ Ticket #${createdTicket.id} aberto com sucesso.`, mainMenu());
        return;
      }

      if (supportSession.mode === 'awaiting_user_reply' && supportSession.ticketId) {
        const ticket = await getSupportTicketForUser(senderId, supportSession.ticketId);
        if (!ticket || ticket.status === 'closed') {
          resetSupportSession(ctx);
          await ctx.reply('⚠️ Esse ticket nao esta mais disponivel para resposta.');
          return;
        }

        await addSupportMessage({
          ticketId: ticket.id,
          senderRole: 'customer',
          telegramId: senderId,
          messageText
        });

        resetSupportSession(ctx);
        const updatedTicket = await getSupportTicketForUser(senderId, ticket.id);
        if (updatedTicket) {
          await notifySupportTeam(bot, updatedTicket, messageText);
        }
        await ctx.reply(getSupportReplyConfirmation(ticket.id), supportTicketDetailInline(ticket.id, false));
        return;
      }

      if (supportSession.mode === 'awaiting_admin_reply' && supportSession.ticketId && isSupportTeamContext(ctx)) {
        const ticket = await getSupportTicketById(supportSession.ticketId);
        if (!ticket || ticket.status === 'closed') {
          resetSupportSession(ctx);
          await ctx.reply('⚠️ Esse ticket nao esta mais disponivel para resposta.');
          return;
        }

        resetSupportSession(ctx);
        await replyToSupportTicket(bot, ctx, ticket.id, messageText);
        return;
      }
    }

    const orderCare = ctx.session.orderCare;
    if (
      isSupportTeamContext(ctx)
      && 'reply_to_message' in ctx.message
      && ctx.message.reply_to_message
      && !ctx.message.text.trim().startsWith('/')
    ) {
      const repliedTicketId = extractTicketIdFromSupportThreadMessage(ctx.message.reply_to_message);
      if (repliedTicketId) {
        await replyToSupportTicket(bot, ctx, repliedTicketId, ctx.message.text.trim());
        return;
      }
    }

    if (orderCare && senderId) {
      const messageText = ctx.message.text.trim();
      const orderId = Number(messageText.replace(/[^\d]/g, ''));

      if (!Number.isInteger(orderId) || orderId <= 0) {
        await ctx.reply('📦 Envie apenas o numero do pedido, sem texto extra.', orderCarePromptInline(orderCare.action));
        return;
      }

      resetOrderCareSession(ctx);
      await handleManualOrderAction(ctx, orderCare.action, orderId);
      return;
    }

    const purchase = ctx.session.purchase;
    if (!purchase?.serviceId || !purchase.step) {
      return next();
    }

    const service = await getServiceById(purchase.serviceId) as GuidedInstagramService | null;
    if (!service) {
      await finalizePurchaseSession(ctx, 'cancelled');
      await ctx.reply('🚨 Erro: servico nao encontrado.');
      return;
    }

    if (purchase.step === 'link') {
      const normalizedLink = normalizeGuidedCheckoutLink(
        purchase.platform ?? 'Instagram',
        purchase.type ?? 'Outros',
        ctx.message.text
      );
      if (!normalizedLink) {
        await ctx.reply(getInvalidLinkMessage(purchase.type, purchase.platform), checkoutCancelInline());
        return;
      }

      const nextPurchase = {
        ...purchase,
        link: normalizedLink,
        step: 'confirm' as const
      };

      await syncPurchase(ctx, nextPurchase);
      await presentCheckoutOptions(ctx, service, nextPurchase);
      return;
    }

    return next();
  });
}
