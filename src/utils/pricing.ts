export function applyMarkup(supplierPrice: number, multiplier: number): number {
  return Number((supplierPrice * multiplier).toFixed(2));
}
