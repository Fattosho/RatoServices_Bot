import { fetchSupplierServices } from '../integrations/supplierApi.js';
import { upsertServices } from '../db/repositories.js';
export async function syncServices() {
    const services = await fetchSupplierServices();
    await upsertServices(services);
    return services.length;
}
