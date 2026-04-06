import { Markup } from 'telegraf';
import { getCategoryToken } from '../db/repositories.js';
import { getGuidedPlatformOptions, getTypeOptionsByPlatform } from '../utils/guidedCatalog.js';
function upperButtonLabel(label) {
    return label.toUpperCase();
}
function decorateGuidedOption(label) {
    const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const emojiMap = [
        ['instagram', '📸'],
        ['tiktok', '🎵'],
        ['facebook', '👍'],
        ['youtube', '▶️'],
        ['telegram', '📣'],
        ['whatsapp', '💬'],
        ['outros', '🌐'],
        ['seguidores', '👥'],
        ['inscritos', '👥'],
        ['membros', '👤'],
        ['curtidas + seguidores', '🚀'],
        ['curtidas', '❤️'],
        ['visualizacoes', '👀'],
        ['comentarios', '💬'],
        ['metricas', '📊'],
        ['reacoes', '😍'],
        ['brasileiro', '🇧🇷'],
        ['brasileira', '🇧🇷'],
        ['internacional', '🌍'],
        ['misto', '🌎'],
        ['mista', '🌎'],
        ['reels', '🎬'],
        ['stories', '📲'],
        ['videos', '🎥'],
        ['lives', '📡'],
        ['shorts', '⚡'],
        ['posts', '📝'],
        ['perfil', '👤'],
        ['canal', '📺'],
        ['salvamentos', '🔖'],
        ['compartilhamentos', '📤'],
        ['impressoes', '📈'],
        ['alcance', '📡'],
        ['visitas', '🚪'],
        ['aleatorio', '🎲'],
        ['curtir', '👍'],
        ['coracao', '❤️'],
        ['risada', '😂'],
        ['surpreso', '😲'],
        ['triste', '😥'],
        ['oracao', '🙏']
    ];
    const match = emojiMap.find(([token]) => normalized.includes(token));
    return match ? `${match[1]} ${label}` : label;
}
export function mainMenu() {
    return Markup.keyboard([
        ['🛒 SERVIÇOS', '💰 SALDO'],
        ['🤝 INDIQUE E GANHE', '👤 PERFIL']
    ]).resize();
}
export function storeMainMenu() {
    return mainMenu();
}
export function platformsInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('INSTAGRAM', 'plat:Instagram'), Markup.button.callback('TIKTOK', 'plat:TikTok')],
        [Markup.button.callback('FACEBOOK', 'plat:Facebook'), Markup.button.callback('OUTROS', 'plat:Outros')]
    ]);
}
export function guidedPlatformsInline() {
    const options = getGuidedPlatformOptions();
    const rows = [];
    for (let index = 0; index < options.length; index += 2) {
        rows.push(options
            .slice(index, index + 2)
            .map((option) => Markup.button.callback(upperButtonLabel(decorateGuidedOption(option.label)), `gplat:${option.value}`)));
    }
    return Markup.inlineKeyboard(rows);
}
export function guidedTypesInline(platform) {
    const options = getTypeOptionsByPlatform(platform);
    const rows = [];
    for (let index = 0; index < options.length; index += 2) {
        const pair = options.slice(index, index + 2).map((option) => (Markup.button.callback(upperButtonLabel(decorateGuidedOption(option.label)), `gtype:${option.value}`)));
        rows.push(pair);
    }
    rows.push([Markup.button.callback('⬅️ VOLTAR', 'guided_home')]);
    return Markup.inlineKeyboard(rows);
}
export function instagramTypesInline() {
    return guidedTypesInline('Instagram');
}
export function guidedSimpleOptionsInline(prefix, options, backAction) {
    const buttons = options.map((option) => [Markup.button.callback(upperButtonLabel(decorateGuidedOption(option.label)), `${prefix}:${option.value}`)]);
    buttons.push([Markup.button.callback('⬅️ VOLTAR', backAction)]);
    return Markup.inlineKeyboard(buttons);
}
export function guidedServiceOptionsInline(services, backAction) {
    const buttons = services.map((service) => [Markup.button.callback(upperButtonLabel(service.label), `gsvc:${service.id}`)]);
    buttons.push([Markup.button.callback('⬅️ VOLTAR', backAction)]);
    return Markup.inlineKeyboard(buttons);
}
export function guidedPackageOptionsInline(packages, backAction) {
    const buttons = packages.map((item) => [
        Markup.button.callback(upperButtonLabel(item.label), `gpack:${item.quantity}:${item.amountCents}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ VOLTAR', backAction)]);
    return Markup.inlineKeyboard(buttons);
}
export function guidedPaymentOptionsInline(hasEnoughBalance) {
    const buttons = [];
    if (hasEnoughBalance) {
        buttons.push([Markup.button.callback('✅ CONFIRMAR PAGAMENTO', 'confirm_balance_purchase')]);
    }
    else {
        buttons.push([Markup.button.callback('💳 RECARREGAR', 'suggest_topup_for_order')]);
    }
    buttons.push([Markup.button.callback('❌ CANCELAR COMPRA', 'cancel_checkout')]);
    return Markup.inlineKeyboard(buttons);
}
export function topupAmountsInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('R$ 10', 'topup:10'), Markup.button.callback('R$ 20', 'topup:20')],
        [Markup.button.callback('R$ 35', 'topup:35'), Markup.button.callback('R$ 50', 'topup:50')],
        [Markup.button.callback('R$ 100', 'topup:100'), Markup.button.callback('R$ 200', 'topup:200')]
    ]);
}
export function profileHubInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📦 MEUS PEDIDOS', 'return_orders'), Markup.button.callback('📊 STATUS', 'care_start:status')],
        [Markup.button.callback('🆘 SUPORTE', 'support_home')],
        [Markup.button.callback('🏠 MENU PRINCIPAL', 'return_main_menu')]
    ]);
}
export function refillUpsellInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🛡️ ADICIONAR REPOSIÇÃO', 'refill_upsell_accept')],
        [Markup.button.callback('➡️ CONTINUAR SEM', 'refill_upsell_skip')],
        [Markup.button.callback('❌ CANCELAR COMPRA', 'cancel_checkout')]
    ]);
}
export function orderCareEntryInline(action, orders) {
    const rows = orders.map((order) => {
        const serviceName = order.service_name ? ` - ${order.service_name}` : '';
        const compactServiceName = serviceName.length > 28 ? `${serviceName.slice(0, 25)}...` : serviceName;
        return [Markup.button.callback(upperButtonLabel(`📦 Pedido #${order.id}${compactServiceName}`), `care_pick:${action}:${order.id}`)];
    });
    rows.push([Markup.button.callback('⌨️ DIGITAR ID DO PEDIDO', `care_manual:${action}`)]);
    rows.push([Markup.button.callback('📦 VER MEUS PEDIDOS', 'return_orders')]);
    rows.push([Markup.button.callback('🏠 MENU PRINCIPAL', 'return_main_menu')]);
    return Markup.inlineKeyboard(rows);
}
export function orderCarePromptInline(action) {
    return Markup.inlineKeyboard([
        [Markup.button.callback('⌨️ DIGITAR ID DO PEDIDO', `care_manual:${action}`)],
        [Markup.button.callback('🏠 MENU PRINCIPAL', 'return_main_menu')]
    ]);
}
export function orderCareResultInline(orderId, options) {
    const rows = [];
    if (options?.canRefill) {
        rows.push([Markup.button.callback('🔄 PEDIR REFIL', `care_pick:refill:${orderId}`)]);
    }
    if (options?.canCancel) {
        rows.push([Markup.button.callback('❌ TENTAR CANCELAR', `care_pick:cancel:${orderId}`)]);
    }
    rows.push([Markup.button.callback('📊 CONSULTAR STATUS DE NOVO', `care_pick:status:${orderId}`)]);
    rows.push([Markup.button.callback('📦 VER MEUS PEDIDOS', 'return_orders')]);
    rows.push([Markup.button.callback('🏠 MENU PRINCIPAL', 'return_main_menu')]);
    return Markup.inlineKeyboard(rows);
}
export function supportHubInline(options) {
    const rows = [
        [Markup.button.callback('🎫 ABRIR ATENDIMENTO', 'support_open')],
        [Markup.button.callback('📂 MEUS TICKETS', 'support_my_tickets')]
    ];
    if (options?.hasContact) {
        rows.push([Markup.button.callback('👤 VER CONTATO DO SUPORTE', 'support_contact')]);
    }
    rows.push([Markup.button.callback('🏠 MENU PRINCIPAL', 'return_main_menu')]);
    return Markup.inlineKeyboard(rows);
}
export function supportCategoriesInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📦 PEDIDO', 'support_category:pedido'), Markup.button.callback('💳 PAGAMENTO', 'support_category:pagamento')],
        [Markup.button.callback('💰 SALDO', 'support_category:saldo'), Markup.button.callback('⚙️ OUTRO ASSUNTO', 'support_category:outro')],
        [Markup.button.callback('⬅️ VOLTAR', 'support_home')]
    ]);
}
export function supportOrderSelectionInline(orders) {
    const rows = orders.map((order) => [Markup.button.callback(`📦 PEDIDO #${order.id}`, `support_order:${order.id}`)]);
    rows.push([Markup.button.callback('SEM PEDIDO', 'support_order:none')]);
    rows.push([Markup.button.callback('⬅️ VOLTAR', 'support_open')]);
    return Markup.inlineKeyboard(rows);
}
export function supportTicketsInline(tickets) {
    const rows = tickets.map((ticket) => [
        Markup.button.callback(upperButtonLabel(`🎫 #${ticket.id} • ${ticket.status}`), `support_view:${ticket.id}`)
    ]);
    rows.push([Markup.button.callback('⬅️ VOLTAR', 'support_home')]);
    return Markup.inlineKeyboard(rows);
}
export function supportTicketDetailInline(ticketId, closed) {
    const rows = [];
    if (!closed) {
        rows.push([Markup.button.callback('✍️ ENVIAR MENSAGEM', `support_reply:${ticketId}`)]);
    }
    rows.push([Markup.button.callback('📂 VOLTAR PARA TICKETS', 'support_my_tickets')]);
    rows.push([Markup.button.callback('🏠 MENU PRINCIPAL', 'return_main_menu')]);
    return Markup.inlineKeyboard(rows);
}
export function supportAdminTicketInline(ticketId, closed) {
    const rows = [];
    if (!closed) {
        rows.push([Markup.button.callback(`💬 RESPONDER #${ticketId}`, `support_admin_reply:${ticketId}`)]);
        rows.push([Markup.button.switchToCurrentChat(`⌨️ /REPLY #${ticketId}`, `/reply ${ticketId} `)]);
        rows.push([Markup.button.callback(`✅ FECHAR #${ticketId}`, `support_admin_close:${ticketId}`)]);
    }
    return Markup.inlineKeyboard(rows);
}
export function categoriesInline(categories) {
    const buttons = categories.map((category) => [
        Markup.button.callback(upperButtonLabel(category.length > 20 ? `${category.substring(0, 17)}...` : category), `cat:${getCategoryToken(category)}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ VOLTAR', 'back_to_platforms')]);
    return Markup.inlineKeyboard(buttons);
}
export function servicesInline(services, category) {
    const categoryToken = getCategoryToken(category);
    const buttons = services.map((service) => [
        Markup.button.callback(upperButtonLabel(`${service.name} - R$ ${service.final_price}`), `srv:${service.id}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ VOLTAR', `cat:${categoryToken}`)]);
    return Markup.inlineKeyboard(buttons);
}
export function serviceBuyInline(serviceId, category) {
    const categoryToken = getCategoryToken(category);
    return Markup.inlineKeyboard([
        [Markup.button.callback('🛒 COMPRAR', `buy:${serviceId}`)],
        [Markup.button.callback('⬅️ VOLTAR', `cat:${categoryToken}`)]
    ]);
}
export function checkoutCancelInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('❌ CANCELAR COMPRA', 'cancel_checkout')]
    ]);
}
export function guidedSummaryInline(linkLabel) {
    return Markup.inlineKeyboard([
        [Markup.button.callback(upperButtonLabel(linkLabel), 'guided_request_link')],
        [Markup.button.callback('❌ CANCELAR COMPRA', 'cancel_checkout')]
    ]);
}
export function guidedInstructionsInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🔗 ENVIAR LINK CORRETO', 'guided_request_link')],
        [Markup.button.callback('❌ CANCELAR COMPRA', 'cancel_checkout')]
    ]);
}
export function supportAbortInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ VOLTAR AO SUPORTE', 'support_home')]
    ]);
}
export function recentOrdersInline(orders) {
    const buttons = orders.map((order) => [Markup.button.callback(`🔁 COMPRAR NOVAMENTE #${order.id}`, `reorder:${order.id}`)]);
    return Markup.inlineKeyboard(buttons);
}
export function cartRecoveryInline() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🛒 RETOMAR COMPRA', 'resume_cart')],
        [Markup.button.callback('🏠 MENU PRINCIPAL', 'return_main_menu')]
    ]);
}
export function upsellOptionsInline(options) {
    const rows = options.map((option) => [Markup.button.callback(upperButtonLabel(option.label), `upsell:${option.token}`)]);
    rows.push([Markup.button.callback('📦 VER MEUS PEDIDOS', 'return_orders')]);
    return Markup.inlineKeyboard(rows);
}
