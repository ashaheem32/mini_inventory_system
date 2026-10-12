import { config } from "../config";

let formatter: Intl.NumberFormat | null = null;

function currencyFormatter() {
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(config.locale, { style: "currency", currency: config.currency });
    } catch {
      formatter = new Intl.NumberFormat(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  return formatter;
}

/** Format a decimal string from the API ("49.90") for display. */
export function formatPrice(price: string): string {
  const value = Number(price);
  return Number.isFinite(value) ? currencyFormatter().format(value) : price;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat(config.locale).format(n);
}
