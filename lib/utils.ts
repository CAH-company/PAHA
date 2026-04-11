import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = 'dd.MM.yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: pl });
}

export function formatDateRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isToday(d)) return 'Dzisiaj ' + format(d, 'HH:mm');
  if (isYesterday(d)) return 'Wczoraj ' + format(d, 'HH:mm');
  return format(d, 'dd.MM.yyyy HH:mm', { locale: pl });
}

export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: pl });
}

export function formatCurrency(amount: number, currency: 'PLN' | 'EUR' | 'USD' = 'PLN'): string {
  const symbols: Record<string, string> = { PLN: 'zł', EUR: '€', USD: '$' };
  const sym = symbols[currency] ?? currency;
  const formatted = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  if (currency === 'PLN') return `${formatted} ${sym}`;
  return `${sym}${formatted}`;
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Nowy',
  contacted: 'Kontakt',
  offer_sent: 'Oferta wysłana',
  negotiation: 'Negocjacje',
  won: 'Wygrany',
  lost: 'Przegrany',
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#8b5cf6',
  offer_sent: '#f59e0b',
  negotiation: '#f97316',
  won: '#10b981',
  lost: '#ef4444',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Niski',
  normal: 'Normalny',
  high: 'Wysoki',
  urgent: 'Pilny',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  normal: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

export const SOURCE_LABELS: Record<string, string> = {
  manual: 'Ręczny',
  csv: 'Import CSV',
  lemlist: 'Lemlist',
  clay: 'Clay',
  form: 'Formularz',
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  planning: 'Planowanie',
  active: 'Aktywna',
  paused: 'Wstrzymana',
  done: 'Zakończona',
};

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: 'Aktywny',
  needs_attention: 'Wymaga uwagi',
  closed: 'Zamknięty',
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  partner: 'Wspólnik',
  employee: 'Pracownik',
};
