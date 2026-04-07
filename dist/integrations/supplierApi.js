import axios from 'axios';
import { env } from '../config/env.js';
import { applyMarkup } from '../utils/pricing.js';
import { curateCatalogEntry } from '../utils/catalogCuration.js';
let supplierStatusActionUnavailable = false;
function pickString(obj, keys, fallback = '') {
    for (const key of keys) {
        const value = obj[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
        if (typeof value === 'number') {
            return String(value);
        }
    }
    return fallback;
}
function pickBoolean(obj, keys, fallback) {
    for (const key of keys) {
        const value = obj[key];
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value === 1 ? true : value === 0 ? false : fallback;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['1', 'true', 'yes', 'sim', 'available', 'enabled', 'success', 'ok', 'done'].includes(normalized)) {
                return true;
            }
            if (['0', 'false', 'no', 'nao', 'not available', 'disabled', 'failed', 'error'].includes(normalized)) {
                return false;
            }
        }
    }
    return fallback;
}
function pickNumber(obj, keys, fallback = 0) {
    for (const key of keys) {
        const value = obj[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
            return Number(value);
        }
    }
    return fallback;
}
function normalizeService(item) {
    const externalId = pickString(item, ['id', 'service', 'service_id', 'external_id']);
    const name = pickString(item, ['name', 'service_name', 'title'], 'Servico sem nome');
    const description = pickString(item, ['description', 'desc', 'details'], 'Sem descricao');
    const category = pickString(item, ['category', 'group', 'type', 'service_type'], 'Outros');
    const supplierPrice = pickNumber(item, ['price', 'rate', 'cost', 'amount'], 0);
    const finalPrice = applyMarkup(supplierPrice, env.priceMarkupMultiplier);
    const curation = curateCatalogEntry({
        externalId,
        category,
        name,
        description,
        supplierPrice,
        finalPrice
    });
    return {
        externalId,
        name,
        description,
        category,
        supplierPrice,
        finalPrice,
        rawPayload: item,
        active: curation.active,
        catalogPlatform: curation.platform,
        catalogReason: curation.reason,
        catalogScore: curation.score
    };
}
function extractItems(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (Array.isArray(payload?.data)) {
        return payload.data;
    }
    if (Array.isArray(payload?.services)) {
        return payload.services;
    }
    if (Array.isArray(payload?.result)) {
        return payload.result;
    }
    return [];
}
function getSupplierApiUrl() {
    return `${env.supplierApiBaseUrl.replace(/\/$/, '')}${env.supplierApiServicesPath}`;
}
async function postSupplierAction(action, payload) {
    const params = new URLSearchParams();
    params.append('key', env.supplierApiToken);
    params.append('action', action);
    for (const [key, value] of Object.entries(payload)) {
        params.append(key, value);
    }
    const response = await axios.post(getSupplierApiUrl(), params.toString(), {
        timeout: 20000,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data;
}
function extractSupplierErrorMessage(data, fallback) {
    if (typeof data === 'string' && data.trim()) {
        return data.trim();
    }
    if (data && typeof data === 'object') {
        const directError = pickString(data, ['error', 'message', 'msg'], '');
        if (directError) {
            return directError;
        }
        if (Array.isArray(data.cancel)) {
            const [firstItem] = data.cancel;
            if (firstItem && typeof firstItem === 'object') {
                const nestedError = pickString(firstItem, ['error', 'message', 'msg'], '');
                if (nestedError) {
                    return nestedError;
                }
            }
        }
    }
    return fallback;
}
export async function fetchSupplierServices() {
    const url = getSupplierApiUrl();
    console.log(`Buscando servicos em: ${url}`);
    try {
        const data = await postSupplierAction('services', {});
        const items = extractItems(data);
        console.log(`Extraidos ${items.length} itens do fornecedor.`);
        const services = items
            .map((item) => normalizeService(item))
            .filter((service) => service.externalId && service.name && service.finalPrice < 1000000000);
        const activeServices = services.filter((service) => service.active).length;
        const hiddenServices = services.length - activeServices;
        console.log(`Catalogo curado: ${activeServices} ativos, ${hiddenServices} ocultos.`);
        return services;
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Erro na API do fornecedor:', error.response?.data || error.message);
        }
        throw error;
    }
}
export async function submitOrder(externalServiceId, link, quantity) {
    try {
        const data = await postSupplierAction('add', {
            service: externalServiceId,
            link,
            quantity: String(quantity)
        });
        return data.order || data.id || null;
    }
    catch (error) {
        console.error('Erro ao enviar pedido para o fornecedor:', error.response?.data || error.message);
        return null;
    }
}
function normalizeSupplierStatus(rawStatus) {
    const status = (rawStatus ?? '').trim().toLowerCase();
    if (!status)
        return 'pending';
    if (['completed', 'complete', 'success', 'delivered'].includes(status))
        return 'completed';
    if (['partial'].includes(status))
        return 'partial';
    if (['processing', 'in progress', 'inprogress', 'progress', 'running'].includes(status))
        return 'processing';
    if (['pending', 'queued', 'waiting'].includes(status))
        return 'pending';
    if (['canceled', 'cancelled'].includes(status))
        return 'cancelled';
    if (['failed', 'error'].includes(status))
        return 'failed';
    return status;
}
export async function fetchSupplierOrderStatus(orderId) {
    if (supplierStatusActionUnavailable) {
        return null;
    }
    try {
        const data = await postSupplierAction('status', {
            order: orderId
        });
        const rawStatus = pickString(data, ['status', 'order_status', 'state'], '');
        if (!rawStatus) {
            return null;
        }
        return {
            normalizedStatus: normalizeSupplierStatus(rawStatus),
            rawStatus,
            remains: pickString(data, ['remains', 'remain', 'remaining'], ''),
            startCount: pickString(data, ['start_count', 'startCount'], ''),
            charge: pickString(data, ['charge', 'amount'], ''),
            refillAvailable: pickBoolean(data, ['refill', 'refill_available', 'can_refill']),
            cancelAvailable: pickBoolean(data, ['cancel', 'cancel_available', 'can_cancel']),
            raw: data
        };
    }
    catch (error) {
        const responseData = error.response?.data;
        const message = typeof responseData?.error === 'string' ? responseData.error.toLowerCase() : '';
        if (message.includes('action') || message.includes('method') || error.response?.status === 404) {
            supplierStatusActionUnavailable = true;
        }
        console.error('Erro ao consultar status no fornecedor:', responseData || error.message);
        return null;
    }
}
export async function requestSupplierRefill(orderId) {
    try {
        const data = await postSupplierAction('refill', {
            order: orderId
        });
        const directError = extractSupplierErrorMessage(data, '');
        if (directError) {
            return {
                success: false,
                message: directError,
                raw: data
            };
        }
        const requestId = pickString(data ?? {}, ['refill', 'refill_id', 'request_id', 'id', 'order'], '');
        return {
            success: true,
            message: requestId ? `Refil solicitado com sucesso. Protocolo ${requestId}.` : 'Refil solicitado com sucesso.',
            requestId: requestId || undefined,
            raw: data
        };
    }
    catch (error) {
        const responseData = error.response?.data;
        const message = extractSupplierErrorMessage(responseData, 'Nao foi possivel liberar refil para este pedido agora.');
        console.error('Erro ao solicitar refil no fornecedor:', responseData || error.message);
        return {
            success: false,
            message,
            raw: responseData ?? { message: error.message }
        };
    }
}
export async function requestSupplierCancel(orderId) {
    try {
        const data = await postSupplierAction('cancel', {
            orders: orderId
        });
        const directSuccess = pickBoolean(data ?? {}, ['cancel', 'success', 'status'], undefined);
        let requestId = pickString(data ?? {}, ['cancel', 'id', 'order'], '');
        let success = directSuccess ?? false;
        if (Array.isArray(data?.cancel) && data.cancel.length) {
            const firstItem = data.cancel[0];
            if (firstItem && typeof firstItem === 'object') {
                success = pickBoolean(firstItem, ['success', 'status', 'cancel'], success) ?? success;
                requestId = requestId || pickString(firstItem, ['id', 'order', 'cancel'], '');
            }
        }
        if (!success && !requestId && !extractSupplierErrorMessage(data, '')) {
            success = true;
        }
        return {
            success,
            message: success
                ? 'Cancelamento solicitado com sucesso.'
                : extractSupplierErrorMessage(data, 'Nao foi possivel cancelar este pedido agora.'),
            requestId: requestId || undefined,
            raw: data
        };
    }
    catch (error) {
        const responseData = error.response?.data;
        const message = extractSupplierErrorMessage(responseData, 'Nao foi possivel cancelar este pedido agora.');
        console.error('Erro ao solicitar cancelamento no fornecedor:', responseData || error.message);
        return {
            success: false,
            message,
            raw: responseData ?? { message: error.message }
        };
    }
}
export async function fetchSupplierBalance() {
    try {
        const data = await postSupplierAction('balance', {});
        const balance = pickString(data ?? {}, ['balance', 'funds', 'credit', 'credits'], '');
        if (!balance) {
            return null;
        }
        const currency = pickString(data ?? {}, ['currency', 'currency_code', 'curr'], '');
        return {
            balance,
            currency: currency || undefined,
            raw: data
        };
    }
    catch (error) {
        console.error('Erro ao consultar saldo no fornecedor:', error.response?.data || error.message);
        return null;
    }
}
