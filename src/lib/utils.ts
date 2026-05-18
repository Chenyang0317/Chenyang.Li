import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || Number.isNaN(num)) return '0';
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  return num.toString();
}

/**
 * Extract sec_user_id from a douyin user profile url or raw id
 */
export function extractSecUserId(input: string): string {
  if (!input) return '';
  // Clean any URL if it's mixed
  let cleanInput = input.replace(/https?:\/\/[^\s]+/, '').trim();
  if (!cleanInput) cleanInput = input.trim();
  
  const match = cleanInput.match(/user\/([^?\/]+)/) || input.match(/user\/([^?\/]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  try {
     const url = new URL(input);
     const parts = url.pathname.split('/');
     if (parts.length >= 3 && parts[1] === 'user') {
         return parts[2];
     }
  } catch (e) {
  }
  return cleanInput;
}

export function extractBilibiliUid(input: string): string {
  if (!input) return '';
  
  // Clean any URL if it's mixed but keep it if it's a valid link
  let cleanInput = input.trim();
  const linkMatch = cleanInput.match(/space\.bilibili\.com\/(\d+)/);
  if (linkMatch && linkMatch[1]) {
    return linkMatch[1];
  }
  
  cleanInput = cleanInput.replace(/https?:\/\/[^\s]+/, '').trim();
  if (!cleanInput) {
    const backupMatch = input.match(/space\.bilibili\.com\/(\d+)/);
    if (backupMatch) return backupMatch[1];
    cleanInput = input.trim();
  }

  // Try to match a pure number string
  const numMatch = cleanInput.match(/(\d+)/);
  if (numMatch && numMatch[1]) {
    return numMatch[1];
  }
  
  return cleanInput;
}

export function getProxiedAvatar(url: string | undefined | null, nickname?: string): string {
  if (!url || !url.startsWith('http')) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname || 'U')}&background=random&color=fff`;
  }
  // Use wsrv.nl to proxy images and avoid Referrer issues/Hotlink protection
  // specifically for Douyin/Weibo/Bilibili
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=200&h=200&fit=cover`;
}
