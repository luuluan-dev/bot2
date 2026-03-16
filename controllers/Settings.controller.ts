import { Response } from 'express';
import { Request } from '../interfaces/request.js';
import { BaseController } from "./Base.controller.js";
import { Setting } from '../models/setting.js';
import { OtpSecret } from '../models/otpSecret.js';
import { generate } from 'otplib';
import { clearPublicPagesCache } from '../utils/publicPages.js';
import { randomBytes } from 'crypto';

interface SettingOptions {
    id?: string;
    key?: string;
    value?: string;
}

export class SettingController extends BaseController {
    async index(req: Request, res: Response): Promise<void> {
        const setting = new Setting();
        const allSettings = await setting.getSettings();
        res.render('pages/settings', { settings: allSettings });
    }

    async indexOtp(req: Request, res: Response): Promise<void> {
        const otpSecret = new OtpSecret();
        const otpSecrets = await otpSecret.getAll();
        res.render('pages/otp', { title: 'OTP', activePage: 'otp', otpSecrets });
    }

    async save(req: Request, res: Response): Promise<void> {
        try {
            const { id, key, value } = req.body;
            const setting = new Setting();
            const existing = await setting.findFirst({ key });
            const saved = existing
                ? await setting.save({ value: value ?? '' }, { key })
                : await setting.save({ key, value: value ?? '' });
            if (saved) {
                if (key === 'public_pages') clearPublicPagesCache();
                res.json({ ok: true, message: 'Setting saved successfully' });
                return;
            }
            res.status(500).json({ message: 'Failed to save setting' });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async saveOtp(req: Request, res: Response): Promise<void> {
        try {
            const { name, value } = req.body;
            if (!name || !value) {
                res.status(400).json({ message: 'Thiếu name hoặc value' });
                return;
            }
            const otpSecret = new OtpSecret();
            const existing = await otpSecret.getByName(name.trim());
            const saved = existing
                ? await otpSecret.save({ value: value.trim() }, { id: existing.id })
                : await otpSecret.save({ name: name.trim(), value: value.trim() });
            if (saved) {
                res.json({ ok: true, message: 'OTP secret đã được lưu', id: saved.id });
                return;
            }
            res.status(500).json({ message: 'Lưu thất bại' });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async generateOtp(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const otpSecret = new OtpSecret();
            const record = await otpSecret.findUnique(id);
            if (!record) {
                res.status(404).json({ message: 'Không tìm thấy OTP secret' });
                return;
            }
            const cleanSecret = record.value.replace(/\s/g, '').toUpperCase();
            const code = await generate({ secret: cleanSecret });
            const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            res.json({ ok: true, code, secondsRemaining });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async saveSharePasskey(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { passkey } = req.body;
            const otpSecret = new OtpSecret();
            await otpSecret.save({ sharePasskey: passkey ?? '' }, { id });
            res.json({ ok: true });
        } catch { res.status(500).json({ message: 'Internal server error' }); }
    }

    async generateShareToken(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const otpSecret = new OtpSecret();
            const record = await otpSecret.findUnique(id);
            if (!record) { res.status(404).json({ message: 'Không tìm thấy' }); return; }
            const token = randomBytes(16).toString('hex');
            await otpSecret.save({ shareToken: token }, { id });
            res.json({ ok: true, token });
        } catch { res.status(500).json({ message: 'Internal server error' }); }
    }

    async verifyOtpPasskey(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { passkey } = req.body;
            const otpSecret = new OtpSecret();
            const record = await otpSecret.findUnique(id);
            if (!record) { res.status(404).json({ message: 'Không tìm thấy' }); return; }
            if (record.sharePasskey && record.sharePasskey !== passkey) {
                res.status(403).json({ message: 'Passkey không đúng' });
                return;
            }
            const cleanSecret = record.value.replace(/\s/g, '').toUpperCase();
            const code = await generate({ secret: cleanSecret });
            const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            res.json({ code, secondsRemaining });
        } catch { res.status(500).json({ message: 'Lỗi server' }); }
    }

    async viewOtpShare(req: Request, res: Response): Promise<void> {
        try {
            const { token } = req.params;
            const otpSecret = new OtpSecret();
            const record = await otpSecret.findFirst({ shareToken: token });
            if (!record) { res.status(404).send('Không tìm thấy'); return; }
            const needPasskey = !!record.sharePasskey;
            const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            if (needPasskey) {
                res.render('pages/otp-share', { layout: false, name: record.name, code: null, secondsRemaining, shareToken: token, needPasskey: true });
                return;
            }
            const cleanSecret = record.value.replace(/\s/g, '').toUpperCase();
            const code = await generate({ secret: cleanSecret });
            res.render('pages/otp-share', { layout: false, name: record.name, code, secondsRemaining, shareToken: token, needPasskey: false });
        } catch { res.status(500).send('Lỗi server'); }
    }

    async otpShareCode(req: Request, res: Response): Promise<void> {
        try {
            const { token } = req.params;
            const { passkey } = req.body;
            const otpSecret = new OtpSecret();
            const record = await otpSecret.findFirst({ shareToken: token });
            if (!record) { res.status(404).json({ message: 'Không tìm thấy' }); return; }
            if (record.sharePasskey && record.sharePasskey !== passkey) {
                res.status(403).json({ message: 'Passkey không đúng' });
                return;
            }
            const cleanSecret = record.value.replace(/\s/g, '').toUpperCase();
            const code = await generate({ secret: cleanSecret });
            const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            res.json({ code, secondsRemaining });
        } catch { res.status(500).json({ message: 'Lỗi server' }); }
    }

    async deleteOtp(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const otpSecret = new OtpSecret();
            await otpSecret.delete(id);
            res.json({ ok: true, message: 'Đã xóa OTP secret' });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}
