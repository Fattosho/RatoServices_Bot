export function applyMarkup(supplierPrice, multiplier) {
    return Number((supplierPrice * multiplier).toFixed(2));
}
