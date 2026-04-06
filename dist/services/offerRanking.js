function normalizeText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function containsAny(text, terms) {
    return terms.some((term) => text.includes(term));
}
function getText(service) {
    return normalizeText(`${service.category} ${service.name} ${service.description ?? ''}`);
}
function getPricePerThousand(service) {
    return Number(service.final_price);
}
function getMinAmount(service) {
    const min = Number(service.raw_payload?.min ?? 0);
    if (!Number.isFinite(min) || min <= 0) {
        return 0;
    }
    return Number(((Number(service.final_price) / 1000) * min).toFixed(2));
}
function getQualitySignals(service) {
    const text = getText(service);
    let score = 0;
    if (service.raw_payload?.refill)
        score += 18;
    if (containsAny(text, ['premium', 'ultra', 'high quality', 'qualidade']))
        score += 14;
    if (containsAny(text, ['organico', 'organic', 'reais', 'real']))
        score += 10;
    if (containsAny(text, ['garantia', 'warranty', 'refill', 'reposicao']))
        score += 8;
    if (containsAny(text, ['instant', 'rapido', 'fast']))
        score += 4;
    return score;
}
export function inferInstagramServiceType(service) {
    const text = getText(service);
    if (containsAny(text, ['seguidores', 'followers']))
        return 'Seguidores';
    if (containsAny(text, ['curtidas', 'likes']))
        return 'Curtidas';
    if (containsAny(text, ['visualiz', 'views', 'view']))
        return 'Visualizacoes';
    if (containsAny(text, ['coment', 'comments']))
        return 'Comentarios';
    if (containsAny(text, ['salvamentos', 'compartilhamentos', 'impressoes', 'metric']))
        return 'Metricas';
    return 'Outros';
}
export function inferOriginFromService(service) {
    const text = getText(service);
    if (containsAny(text, ['brasileir', ' brasil ', ' br ']))
        return 'Brasileiro';
    if (containsAny(text, ['internacional', 'global', 'mundial', 'worldwide']))
        return 'Internacional';
    if (containsAny(text, ['misto', 'mix', 'mista']))
        return 'Misto';
    return 'Todos';
}
export function rankInstagramOffers(services, context) {
    if (!services.length) {
        return [];
    }
    const analyzed = services.map((service) => {
        const text = getText(service);
        const minAmount = getMinAmount(service);
        const pricePerThousand = getPricePerThousand(service);
        let score = 100;
        score += getQualitySignals(service);
        score += pricePerThousand <= 12 ? 14 : pricePerThousand <= 20 ? 8 : pricePerThousand <= 35 ? 3 : -3;
        score += minAmount > 0 && minAmount <= 10 ? 8 : minAmount <= 20 ? 4 : 0;
        if (context.origin === 'Brasileiro' && containsAny(text, ['brasileir', ' brasil ', ' br ']))
            score += 10;
        if (context.origin === 'Internacional' && containsAny(text, ['internacional', 'global', 'mundial']))
            score += 10;
        if (context.origin === 'Misto' && containsAny(text, ['misto', 'mix']))
            score += 8;
        if (context.type === 'Seguidores' && containsAny(text, ['drop', 'queda']))
            score -= 12;
        return {
            service,
            score,
            minAmount,
            pricePerThousand,
            qualityScore: getQualitySignals(service)
        };
    });
    const cheapest = [...analyzed].sort((a, b) => a.pricePerThousand - b.pricePerThousand)[0];
    const safest = [...analyzed].sort((a, b) => b.qualityScore - a.qualityScore)[0];
    const ranked = analyzed.sort((a, b) => b.score - a.score);
    return ranked.map((entry, index) => {
        let badge = 'Boa opcao';
        let reason = 'Equilibrio entre custo e seguranca para compra rapida.';
        if (index === 0) {
            badge = 'Mais recomendada';
            reason = 'Melhor equilibrio entre custo, clareza da oferta e sinais de seguranca.';
        }
        else if (entry.service.id === cheapest.service.id) {
            badge = 'Melhor custo';
            reason = 'Boa entrada para cliente que quer testar com menor investimento.';
        }
        else if (entry.service.id === safest.service.id) {
            badge = 'Mais protegida';
            reason = entry.service.raw_payload?.refill
                ? 'Oferta com reposicao sinalizada, indicada para quem prioriza seguranca.'
                : 'Oferta com sinais mais fortes de qualidade dentro deste filtro.';
        }
        else if (entry.service.raw_payload?.refill) {
            badge = 'Com reposicao';
            reason = 'Boa escolha para quem quer reduzir atrito no pos-venda.';
        }
        return {
            service: entry.service,
            score: entry.score,
            badge,
            reason
        };
    });
}
export function getServiceTrustSignals(service) {
    const signals = [
        'Link validado antes de iniciar o pedido.',
        'Status do pedido acompanhado dentro do bot.'
    ];
    if (service.raw_payload?.refill) {
        signals.push('Oferta com reposicao disponivel nesta modalidade.');
    }
    else {
        signals.push('Oferta sem reposicao, mais indicada para compra pontual.');
    }
    return signals;
}
export function getUpsellSuggestions(service) {
    const type = inferInstagramServiceType(service);
    if (type === 'Seguidores') {
        return [
            {
                type: 'Curtidas',
                token: 'Curtidas',
                label: 'Adicionar curtidas',
                reason: 'Ajuda o perfil a parecer mais coerente com o novo volume de seguidores.'
            },
            {
                type: 'Visualizacoes',
                token: 'Visualizacoes',
                label: 'Adicionar views',
                reason: 'Aumenta movimento nos reels e sustenta a percepcao de perfil ativo.'
            }
        ];
    }
    if (type === 'Curtidas') {
        return [
            {
                type: 'Visualizacoes',
                token: 'Visualizacoes',
                label: 'Reforcar com views',
                reason: 'Views combinam bem com curtidas e deixam o conteudo mais natural.'
            },
            {
                type: 'Comentarios',
                token: 'Comentarios',
                label: 'Adicionar comentarios',
                reason: 'Comentarios ajudam a elevar a prova social do post.'
            }
        ];
    }
    if (type === 'Visualizacoes') {
        return [
            {
                type: 'Curtidas',
                token: 'Curtidas',
                label: 'Somar curtidas',
                reason: 'Combina bem com views para reforcar engajamento visivel.'
            },
            {
                type: 'Seguidores',
                token: 'Seguidores',
                label: 'Ganhar seguidores',
                reason: 'Aproveita o movimento do conteudo para crescer o perfil.'
            }
        ];
    }
    if (type === 'Comentarios') {
        return [
            {
                type: 'Curtidas',
                token: 'Curtidas',
                label: 'Somar curtidas',
                reason: 'Deixa a publicacao com um pacote de engajamento mais convincente.'
            },
            {
                type: 'Visualizacoes',
                token: 'Visualizacoes',
                label: 'Somar views',
                reason: 'Ajuda a completar o volume do post ou reel.'
            }
        ];
    }
    return [
        {
            type: 'Curtidas',
            token: 'Curtidas',
            label: 'Comprar curtidas',
            reason: 'Boa porta de entrada para complementar este pedido.'
        },
        {
            type: 'Seguidores',
            token: 'Seguidores',
            label: 'Comprar seguidores',
            reason: 'Ajuda a ampliar o impacto visual do perfil.'
        }
    ];
}
