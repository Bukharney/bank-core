/**
 * Converts minor currency units (Satang/Cents) to formatted Decimal string in THB
 * Example: 10050 Satang -> "100.50"
 */
export function satangToThb(satang: number): string {
  if (isNaN(satang)) return "0.00";
  return (satang / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converts Decimal THB input string/number to integer minor units (Satang)
 * Example: "100.50" -> 10050
 */
export function thbToSatang(thb: string | number): number {
  const num = typeof thb === "string" ? parseFloat(thb) : thb;
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

/**
 * Formats monetary amounts with currency symbol
 * Example: 10050, "THB" -> "฿100.50"
 */
export function formatMoney(satang: number, currency: string = "THB"): string {
  const symbol = currency === "THB" ? "฿" : "$";
  return `${symbol}${satangToThb(satang)}`;
}

/**
 * Formats ISO timestamps to readable localized datetime
 */
export function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    return d.toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Formats 10-digit account numbers into bank standard "XXX-X-XXXXX-X"
 */
export function formatAccountNumber(accNum: string): string {
  if (!accNum || accNum.length !== 10) return accNum;
  return `${accNum.slice(0, 3)}-${accNum.slice(3, 4)}-${accNum.slice(4, 9)}-${accNum.slice(9)}`;
}

/**
 * Auto-formats raw digits into progressive "XXX-X-XXXXX-X" while typing (up to 10 digits)
 */
export function formatAccountInput(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 9)}-${digits.slice(9)}`;
}
