import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Normalize an Indian phone number to the canonical E.164 form: +91XXXXXXXXXX.
 * Accepts inputs like:
 *   +91 98765 43210, 919876543210, 09876543210, 9876543210, "+91-98765-43210"
 * Returns null if the number cannot be normalized to a valid 10-digit Indian mobile.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  // Strip everything except digits.
  let digits = input.replace(/\D/g, "");

  // Drop a leading country code or trunk prefix.
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (digits.length === 13 && digits.startsWith("091")) {
    digits = digits.slice(3);
  }

  // Valid Indian mobile numbers are 10 digits and start with 6-9.
  if (digits.length !== 10 || !/^[6-9]/.test(digits)) {
    return null;
  }

  return `+91${digits}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
