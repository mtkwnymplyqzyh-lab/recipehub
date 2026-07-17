import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidImageUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('data:image/');
}
