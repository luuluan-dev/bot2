import { Setting } from '../models/setting.js';
import { Request } from 'express';

// Các page có thể cho public (path không có dấu /)
export const CONFIGURABLE_PAGES = [
    { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { key: 'otp',       label: 'OTP',       path: '/otp' },
    { key: 'features',  label: 'Feature',   path: '/features' },
];

let cache: { pages: string[]; expires: number } | null = null;

export async function getPublicPages(): Promise<string[]> {
    if (cache && Date.now() < cache.expires) return cache.pages;
    const setting = new Setting();
    const value = await setting.getSetting('public_pages');
    const pages = value ? value.split(',').map((p: string) => p.trim()).filter(Boolean) : [];
    cache = { pages, expires: Date.now() + 30_000 };
    return pages;
}

export function clearPublicPagesCache(): void {
    cache = null;
}

export async function checkPasskey(pageKey: string, req: Request): Promise<boolean> {
    const setting = new Setting();
    const stored = await setting.getSetting(`passkey_${pageKey}`);
    if (!stored) return true; // không có passkey → cho qua
    const cookie = (req.cookies as any)?.[`pk_${pageKey}`];
    return cookie === stored;
}
