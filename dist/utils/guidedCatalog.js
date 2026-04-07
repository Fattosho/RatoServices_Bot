import { getStorePlatforms, getStoreServiceEntry, getStoreTypesByPlatform } from '../config/storeCatalog.js';
const majorPlatforms = ['Instagram', 'TikTok', 'YouTube', 'Facebook'];
export function normalizeCatalogText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function getSearchText(service) {
    return normalizeCatalogText([
        service.catalog_platform,
        service.category,
        service.name,
        service.description,
        service.raw_payload?.description
    ].filter(Boolean).join(' '));
}
function hasAny(text, terms) {
    return terms.some((term) => text.includes(normalizeCatalogText(term)));
}
function withHttps(value) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
function isAnyProfileHandle(value) {
    return /^@?[a-zA-Z0-9._-]{2,60}$/.test(value);
}
export function getGuidedPlatformOptions() {
    return getStorePlatforms().map((platform) => ({
        label: platform,
        value: platform
    }));
}
export function getCatalogPlatformsForMenu(platform) {
    if (platform === 'Outros') {
        return ['Telegram', 'WhatsApp', 'X', 'Kwai', 'Kick', 'SnackVideo', 'Google', 'Reddit'];
    }
    return [platform];
}
export function getTypeDisplayLabel(platform, type) {
    if (platform === 'YouTube' && type === 'Seguidores') {
        return 'Inscritos';
    }
    if (platform === 'Telegram' && type === 'Visualizacoes') {
        return 'Visualizacoes';
    }
    if (platform === 'WhatsApp' && type === 'Seguidores') {
        return 'Seguidores';
    }
    return type;
}
export function getTypeOptionsByPlatform(platform) {
    const storeTypes = getStoreTypesByPlatform(platform);
    if (storeTypes.length) {
        return storeTypes.map((type) => ({
            label: getTypeDisplayLabel(platform, type),
            value: type
        }));
    }
    if (platform === 'Instagram') {
        return [
            { label: 'Seguidores', value: 'Seguidores' },
            { label: 'Curtidas', value: 'Curtidas' },
            { label: 'Visualizacoes', value: 'Visualizacoes' },
            { label: 'Comentarios', value: 'Comentarios' },
            { label: 'Metricas', value: 'Metricas' },
            { label: 'Outros', value: 'Outros' }
        ];
    }
    if (platform === 'YouTube') {
        return [
            { label: 'Inscritos', value: 'Seguidores' },
            { label: 'Curtidas', value: 'Curtidas' },
            { label: 'Visualizacoes', value: 'Visualizacoes' },
            { label: 'Comentarios', value: 'Comentarios' },
            { label: 'Metricas', value: 'Metricas' },
            { label: 'Outros', value: 'Outros' }
        ];
    }
    if (platform === 'Facebook') {
        return [
            { label: 'Seguidores', value: 'Seguidores' },
            { label: 'Curtidas', value: 'Curtidas' },
            { label: 'Visualizacoes', value: 'Visualizacoes' },
            { label: 'Comentarios', value: 'Comentarios' },
            { label: 'Metricas', value: 'Metricas' },
            { label: 'Outros', value: 'Outros' }
        ];
    }
    return [
        { label: 'Seguidores', value: 'Seguidores' },
        { label: 'Curtidas', value: 'Curtidas' },
        { label: 'Visualizacoes', value: 'Visualizacoes' },
        { label: 'Comentarios', value: 'Comentarios' },
        { label: 'Metricas', value: 'Metricas' },
        { label: 'Outros', value: 'Outros' }
    ];
}
export function getVariantStep(platform, type) {
    if (platform === 'WhatsApp' && type === 'Reacoes') {
        return {
            kind: 'subtype',
            title: 'Escolha a reacao',
            options: [
                { label: 'Aleatorio', value: 'Aleatorio' },
                { label: '👍 Curtir', value: 'Curtir' },
                { label: '❤️ Coracao', value: 'Coracao' },
                { label: '😂 Risada', value: 'Risada' },
                { label: '😲 Surpreso', value: 'Surpreso' },
                { label: '😥 Triste', value: 'Triste' },
                { label: '🙏 Oracao', value: 'Oracao' }
            ]
        };
    }
    if (type === 'Seguidores' && platform === 'Instagram') {
        return {
            kind: 'origin',
            title: 'Escolha a origem',
            options: [
                { label: 'Brasileiro', value: 'Brasileiro' },
                { label: 'Internacional', value: 'Internacional' },
                { label: 'Misto', value: 'Misto' }
            ]
        };
    }
    if (type === 'Seguidores' && platform === 'TikTok') {
        return {
            kind: 'origin',
            title: 'Escolha a origem',
            options: [
                { label: 'Brasileiro', value: 'Brasileiro' },
                { label: 'Internacional', value: 'Internacional' }
            ]
        };
    }
    if (type === 'Curtidas' && platform === 'Instagram') {
        return {
            kind: 'origin',
            title: 'Escolha a origem',
            options: [
                { label: 'Brasileira', value: 'Brasileiro' },
                { label: 'Internacional', value: 'Internacional' },
                { label: 'Mista', value: 'Misto' }
            ]
        };
    }
    if (type === 'Curtidas' && platform === 'TikTok') {
        return {
            kind: 'origin',
            title: 'Escolha a origem',
            options: [
                { label: 'Brasileira', value: 'Brasileiro' },
                { label: 'Internacional', value: 'Internacional' }
            ]
        };
    }
    if (type === 'Visualizacoes') {
        if (platform === 'Instagram') {
            return {
                kind: 'subtype',
                title: 'Escolha o subtipo',
                options: [
                    { label: 'Reels', value: 'Reels' },
                    { label: 'Stories', value: 'Stories' },
                    { label: 'Lives', value: 'Lives' },
                    { label: 'Videos', value: 'Videos' },
                    { label: 'Outros', value: 'Outros' }
                ]
            };
        }
        if (platform === 'YouTube') {
            return {
                kind: 'subtype',
                title: 'Escolha o subtipo',
                options: [
                    { label: 'Shorts', value: 'Shorts' },
                    { label: 'Videos', value: 'Videos' },
                    { label: 'Lives', value: 'Lives' },
                    { label: 'Canal', value: 'Canal' },
                    { label: 'Outros', value: 'Outros' }
                ]
            };
        }
        if (platform === 'Facebook') {
            return {
                kind: 'subtype',
                title: 'Escolha o subtipo',
                options: [
                    { label: 'Reels', value: 'Reels' },
                    { label: 'Videos', value: 'Videos' },
                    { label: 'Posts', value: 'Posts' },
                    { label: 'Lives', value: 'Lives' },
                    { label: 'Outros', value: 'Outros' }
                ]
            };
        }
        return {
            kind: 'subtype',
            title: 'Escolha o subtipo',
            options: [
                { label: 'Videos', value: 'Videos' },
                { label: 'Lives', value: 'Lives' },
                { label: 'Perfil', value: 'Perfil' },
                { label: 'Outros', value: 'Outros' }
            ]
        };
    }
    if (type === 'Comentarios') {
        return {
            kind: 'subtype',
            title: 'Escolha o subtipo',
            options: [
                { label: 'Brasileiros', value: 'Brasileiros' },
                { label: 'Internacionais', value: 'Internacionais' },
                { label: 'Personalizados', value: 'Personalizados' },
                { label: 'Outros', value: 'Outros' }
            ]
        };
    }
    if (type === 'Metricas') {
        return {
            kind: 'subtype',
            title: 'Escolha o subtipo',
            options: [
                { label: 'Salvamentos', value: 'Salvamentos' },
                { label: 'Compartilhamentos', value: 'Compartilhamentos' },
                { label: 'Impressoes', value: 'Impressoes' },
                { label: 'Alcance', value: 'Alcance' },
                { label: 'Visitas', value: 'Visitas' },
                { label: 'Outros', value: 'Outros' }
            ]
        };
    }
    return {
        kind: 'none',
        title: '',
        options: []
    };
}
export function getVariantLabel(platform, type) {
    const step = getVariantStep(platform, type);
    if (step.kind === 'origin')
        return 'Origem';
    if (step.kind === 'subtype')
        return 'Subtipo';
    return 'Filtro';
}
export function getRefillOptions() {
    return [
        { label: 'Com reposicao', value: 'with_refill' },
        { label: 'Sem reposicao', value: 'without_refill' }
    ];
}
export function getRefillLabel(value) {
    if (value === 'with_refill')
        return 'Com reposicao';
    if (value === 'without_refill')
        return 'Sem reposicao';
    return 'Qualquer';
}
export function inferServiceType(platform, service) {
    if (service.external_service_id) {
        const storeEntry = getStoreServiceEntry(service.external_service_id);
        if (storeEntry?.type) {
            return storeEntry.type;
        }
    }
    const text = getSearchText(service);
    if (typeMatches(text, ['curtidas + seguidores', 'likes + followers'])) {
        return 'Curtidas + Seguidores';
    }
    if (typeMatches(text, ['reacoes em postagem', 'reacoes', 'reações'])) {
        return 'Reacoes';
    }
    if (platform === 'Telegram' && typeMatches(text, ['membros', 'members'])) {
        return 'Membros';
    }
    if (typeMatches(text, ['seguidores', 'followers', 'inscritos', 'subscribers', 'subs', 'membros'])) {
        return 'Seguidores';
    }
    if (typeMatches(text, ['curtidas', 'likes', 'reacoes', 'reacoes', 'reactions', 'likes page', 'like pagina'])) {
        return 'Curtidas';
    }
    if (typeMatches(text, ['visualiz', 'views', 'watchtime', 'watch time', 'horas', 'ao vivo'])) {
        return 'Visualizacoes';
    }
    if (typeMatches(text, ['coment', 'comments', 'avaliac', 'reviews'])) {
        return 'Comentarios';
    }
    if (typeMatches(text, ['salvamentos', 'compartilh', 'impress', 'alcance', 'visitas', 'visit', 'engajamento'])) {
        return 'Metricas';
    }
    if (platform === 'Outros' && typeMatches(text, ['membros', 'members'])) {
        return 'Seguidores';
    }
    return 'Outros';
}
function typeMatches(text, terms) {
    return hasAny(text, terms);
}
function isBrazilian(text) {
    return hasAny(text, ['brasileir', ' brasil ', ' publico brasileiro', 'contas brasileiras', 'br ']);
}
function isInternational(text) {
    return hasAny(text, ['internacional', 'internation', 'global', 'mundial', 'mundiais']);
}
function isMixed(text) {
    return hasAny(text, ['misto', 'mista', 'mix', 'mixed', 'mq']);
}
function matchesVariantByType(text, platform, type, variant) {
    if (variant === 'Outros') {
        return true;
    }
    if (type === 'Seguidores' || type === 'Curtidas') {
        if (variant === 'Brasileiro')
            return isBrazilian(text);
        if (variant === 'Internacional')
            return isInternational(text);
        if (variant === 'Misto')
            return isMixed(text) || (isBrazilian(text) && isInternational(text));
        return true;
    }
    if (type === 'Visualizacoes') {
        if (platform === 'Telegram') {
            if (variant === 'Outros')
                return true;
            return hasAny(text, ['postagem', 'postagens', 'post', 'views']);
        }
        if (variant === 'Reels')
            return hasAny(text, ['reel', 'reels']);
        if (variant === 'Stories')
            return hasAny(text, ['story', 'stories']);
        if (variant === 'Lives')
            return hasAny(text, ['live', 'ao vivo']);
        if (variant === 'Videos')
            return hasAny(text, ['video', 'videos', 'views', 'visualizacoes']);
        if (variant === 'Posts')
            return hasAny(text, ['post', 'postagem', 'publicacao']);
        if (variant === 'Shorts')
            return hasAny(text, ['shorts', 'short']);
        if (variant === 'Canal')
            return hasAny(text, ['canal', 'channel']);
        if (variant === 'Perfil')
            return hasAny(text, ['perfil', 'profile']);
        return platform !== 'Instagram';
    }
    if (type === 'Comentarios') {
        if (variant === 'Brasileiros')
            return isBrazilian(text);
        if (variant === 'Internacionais')
            return isInternational(text);
        if (variant === 'Personalizados')
            return hasAny(text, ['personalizado', 'custom']);
        return true;
    }
    if (type === 'Metricas') {
        if (variant === 'Salvamentos')
            return hasAny(text, ['salvamentos', 'saves']);
        if (variant === 'Compartilhamentos')
            return hasAny(text, ['compartilh', 'shares']);
        if (variant === 'Impressoes')
            return hasAny(text, ['impress', 'impressions']);
        if (variant === 'Alcance')
            return hasAny(text, ['alcance', 'reach']);
        if (variant === 'Visitas')
            return hasAny(text, ['visitas', 'visit', 'profile visits']);
        return true;
    }
    if (type === 'Reacoes') {
        if (variant === 'Aleatorio')
            return hasAny(text, ['aleatorio', 'aleatório']);
        if (variant === 'Curtir')
            return hasAny(text, ['[👍]', '👍']);
        if (variant === 'Coracao')
            return hasAny(text, ['[❤️]', '[❤]', '❤️', '❤']);
        if (variant === 'Risada')
            return hasAny(text, ['[😂]', '😂']);
        if (variant === 'Surpreso')
            return hasAny(text, ['[😲]', '😲']);
        if (variant === 'Triste')
            return hasAny(text, ['[😥]', '😥']);
        if (variant === 'Oracao')
            return hasAny(text, ['[🙏]', '🙏']);
        return true;
    }
    return true;
}
function getRefillSignalLines(service) {
    const rawText = [
        service.name,
        service.description,
        service.raw_payload?.description
    ].filter(Boolean).join('\n');
    return rawText
        .split(/\r?\n/)
        .map((line) => normalizeCatalogText(line).trim())
        .filter((line) => line && hasAny(line, ['reposicao', 'refill', 'refil', 'r30', 'r60', 'r90', 'r365', 'vitalicia', 'lifetime']));
}
export function serviceHasRefillSignal(service) {
    if (service.raw_payload?.refill === true) {
        return true;
    }
    const refillLines = getRefillSignalLines(service);
    const hasExplicitPositive = refillLines.some((line) => {
        const hasPositiveTerm = hasAny(line, [
            'possui refil',
            'refil por',
            'reposicao: 30 dias',
            'reposicao: 60 dias',
            'reposicao: 90 dias',
            'reposicao: 365 dias',
            '30 dias',
            '60 dias',
            '90 dias',
            '365 dias',
            'r30',
            'r60',
            'r90',
            'r365',
            'vitalicia',
            'lifetime',
            'via botao',
            'disponivel'
        ]);
        const hasNegativeTerm = hasAny(line, [
            'nao disponivel',
            'sem reposicao',
            'sem refil',
            'nao possui refil',
            'nao possui refill',
            'sem refill'
        ]);
        return hasPositiveTerm && !hasNegativeTerm;
    });
    if (hasExplicitPositive) {
        return true;
    }
    const hasExplicitNegative = refillLines.some((line) => hasAny(line, [
        'nao disponivel',
        'sem reposicao',
        'sem refil',
        'nao possui refil',
        'nao possui refill',
        'sem refill'
    ]));
    if (hasExplicitNegative) {
        return false;
    }
    const text = getSearchText(service);
    return hasAny(text, ['garantia vitalicia', 'vitalicia', 'lifetime', 'r30', 'r60', 'r90', 'r365']);
}
export function matchesGuidedFilters(service, platform, type, variant, refillMode) {
    const catalogPlatforms = getCatalogPlatformsForMenu(platform);
    if (service.catalog_platform && !catalogPlatforms.includes(service.catalog_platform)) {
        return false;
    }
    const inferredType = inferServiceType(platform, service);
    if (type === 'Outros') {
        if (['Seguidores', 'Curtidas', 'Visualizacoes', 'Comentarios', 'Metricas'].includes(inferredType)) {
            return false;
        }
    }
    else if (inferredType !== type) {
        return false;
    }
    const text = getSearchText(service);
    if (variant && !matchesVariantByType(text, platform, type, variant)) {
        return false;
    }
    if (refillMode !== 'any') {
        const hasRefill = serviceHasRefillSignal(service);
        if (refillMode === 'with_refill' && !hasRefill)
            return false;
        if (refillMode === 'without_refill' && hasRefill)
            return false;
    }
    return true;
}
export function isProfileBasedRequest(platform, type) {
    if (type === 'Seguidores') {
        return true;
    }
    if (type === 'Membros') {
        return true;
    }
    if (type === 'Curtidas + Seguidores') {
        return true;
    }
    if (platform === 'Facebook' && type === 'Curtidas') {
        return false;
    }
    return false;
}
export function getMandatoryInstructions(platform, type) {
    if (platform === 'Instagram' && type === 'Seguidores') {
        return [
            'Deixe o perfil publico.',
            'Entre em Seguidores e convites.',
            'Desative Sinalizar para analise.',
            'Nao altere o @ nem privatize o perfil durante a entrega.'
        ];
    }
    if (platform === 'Telegram' && type === 'Visualizacoes') {
        return [
            'Envie o link exato da postagem.',
            'Mantenha o canal ou grupo publico durante a entrega.',
            'Nao apague nem altere a postagem ate a conclusao.'
        ];
    }
    if (platform === 'Telegram' && type === 'Membros') {
        return [
            'Mantenha o grupo ou canal publico durante a entrega.',
            'Nao altere o @, link ou privacidade ate a conclusao.',
            'Evite pedidos simultaneos no mesmo destino.'
        ];
    }
    if (platform === 'YouTube' && type === 'Seguidores') {
        return [
            'O canal deve estar publico durante toda a entrega.',
            'Nao altere o @, link do canal ou privacidade ate a conclusao.',
            'Evite comprar o mesmo servico ao mesmo tempo para o mesmo canal.'
        ];
    }
    if (platform === 'YouTube' && type === 'Curtidas') {
        return [
            'Envie o link exato do video ou short.',
            'Mantenha o video publico durante a entrega.',
            'Nao troque o link nem apague o conteudo ate a conclusao.'
        ];
    }
    if (platform === 'TikTok' && type === 'Seguidores') {
        return [
            'Deixe o perfil do TikTok publico durante toda a entrega.',
            'Nao altere o @, nome de usuario ou privacidade ate a conclusao.',
            'Evite fazer outro pedido de seguidores no mesmo perfil ao mesmo tempo.'
        ];
    }
    if (platform === 'TikTok' && (type === 'Curtidas' || type === 'Visualizacoes')) {
        return [
            'Envie o link exato do video do TikTok.',
            'Mantenha o video e o perfil publicos durante a entrega.',
            'Nao apague, arquive nem altere o link ate a conclusao.'
        ];
    }
    if (platform === 'Facebook' && type === 'Seguidores') {
        return [
            'Deixe o perfil ou a pagina em modo publico.',
            'Nao altere o link, @ ou nome da pagina durante a entrega.',
            'Evite pedidos simultaneos no mesmo perfil ou pagina.'
        ];
    }
    if (platform === 'Facebook' && type === 'Curtidas + Seguidores') {
        return [
            'A pagina deve estar publica durante toda a entrega.',
            'Nao altere o link ou nome da pagina ate a conclusao.',
            'Evite outro pedido igual no mesmo destino ao mesmo tempo.'
        ];
    }
    if (platform === 'WhatsApp' && type === 'Seguidores') {
        return [
            'O canal do WhatsApp deve estar publico.',
            'Nao altere o link do canal durante a entrega.',
            'Evite fazer mais de um pedido igual ao mesmo tempo.'
        ];
    }
    if (platform === 'WhatsApp' && type === 'Reacoes') {
        return [
            'O canal deve estar publico.',
            'As reacoes vao para a postagem mais recente do canal.',
            'Nao altere o link nem a privacidade durante a entrega.'
        ];
    }
    if (isProfileBasedRequest(platform, type)) {
        return [
            'Deixe o perfil, pagina ou canal publico.',
            'Nao altere o link ou @ durante a entrega.',
            'Evite pedidos simultaneos no mesmo destino.'
        ];
    }
    return [
        'Confirme se a publicacao ou video esta publico.',
        'Nao apague, arquive ou altere o link durante a entrega.',
        'Evite fazer dois pedidos iguais no mesmo link ao mesmo tempo.'
    ];
}
export function getLinkTargetLabel(platform, type) {
    if (platform === 'Instagram' && type === 'Seguidores')
        return 'perfil';
    if (platform === 'TikTok' && type === 'Seguidores')
        return 'perfil do TikTok';
    if (platform === 'TikTok' && (type === 'Curtidas' || type === 'Visualizacoes'))
        return 'link do video do TikTok';
    if (platform === 'YouTube' && type === 'Seguidores')
        return 'link do canal';
    if (platform === 'YouTube' && type === 'Curtidas')
        return 'link do video ou short';
    if (platform === 'Facebook' && type === 'Seguidores')
        return 'link do perfil ou pagina';
    if (platform === 'Telegram' && type === 'Visualizacoes')
        return 'link da postagem';
    if (platform === 'Telegram' && type === 'Membros')
        return 'link do grupo ou canal';
    if (platform === 'WhatsApp' && (type === 'Seguidores' || type === 'Reacoes'))
        return 'link do canal';
    if (platform === 'Facebook' && type === 'Curtidas + Seguidores')
        return 'link da pagina';
    if (isProfileBasedRequest(platform, type))
        return 'perfil, pagina ou canal';
    if (platform === 'YouTube')
        return 'video, short, live ou canal';
    if (platform === 'TikTok')
        return 'perfil ou video';
    if (platform === 'Facebook')
        return 'pagina, perfil, post, reel ou video';
    return 'destino do servico';
}
export function normalizeGuidedCheckoutLink(platform, type, rawInput) {
    const trimmed = rawInput.trim().replace(/\s+/g, '');
    if (!trimmed) {
        return null;
    }
    if (platform === 'Instagram') {
        if (type === 'Seguidores') {
            if (isAnyProfileHandle(trimmed)) {
                return `https://instagram.com/${trimmed.replace(/^@/, '')}`;
            }
            if (/^(https?:\/\/)?(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?(\?.*)?$/i.test(trimmed)) {
                return withHttps(trimmed);
            }
            return null;
        }
        if (/^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|reels|tv|stories)\/[a-zA-Z0-9._-]+/i.test(trimmed)) {
            return withHttps(trimmed);
        }
        if (/^(https?:\/\/)?(www\.)?instagram\.com\/.+/i.test(trimmed)) {
            return withHttps(trimmed);
        }
        return null;
    }
    if (platform === 'TikTok') {
        if (type === 'Seguidores' && isAnyProfileHandle(trimmed)) {
            return `https://www.tiktok.com/@${trimmed.replace(/^@/, '')}`;
        }
        if (/^(https?:\/\/)?(www\.)?tiktok\.com\/.+/i.test(trimmed) || /^(https?:\/\/)?vm\.tiktok\.com\/.+/i.test(trimmed)) {
            return withHttps(trimmed);
        }
        return null;
    }
    if (platform === 'YouTube') {
        if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i.test(trimmed)) {
            return withHttps(trimmed);
        }
        return null;
    }
    if (platform === 'Facebook') {
        if (/^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/.+/i.test(trimmed)) {
            return withHttps(trimmed);
        }
        return null;
    }
    if (platform === 'Telegram') {
        if (type === 'Membros' && isAnyProfileHandle(trimmed)) {
            return `https://t.me/${trimmed.replace(/^@/, '')}`;
        }
        if (type === 'Visualizacoes') {
            if (/^(https?:\/\/)?(t\.me|telegram\.me)\/.+\/\d+$/i.test(trimmed)) {
                return withHttps(trimmed);
            }
            return null;
        }
        if (/^(https?:\/\/)?(t\.me|telegram\.me)\/.+/i.test(trimmed)) {
            return withHttps(trimmed);
        }
        return null;
    }
    if (platform === 'WhatsApp') {
        if (/^(https?:\/\/)?(www\.)?whatsapp\.com\/channel\/.+/i.test(trimmed)) {
            return withHttps(trimmed);
        }
        if (/^(https?:\/\/)?chat\.whatsapp\.com\/.+/i.test(trimmed)) {
            return withHttps(trimmed);
        }
        return null;
    }
    if (/^(https?:\/\/).+/i.test(trimmed)) {
        return trimmed;
    }
    return null;
}
export function describePlatform(platform) {
    if (majorPlatforms.includes(platform)) {
        return platform;
    }
    if (platform === 'Outros') {
        return 'outras plataformas';
    }
    return platform;
}
