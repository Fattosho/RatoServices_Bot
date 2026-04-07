import { getServiceTrustSignals, inferInstagramServiceType } from '../services/offerRanking.js';
import { describePlatform, getLinkTargetLabel, getMandatoryInstructions, getTypeDisplayLabel, getVariantLabel } from '../utils/guidedCatalog.js';
function normalizeText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function isFollowersService(text) {
    const normalized = normalizeText(text);
    return normalized.includes('seguidores') || normalized.includes('followers');
}
function isLikesService(text) {
    const normalized = normalizeText(text);
    return normalized.includes('curtidas') || normalized.includes('likes');
}
function isInstagramService(text) {
    const normalized = normalizeText(text);
    return normalized.includes('instagram') || normalized.includes(' ig ') || normalized.startsWith('ig');
}
function getNumeric(value, fallback = 0) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed))
            return parsed;
    }
    return fallback;
}
function formatQuantity(value) {
    if (value >= 1000000) {
        return `${(value / 1000000).toString().replace('.0', '')}M`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toString().replace('.0', '')}K`;
    }
    return String(value);
}
function getCommercialQuantityNoun(type, platform) {
    if (platform === 'YouTube' && type === 'Seguidores')
        return 'inscritos';
    if (type === 'Seguidores')
        return 'seguidores';
    if (type === 'Membros')
        return 'membros';
    if (type === 'Curtidas')
        return 'curtidas';
    if (type === 'Curtidas + Seguidores')
        return 'curtidas + seguidores';
    if (type === 'Reacoes')
        return 'reacoes';
    if (type === 'Visualizacoes')
        return 'visualizacoes';
    if (type === 'Comentarios')
        return 'comentarios';
    if (type === 'Metricas')
        return 'metricas';
    return 'unidades';
}
function formatCommercialQuantity(value, type, platform) {
    return `${formatQuantity(value)} ${getCommercialQuantityNoun(type, platform)}`;
}
function getReadableTypeLabel(platform, type) {
    return getTypeDisplayLabel(platform, type);
}
function isFixedPackageService(service) {
    const min = getNumeric(service.raw_payload?.min, 1);
    const max = getNumeric(service.raw_payload?.max, 1);
    const serviceType = String(service.raw_payload?.type ?? '').toLowerCase();
    return serviceType === 'package' || max <= 10 || min === max;
}
function cleanCommercialName(name) {
    return name
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\(\s*queda[^)]*\)/gi, '')
        .replace(/\bS\d+\b/gi, '')
        .replace(/\bSV\s*\d+\b/gi, '')
        .replace(/\bSV\d+\b/gi, '')
        .replace(/\bMQ\b/gi, '')
        .replace(/\bMKS\b/gi, '')
        .replace(/\bSR\b/gi, 'Sem reposicao')
        .replace(/\bR(\d{2,3})\b/gi, 'Reposicao $1 dias')
        .replace(/[^\p{L}\p{N}\s|/-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
export function getCommercialServiceName(name) {
    return cleanCommercialName(name);
}
function getCommercialBadge(service) {
    const text = normalizeText(`${service.category} ${service.name}`);
    const refill = service.raw_payload?.refill ? 'Com reposicao' : 'Sem reposicao';
    if (text.includes('premium'))
        return `Premium | ${refill}`;
    if (text.includes('ultra'))
        return `Ultra | ${refill}`;
    if (text.includes('organ'))
        return `Organico | ${refill}`;
    if (text.includes('reais'))
        return `Perfis reais | ${refill}`;
    return refill;
}
function getAudienceLabel(service) {
    const text = normalizeText(`${service.category} ${service.name} ${service.description ?? ''}`);
    if (text.includes('brasileir') || text.includes(' brasil ') || text.includes(' br ')) {
        return 'Publico brasileiro';
    }
    if (text.includes('internacional') || text.includes('mundial') || text.includes('mundiais') || text.includes('global')) {
        return 'Publico internacional';
    }
    if (text.includes('misto') || text.includes('mista') || text.includes('mix')) {
        return 'Publico misto';
    }
    return 'Publico variado';
}
function getServiceHook(service) {
    const text = normalizeText(`${service.category} ${service.name} ${service.description ?? ''}`);
    if (text.includes('seguidores')) {
        return 'Boa opcao para fortalecer prova social e melhorar a percepcao do perfil.';
    }
    if (text.includes('curtidas')) {
        return 'Boa opcao para dar tracao rapida em posts, reels e conteudos em destaque.';
    }
    if (text.includes('visualiz')) {
        return 'Boa opcao para aumentar volume de views e deixar o conteudo mais movimentado.';
    }
    if (text.includes('coment')) {
        return 'Boa opcao para reforcar credibilidade e interacao nas publicacoes.';
    }
    return 'Boa opcao para melhorar a presenca do perfil com mais atividade.';
}
function getDescriptionPreview(service) {
    const raw = service.description || service.raw_payload?.description || 'Sem descricao.';
    const line = raw
        .split(/\r?\n/)
        .map((item) => item.trim())
        .find((item) => item && !item.toLowerCase().includes('leia atentamente'));
    return line || 'Sem descricao.';
}
export function getWelcomeMessage() {
    return [
        '🐭 Bem-vindo a RatoServices',
        '',
        '📱 Escolha o servico e finalize seu pedido aqui no bot.'
    ].join('\n');
}
export function getBotGuideMessage() {
    return [
        '✨ Aqui voce compra de forma simples:',
        '',
        '📱 Escolha a plataforma',
        '🧩 Filtre o tipo, origem ou subtipo',
        '💸 Defina a quantidade e o valor',
        '🔗 Envie o @ ou link correto',
        '📌 Confira as instrucoes',
        '💰 Confirme com saldo'
    ].join('\n');
}
export function getHowItWorksMessage() {
    return [
        '🛍️ Como funciona a RatoServices',
        '',
        '📱 voce escolhe a plataforma e o tipo de servico',
        '🎯 o bot organiza origem ou subtipo',
        '💰 voce escolhe quantidade e valor',
        '🔗 envia o @ ou link',
        '📌 confere as instrucoes',
        '⚡ confirma o pagamento com saldo',
        '📦 e o pedido segue automaticamente'
    ].join('\n');
}
export function getGuidedPlatformPrompt() {
    return [
        '📱 Escolha a plataforma',
        '',
        'Selecione onde voce quer impulsionar agora.'
    ].join('\n');
}
export function getPlatformTypePrompt(platform) {
    return [
        '🧩 Escolha o tipo de servico',
        '',
        `Qual tipo de servico voce quer em ${describePlatform(platform)}?`,
        '🎯 Escolha pelo resultado que voce quer ver no perfil ou na publicacao.'
    ].join('\n');
}
export function getInstagramTypePrompt() {
    return getPlatformTypePrompt('Instagram');
}
export function getVariantPrompt(platform, type) {
    const label = getVariantLabel(platform, type);
    const typeLabel = getReadableTypeLabel(platform, type);
    return [
        label === 'Origem' ? '🌍 Escolha a origem' : '🧩 Escolha o subtipo',
        '',
        `${typeLabel} em ${describePlatform(platform)}.`,
        `Agora escolha ${label.toLowerCase()} que mais combina com essa compra.`
    ].join('\n');
}
export function getOriginPrompt(type) {
    return getVariantPrompt('Instagram', type);
}
export function getRefillPrompt(platform, type, variant) {
    const label = getVariantLabel(platform, type);
    const typeLabel = getReadableTypeLabel(platform, type);
    return [
        '♻️ Escolha a reposicao',
        '',
        [
            `${typeLabel} em ${describePlatform(platform)}`,
            variant ? `${label}: ${variant}` : null
        ].filter(Boolean).join(' | '),
        'Quer priorizar servico com reposicao ou sem reposicao?'
    ].join('\n');
}
export function getGuidedServiceCatalogMessage(type, origin, refillLabel, rankedOffers, note) {
    const lines = rankedOffers.map((offer, index) => {
        const service = offer.service;
        const title = cleanCommercialName(service.name);
        const min = getNumeric(service.raw_payload?.min, 0);
        const minCost = Number(((Number(service.final_price) / 1000) * min).toFixed(2));
        return [
            `${index + 1}. ${title}`,
            `   ${offer.badge} | ${getCommercialBadge(service)} | ${getAudienceLabel(service)}`,
            `   Entrada sugerida: R$ ${Math.max(minCost, 5).toFixed(2)}`,
            `   ${offer.reason}`
        ].join('\n');
    });
    return [
        '🔥 Melhores opcoes para este filtro',
        '',
        `${type} - ${origin}`,
        `Filtro atual: ${refillLabel}`,
        '',
        note ?? 'Ranking baseado em custo, reposicao e sinais de qualidade da oferta.',
        '',
        ...lines
    ].join('\n');
}
export function getServicePresentation(service) {
    return [
        `🔥 ${service.name ?? 'Servico'}`,
        '',
        `📂 Categoria: ${service.category ?? 'Nao informada'}`,
        `📝 Descricao: ${service.description || 'Sem descricao.'}`,
        `💸 Preco por 1.000: R$ ${service.final_price ?? '0.00'}`,
        '',
        '🛒 Deseja comprar agora?'
    ].join('\n');
}
export function getGuidedServiceButtonLabel(service) {
    const min = getNumeric(service.raw_payload?.min, 1000);
    const minCost = Number(((Number(service.final_price) / 1000) * min).toFixed(2));
    const title = cleanCommercialName(service.name);
    const compactTitle = title.length > 26 ? `${title.slice(0, 23)}...` : title;
    return `${compactTitle} | R$ ${Math.max(minCost, 5).toFixed(2)}`;
}
export function getGuidedServiceSummary(service, selection) {
    const min = getNumeric(service.raw_payload?.min, 0);
    const max = getNumeric(service.raw_payload?.max, 0);
    const trustSignals = getServiceTrustSignals(service).map((item) => `- ${item}`).join('\n');
    const fixedPackage = isFixedPackageService(service);
    const summaryLines = selection ? [
        `Plataforma: ${selection.platform}`,
        `Tipo: ${getReadableTypeLabel(selection.platform, selection.type)}`,
        selection.variant ? `${getVariantLabel(selection.platform, selection.type)}: ${selection.variant}` : null,
        selection.quantity ? `Quantidade escolhida: ${formatCommercialQuantity(selection.quantity, selection.type, selection.platform)}` : null,
        typeof selection.amount === 'number' ? `Valor escolhido: R$ ${selection.amount.toFixed(2)}` : null
    ].filter(Boolean) : [];
    return [
        '📋 Resumo do servico',
        '',
        `${cleanCommercialName(service.name)}`,
        ...summaryLines,
        summaryLines.length ? '' : null,
        `🏷️ Perfil: ${getCommercialBadge(service)}`,
        `🌍 Publico: ${getAudienceLabel(service)}`,
        `📉 Pedido minimo: ${formatCommercialQuantity(min, selection?.type, selection?.platform ?? service.catalog_platform)}`,
        `📈 Pedido maximo: ${formatCommercialQuantity(max, selection?.type, selection?.platform ?? service.catalog_platform)}`,
        fixedPackage ? `💎 Preco deste pacote: R$ ${service.final_price}` : `💸 Preco por 1K: R$ ${service.final_price}`,
        '',
        getServiceHook(service),
        '',
        `📝 Descricao rapida: ${getDescriptionPreview(service)}`,
        '',
        '🛡️ Sinais de confianca:',
        trustSignals
    ].filter(Boolean).join('\n');
}
export function getMandatoryInstructionsMessage(service, selection) {
    const instructions = getMandatoryInstructions(selection.platform, selection.type);
    const highlightedInstructions = instructions.map((line) => `• ${line.toUpperCase()}`);
    const typeLabel = getReadableTypeLabel(selection.platform, selection.type);
    const targetLine = selection.link
        ? (selection.platform === 'Instagram' && selection.type === 'Seguidores'
            ? `👤 Perfil informado: ${selection.link.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/$/, '')}`
            : `🔗 Link informado: ${selection.link}`)
        : null;
    return [
        '📌 Instrucoes obrigatorias',
        '',
        `🛍️ Servico: ${cleanCommercialName(service.name ?? 'Servico')}`,
        `🎯 Tipo: ${typeLabel}`,
        selection.quantity ? `📦 Quantidade: ${formatCommercialQuantity(selection.quantity, selection.type, selection.platform)}` : null,
        typeof selection.amount === 'number' ? `💸 Valor total: R$ ${selection.amount.toFixed(2)}` : null,
        targetLine,
        selection.currentBalance ? `💰 Saldo atual: R$ ${selection.currentBalance}` : null,
        '',
        '━━━━━━━━━━━━━━',
        '⚠️ CONFIGURACOES OBRIGATORIAS',
        ...highlightedInstructions,
        '━━━━━━━━━━━━━━',
        '',
        typeof selection.amount === 'number'
            ? (selection.hasEnoughBalance
                ? '✅ SE ESTIVER TUDO CERTO, CONFIRME O PAGAMENTO ABAIXO.'
                : '⚠️ RECARREGUE O SALDO PARA CONFIRMAR O PAGAMENTO.')
            : `🔗 Agora envie o ${getLinkTargetLabel(selection.platform, selection.type)}.`
    ].filter(Boolean).join('\n');
}
export function getCheckoutLinkPrompt(service, selection) {
    const platform = selection?.platform ?? 'Instagram';
    const type = selection?.type ?? 'Outros';
    const baseText = `${service.name ?? ''} ${service.category ?? ''} ${service.description ?? ''}`;
    if (platform === 'Instagram' && isLikesService(baseText)) {
        return [
            '❤️ Envie o link da publicacao, reel ou video que vai receber as curtidas.',
            '',
            'Exemplo: instagram.com/p/SEU-LINK'
        ].join('\n');
    }
    if (platform === 'Instagram' && isFollowersService(baseText) && isInstagramService(baseText)) {
        return [
            '👤 Envie o @usuario ou o link completo do perfil do Instagram.',
            '',
            'Exemplo: @seuperfil',
            'Exemplo: instagram.com/NOME'
        ].join('\n');
    }
    if (platform === 'TikTok' && type === 'Seguidores') {
        return [
            '👤 Envie o @usuario ou o link completo do perfil do TikTok.',
            '',
            'Exemplo: @seuperfil',
            'Exemplo: tiktok.com/@seuperfil'
        ].join('\n');
    }
    if (platform === 'TikTok' && (type === 'Curtidas' || type === 'Visualizacoes')) {
        return [
            '🎬 Envie o link do video do TikTok.',
            '',
            'Exemplo: tiktok.com/@usuario/video/SEU-LINK',
            'Exemplo: vm.tiktok.com/SEU-LINK'
        ].join('\n');
    }
    if (platform === 'YouTube' && type === 'Seguidores') {
        return [
            '👤 Envie o link completo do canal do YouTube.',
            '',
            'Exemplo: youtube.com/@seucanal',
            'Exemplo: youtube.com/channel/SEU-CANAL'
        ].join('\n');
    }
    if (platform === 'YouTube' && type === 'Curtidas') {
        return [
            '🔗 Envie o link do video ou short do YouTube.',
            '',
            'Exemplo: youtube.com/watch?v=SEU-LINK',
            'Exemplo: youtu.be/SEU-LINK'
        ].join('\n');
    }
    if (platform === 'Facebook' && type === 'Seguidores') {
        return [
            '👤 Envie o link do perfil ou da pagina do Facebook.',
            '',
            'Exemplo: facebook.com/suapagina'
        ].join('\n');
    }
    if (platform === 'Facebook' && type === 'Curtidas + Seguidores') {
        return [
            '📄 Envie o link da pagina do Facebook.',
            '',
            'Exemplo: facebook.com/suapagina'
        ].join('\n');
    }
    if (platform === 'Telegram' && type === 'Membros') {
        return [
            '👤 Envie o @canal, @grupo ou o link completo do Telegram.',
            '',
            'Exemplo: @seucanal',
            'Exemplo: t.me/seucanal'
        ].join('\n');
    }
    if (platform === 'Telegram' && type === 'Visualizacoes') {
        return [
            '🔗 Envie o link da postagem do Telegram.',
            '',
            'Exemplo: t.me/seucanal/123'
        ].join('\n');
    }
    if (platform === 'WhatsApp' && (type === 'Seguidores' || type === 'Reacoes')) {
        return [
            '🔗 Envie o link do canal do WhatsApp.',
            '',
            'Exemplo: whatsapp.com/channel/SEU-CANAL'
        ].join('\n');
    }
    if (type === 'Seguidores' || type === 'Membros' || type === 'Curtidas + Seguidores' || isFollowersService(baseText)) {
        return [
            `👤 Envie o link completo do ${getLinkTargetLabel(platform, type)}.`,
            '',
            '🔓 Confira se o destino esta publico antes de continuar.'
        ].join('\n');
    }
    if (type === 'Curtidas') {
        return [
            `❤️ Envie o link da publicacao, post, reel ou video que vai receber as curtidas em ${describePlatform(platform)}.`,
            '',
            '✅ Envie o link direto, sem texto extra.'
        ].join('\n');
    }
    if (type === 'Visualizacoes') {
        return [
            `👀 Envie o link do conteudo que vai receber as visualizacoes em ${describePlatform(platform)}.`,
            '',
            '✅ Pode ser video, reel, post ou postagem, conforme a plataforma.'
        ].join('\n');
    }
    if (type === 'Comentarios') {
        return [
            `💬 Envie o link da publicacao ou video que vai receber os comentarios em ${describePlatform(platform)}.`,
            '',
            '✅ Envie o link direto do conteudo.'
        ].join('\n');
    }
    return [
        `🔗 Envie o link do ${getLinkTargetLabel(platform, type)} em ${describePlatform(platform)}.`,
        '',
        '✅ Confira se o link esta correto antes de continuar.'
    ].join('\n');
}
export function getInvalidLinkMessage(type, platform = 'Instagram') {
    if (type === 'Seguidores' && platform === 'Instagram') {
        return [
            '⚠️ Nao consegui validar esse perfil.',
            'Envie o @usuario ou o link completo do Instagram.',
            '',
            'Exemplo: @seuperfil',
            'Exemplo: instagram.com/seuperfil'
        ].join('\n');
    }
    return [
        '⚠️ Nao consegui validar esse link.',
        `Envie o link direto do ${getLinkTargetLabel(platform, type ?? 'Outros')}.`,
        '',
        '🔁 Tente colar o link completo, sem texto extra.'
    ].join('\n');
}
export function getPackagePrompt(service, selection, _note) {
    const fixedPackage = isFixedPackageService(service);
    const typeLabel = selection ? getReadableTypeLabel(selection.platform, selection.type) : null;
    const details = selection ? [
        `Plataforma: ${selection.platform}`,
        typeLabel ? `Tipo: ${typeLabel}` : null,
        selection.variant ? `${getVariantLabel(selection.platform, selection.type)}: ${selection.variant}` : null,
        fixedPackage ? `Preco deste pacote: R$ ${service.final_price}` : `Preco por 1K: R$ ${service.final_price}`
    ].filter(Boolean) : [];
    return [
        '💸 Escolha quantidade e valor',
        '',
        `🛍️ ${cleanCommercialName(service.name)}`,
        ...details,
        details.length ? '' : null,
        '👇 Escolha abaixo a quantidade desejada.',
        fixedPackage
            ? '📦 Esse servico ja vem em pacote fechado.'
            : null
    ].filter(Boolean).join('\n');
}
export function getBalancePurchaseSummary(service, platform, type, quantity, amount, link, currentBalance, hasEnoughBalance) {
    return getMandatoryInstructionsMessage(service, {
        platform,
        type,
        quantity,
        amount,
        link,
        currentBalance,
        hasEnoughBalance
    });
}
export function getWalletPrompt() {
    return [
        '💳 Recarregar saldo',
        '',
        'Escolha quanto deseja adicionar na carteira via Pix.',
        'Deposito inicial a partir de R$ 10.',
        '⚡ Saldo em carteira acelera compras futuras com um toque.'
    ].join('\n');
}
export function getWalletSummary(balance, _totalAdded, _totalSpent) {
    return [
        '💰 Minha carteira',
        '',
        `💵 Saldo disponivel: R$ ${balance}`
    ].join('\n');
}
export function getWalletHubMessage(balance, _totalAdded, _totalSpent) {
    return [
        '💰 SALDO DA SUA CONTA',
        '',
        `💵 SALDO DISPONIVEL: R$ ${balance}`,
        '',
        '💳 Escolha abaixo quanto deseja recarregar agora.'
    ].join('\n');
}
export function getSupportMessage(contact) {
    if (contact) {
        return [
            '🆘 Suporte',
            '',
            `Se precisar de ajuda humana, fale com: ${contact}`,
            '📌 Se possivel, envie o numero do pedido e o link usado na compra.'
        ].join('\n');
    }
    return [
        '🆘 Suporte',
        '',
        'Configure a variavel SUPPORT_CONTACT para mostrar aqui o @usuario, canal ou grupo de atendimento.',
        '📌 Depois de configurar, o contato de suporte aparecera aqui.'
    ].join('\n');
}
function formatQuantityCompact(value) {
    if (!value)
        return 'Nao informado';
    return formatQuantity(value);
}
function formatTargetPreview(platform, link) {
    if (!link)
        return 'Nao informado';
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
function formatServiceDisplayName(name) {
    if (!name)
        return 'Servico';
    return cleanCommercialName(name);
}
function getSupportCategoryLabel(category) {
    if (category === 'pedido')
        return 'Pedido';
    if (category === 'pagamento')
        return 'Pagamento';
    if (category === 'saldo')
        return 'Saldo';
    return 'Outro assunto';
}
function getSupportStatusLabel(status) {
    if (status === 'waiting_support')
        return 'aguardando suporte';
    if (status === 'waiting_customer')
        return 'aguardando voce';
    if (status === 'closed')
        return 'encerrado';
    return status;
}
function formatSupportMessageLine(message) {
    if (message.sender_role === 'support' && message.message_text.startsWith('👤 Atendente:')) {
        return `🆘 ${message.message_text}`;
    }
    const prefix = message.sender_role === 'support' ? '🆘 Suporte' : '🙋 Cliente';
    return `${prefix}: ${message.message_text}`;
}
export function getSupportHubMessage(contact) {
    return [
        '🆘 Central de suporte RatoServices',
        '',
        'Se precisar de ajuda, abra um ticket e acompanhe tudo por aqui.',
        '📌 Quanto mais claro voce for, mais rapido fica o atendimento.',
        contact ? `👤 Contato direto: ${contact}` : null
    ].filter(Boolean).join('\n');
}
export function getSupportCategoryPrompt() {
    return [
        '🎫 Abrir atendimento',
        '',
        'Escolha o assunto principal para direcionar sua solicitacao.'
    ].join('\n');
}
export function getSupportOrderPrompt(category) {
    return [
        '📦 Vincular pedido',
        '',
        `Assunto: ${getSupportCategoryLabel(category)}`,
        'Se esse atendimento estiver ligado a um pedido, selecione abaixo. Se nao estiver, toque em "Sem pedido".'
    ].join('\n');
}
export function getSupportDescriptionPrompt(category, orderId) {
    return [
        '✍️ Descreva seu atendimento',
        '',
        `Assunto: ${getSupportCategoryLabel(category)}`,
        orderId ? `Pedido vinculado: #${orderId}` : 'Pedido vinculado: nenhum',
        '',
        'Explique o problema com o maximo de clareza possivel.'
    ].join('\n');
}
export function getSupportTicketCreatedMessage(ticket) {
    return [
        `✅ Ticket #${ticket.id} aberto com sucesso`,
        '',
        `📂 Assunto: ${getSupportCategoryLabel(ticket.category)}`,
        ticket.order_id ? `📦 Pedido vinculado: #${ticket.order_id}` : null,
        '🕐 Status: aguardando suporte',
        '',
        'Assim que houver resposta, voce recebe a atualizacao aqui no bot.'
    ].filter(Boolean).join('\n');
}
export function getSupportTicketsListMessage(tickets) {
    const lines = tickets.map((ticket) => ([
        `🎫 Ticket #${ticket.id}`,
        `📂 ${getSupportCategoryLabel(ticket.category)}`,
        ticket.order_id ? `📦 Pedido #${ticket.order_id}` : null,
        `🕐 ${getSupportStatusLabel(ticket.status)}`
    ].filter(Boolean).join('\n')));
    return [
        '📂 Seus tickets',
        '',
        ...lines
    ].join('\n\n');
}
export function getSupportTicketDetailMessage(ticket, messages) {
    return [
        `🎫 Ticket #${ticket.id}`,
        '',
        `📂 Assunto: ${getSupportCategoryLabel(ticket.category)}`,
        ticket.order_id ? `📦 Pedido vinculado: #${ticket.order_id}` : null,
        ticket.service_name ? `🛍️ Servico: ${formatServiceDisplayName(ticket.service_name)}` : null,
        ticket.assigned_to_name ? `👤 Atendente: ${ticket.assigned_to_name}` : null,
        `🕐 Status: ${getSupportStatusLabel(ticket.status)}`,
        ticket.last_message_preview ? `📝 Ultima atualizacao: ${ticket.last_message_preview}` : null,
        '',
        '💬 Conversa recente:',
        ...(messages.length ? messages.map(formatSupportMessageLine) : ['Ainda sem mensagens.'])
    ].filter(Boolean).join('\n');
}
export function getSupportReplyPrompt(ticket) {
    return [
        `✍️ Responder ticket #${ticket.id}`,
        '',
        'Envie sua mensagem agora e eu anexo direto no atendimento.'
    ].join('\n');
}
export function getSupportReplyConfirmation(ticketId) {
    return [
        `✅ Sua mensagem foi enviada no ticket #${ticketId}.`,
        'Assim que o suporte responder, voce recebe aqui.'
    ].join('\n');
}
export function getSupportAdminNotificationMessage(ticket, firstMessage) {
    return [
        `🆘 Novo ticket #${ticket.id}`,
        '',
        `👤 Cliente: ${ticket.telegram_id}`,
        `📂 Assunto: ${getSupportCategoryLabel(ticket.category)}`,
        ticket.order_id ? `📦 Pedido vinculado: #${ticket.order_id}` : null,
        ticket.service_name ? `🛍️ Servico: ${formatServiceDisplayName(ticket.service_name)}` : null,
        ticket.assigned_to_name ? `👤 Em atendimento com: ${ticket.assigned_to_name}` : null,
        firstMessage ? `💬 Mensagem: ${firstMessage}` : null,
        '',
        '👇 Use os botões abaixo para responder ou encerrar este ticket.'
    ].filter(Boolean).join('\n');
}
export function getSupportAdminReplyPrompt(ticket) {
    return [
        `💬 Responder ticket #${ticket.id}`,
        '',
        `Cliente: ${ticket.telegram_id}`,
        'Responda esta mensagem agora e eu encaminho ao cliente.'
    ].join('\n');
}
export function getSupportAdminReplySentMessage(ticketId) {
    return `✅ Resposta enviada no ticket #${ticketId}.`;
}
export function getSupportAdminTicketClosedMessage(ticketId) {
    return `✅ Ticket #${ticketId} encerrado.`;
}
export function getSupportClosedForCustomerMessage(ticketId) {
    return [
        `✅ Ticket #${ticketId} encerrado pelo suporte.`,
        'Se precisar, voce pode abrir um novo atendimento a qualquer momento.'
    ].join('\n');
}
export function getSupportReplyFromTeamMessage(ticketId, reply) {
    return [
        `🆘 Resposta do suporte no ticket #${ticketId}`,
        '',
        reply
    ].join('\n');
}
export function getSupportGroupSetupMessage(chatId, options) {
    return [
        '🆘 GRUPO DE SUPORTE',
        '',
        options?.title ? `GRUPO: ${options.title}` : null,
        `CHAT ID: ${chatId}`,
        options?.isConfigured
            ? '✅ ESTE GRUPO JA ESTA CONFIGURADO COMO CENTRAL DE SUPORTE.'
            : `⚙️ COLOQUE SUPPORT_CHAT_ID=${chatId} NO .ENV E REINICIE O BOT.`,
        '',
        'COMANDOS DA EQUIPE:',
        '/tickets',
        '/disparo mensagem',
        '/reply ID mensagem',
        '/close ID'
    ].filter(Boolean).join('\n');
}
export function getSupportBroadcastUsageMessage() {
    return [
        '📣 COMO USAR O DISPARO',
        '',
        'Use assim no grupo de suporte:',
        '/disparo sua mensagem aqui',
        '',
        'Ou responda uma mensagem do grupo com:',
        '/disparo'
    ].join('\n');
}
export function getSupportBroadcastStartedMessage(totalRecipients) {
    return [
        '📣 Disparo iniciado',
        '',
        `👥 Base encontrada: ${totalRecipients} usuarios`,
        '⏳ Estou enviando a mensagem e depois te devolvo o resumo aqui no grupo.'
    ].join('\n');
}
export function getSupportBroadcastFinishedMessage(summary) {
    return [
        '✅ Disparo finalizado',
        '',
        `👤 Enviado por: ${summary.senderName}`,
        `👥 Base total: ${summary.totalRecipients}`,
        `✅ Entregues: ${summary.delivered}`,
        `🚫 Bloqueados ou indisponiveis: ${summary.blocked}`,
        `⚠️ Falhas: ${summary.failed}`
    ].join('\n');
}
export function getSupportReplyUsageMessage() {
    return [
        '💬 COMO RESPONDER UM TICKET',
        '',
        'Use assim:',
        '/reply 123 sua mensagem aqui'
    ].join('\n');
}
export function getSupportCloseUsageMessage() {
    return [
        '✅ COMO FECHAR UM TICKET',
        '',
        'Use assim:',
        '/close 123'
    ].join('\n');
}
export function getCartRecoveryMessage(cart) {
    const title = formatServiceDisplayName(cart.service_name);
    const amount = cart.amount ? `R$ ${Number(cart.amount).toFixed(2)}` : 'valor ainda em definicao';
    if (cart.stage === 'confirm' && cart.quantity && cart.amount) {
        return [
            '🛒 Seu pedido continua salvo',
            '',
            `${title}`,
            `📦 Quantidade: ${formatQuantityCompact(cart.quantity)}`,
            `💸 Valor: ${amount}`,
            '',
            '⚡ Voce parou bem perto da confirmacao. Toque abaixo para retomar do ponto em que saiu.'
        ].join('\n');
    }
    return [
        '🛍️ Sua selecao continua salva',
        '',
        `${title}`,
        cart.service_type ? `🎯 Objetivo: ${cart.service_type}` : null,
        '',
        '✨ Retome o carrinho e finalize em poucos toques.'
    ].filter(Boolean).join('\n');
}
export function getRepeatOrderPrompt(order) {
    return [
        '🔁 Comprar novamente',
        '',
        `🛍️ Servico: ${formatServiceDisplayName(order.service_name)}`,
        `🎯 Destino: ${formatTargetPreview(order.platform, order.target_link)}`,
        `📦 Quantidade anterior: ${formatQuantityCompact(order.quantity)}`,
        `💸 Valor anterior: R$ ${Number(order.total_amount).toFixed(2)}`,
        '',
        '⚡ O link e a quantidade foram carregados novamente para acelerar sua recompra.'
    ].join('\n');
}
function getOrderCareActionLabel(action) {
    if (action === 'refill')
        return 'refil';
    if (action === 'cancel')
        return 'cancelamento';
    return 'status';
}
function getManualSupplierStatusLabel(status) {
    if (status === 'completed')
        return '✅ Concluido';
    if (status === 'processing')
        return '🚚 Em andamento';
    if (status === 'pending')
        return '⏳ Pendente';
    if (status === 'partial')
        return '⚠️ Parcial';
    if (status === 'cancelled' || status === 'canceled')
        return '❌ Cancelado';
    if (status === 'failed')
        return '🚨 Falhou';
    if (status === 'submitted')
        return '📨 Em processamento';
    return `📍 ${status}`;
}
export function getOrderCareEntryMessage(action, hasOrders) {
    const actionLabel = getOrderCareActionLabel(action);
    return [
        action === 'refill' ? '🔄 Central de refil' : action === 'cancel' ? '❌ Central de cancelamento' : '📊 Consulta de status',
        '',
        hasOrders
            ? `Escolha um pedido recente ou digite o ID para consultar ${actionLabel}.`
            : `Envie o ID do pedido para consultar ${actionLabel}.`,
        '',
        '💡 Use o numero do pedido interno da RatoServices.'
    ].join('\n');
}
export function getOrderCareManualPrompt(action) {
    return [
        action === 'refill' ? '🔄 Vamos solicitar seu refil' : action === 'cancel' ? '❌ Vamos verificar o cancelamento' : '📊 Vamos consultar seu pedido',
        '',
        'Envie agora o ID do pedido.',
        '💡 Exemplo: 1234'
    ].join('\n');
}
export function getOrderCareOrderNotFoundMessage(orderId) {
    return [
        `⚠️ Nao encontrei o pedido #${orderId} na sua conta.`,
        'Confira o numero e tente novamente.'
    ].join('\n');
}
export function getOrderCareRateLimitMessage() {
    return [
        '⏳ Recebi muitas consultas em sequencia.',
        'Espere um instante e tente novamente para eu nao travar seu atendimento.'
    ].join('\n');
}
export function getManualOrderStatusMessage(order, details) {
    const lines = [
        `📦 Pedido #${order.id}`,
        '',
        `🛍️ Servico: ${formatServiceDisplayName(order.service_name)}`,
        `💸 Valor: R$ ${Number(order.total_amount).toFixed(2)}`,
        order.quantity ? `📦 Quantidade: ${formatQuantityCompact(order.quantity)}` : null,
        `💼 Status interno: ${order.status}`,
        `📍 Status atual: ${details.supplierStatusLabel}`
    ].filter(Boolean);
    if (details.supplierStatusRaw && details.supplierStatusRaw !== details.supplierStatusLabel) {
        lines.push(`🔎 Retorno bruto: ${details.supplierStatusRaw}`);
    }
    if (details.startCount) {
        lines.push(`🔢 Contagem inicial: ${details.startCount}`);
    }
    if (details.remains) {
        lines.push(`⏳ Restante informado: ${details.remains}`);
    }
    if (details.canRefill || details.canCancel) {
        lines.push('');
        if (details.canRefill) {
            lines.push('🔄 Este pedido parece elegivel para tentativa de refil.');
        }
        if (details.canCancel) {
            lines.push('❌ Este pedido ainda pode ser verificado para cancelamento.');
        }
    }
    return lines.join('\n');
}
export function getFallbackOrderStatusMessage(order) {
    return [
        `📦 Pedido #${order.id}`,
        '',
        `🛍️ Servico: ${formatServiceDisplayName(order.service_name)}`,
        `💼 Status interno: ${order.status}`,
        `📍 Ultimo status salvo: ${getManualSupplierStatusLabel(order.external_service_status || 'pending')}`,
        '',
        '👀 Nao consegui atualizar o andamento agora, mas seu pedido continua registrado no bot.'
    ].join('\n');
}
export function getRefillSuccessMessage(order, supplierMessage) {
    return [
        `✅ Refil solicitado para o pedido #${order.id}`,
        '',
        `🛍️ Servico: ${formatServiceDisplayName(order.service_name)}`,
        supplierMessage,
        '',
        '📨 Assim que houver novas atualizacoes, o bot continua acompanhando seu pedido.'
    ].join('\n');
}
export function getRefillBlockedMessage(order, reason) {
    return [
        `⚠️ Nao consegui liberar refil no pedido #${order.id}`,
        '',
        reason,
        '',
        '🆘 Se achar que isso nao faz sentido, abra o suporte com o numero do pedido.'
    ].join('\n');
}
export function getCancelSuccessMessage(order, supplierMessage) {
    return [
        `✅ Cancelamento solicitado para o pedido #${order.id}`,
        '',
        `🛍️ Servico: ${formatServiceDisplayName(order.service_name)}`,
        supplierMessage,
        '',
        '👀 O status do pedido sera atualizado por aqui assim que houver nova movimentacao.'
    ].join('\n');
}
export function getCancelBlockedMessage(order, reason) {
    return [
        `⚠️ Nao consegui cancelar o pedido #${order.id}`,
        '',
        reason
    ].join('\n');
}
export function getReadableSupplierStatusLabel(status) {
    return getManualSupplierStatusLabel(status);
}
export function getOrderStatusUpdateMessage(order, details) {
    const base = [
        `📦 Atualizacao do pedido #${order.id}`,
        '',
        `🛍️ Servico: ${formatServiceDisplayName(order.service_name)}`,
        `📍 Status atual: ${details.rawStatus}`
    ];
    if (details.startCount) {
        base.push(`🔢 Contagem inicial: ${details.startCount}`);
    }
    if (details.remains) {
        base.push(`⏳ Restante informado no acompanhamento: ${details.remains}`);
    }
    if (details.normalizedStatus === 'completed') {
        base.push('', '✅ Pedido concluido. Se quiser continuar crescendo, aproveite uma oferta complementar abaixo.');
    }
    else if (details.normalizedStatus === 'processing') {
        base.push('', '🚚 Seu pedido esta em processamento. O bot vai continuar acompanhando por voce.');
    }
    else if (details.normalizedStatus === 'partial') {
        base.push('', '⚠️ Este pedido foi marcado como parcial. Vale acompanhar antes de repetir.');
    }
    else if (details.normalizedStatus === 'cancelled' || details.normalizedStatus === 'failed') {
        base.push('', '🚨 Houve um problema neste pedido. Se precisar, use o suporte com o numero do pedido.');
    }
    else {
        base.push('', '👀 Seu pedido segue em acompanhamento automatico.');
    }
    return base.join('\n');
}
export function getUpsellMessage(service, suggestions) {
    const serviceType = inferInstagramServiceType(service);
    const lines = suggestions.map((item) => `- ${item.label}: ${item.reason}`);
    return [
        `✨ Upsell inteligente para ${serviceType}`,
        '',
        '🔥 Quem compra esse tipo de servico costuma combinar com:',
        ...lines,
        '',
        '👇 Toque em uma opcao abaixo para abrir as proximas ofertas.'
    ].join('\n');
}
