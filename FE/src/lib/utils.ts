import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrencyVnd(value: number | string | null | undefined): string {
  const numericValue = Number(value ?? 0)
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(safeValue)
}
