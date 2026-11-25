import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and lets later Tailwind classes override earlier ones (e.g. a caller's `w-56` beats a default `w-full`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
