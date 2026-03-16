import { Response } from 'express';
import { Request } from '../interfaces/request.js';
import { BaseController } from "./Base.controller.js";
import { Setting } from '../models/setting.js';
import { OtpSecret } from '../models/otpSecret.js';
import { generate } from 'otplib';

interface SettingOptions {
    id?: string;
    key?: string;
    value?: string;
}

export class SettingController extends BaseController {
    async index(req: Request, res: Response): Promise<void> {
        const setting = new Setting();
        const otpSecret = new OtpSecret();
        const [allSettings, otpSecrets] = await Promise.all([
            setting.getSettings(),
            otpSecret.getAll()
        ]);
        res.render('pages/settings', { settings: allSettings, otpSecrets });
    }

    async save(req: Request, res: Response): Promise<void> {
        try {
            const { id, key, value } = req.body;
            const setting = new Setting();
            const saveOptions: SettingOptions = {};
            if (id) saveOptions['id'] = id;
            if (key) saveOptions['key'] = key;
            if (value) saveOptions['value'] = value;
            const saved = await setting.save(saveOptions, { key });
            if (saved) {
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
