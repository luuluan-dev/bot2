import { Router, Request, Response } from 'express';
import { Setting } from '../models/setting.js';
import { CONFIGURABLE_PAGES } from '../utils/publicPages.js';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
    const { page, redirect, error } = req.query as Record<string, string>;
    const pageInfo = CONFIGURABLE_PAGES.find(p => p.key === page);
    res.render('pages/passkey', {
        layout: false,
        page,
        pageName: pageInfo?.label || page,
        redirect: redirect || `/${page}`,
        error: error === '1'
    });
});

router.post('/verify', async (req: Request, res: Response): Promise<void> => {
    const { page, passkey, redirect } = req.body;
    const setting = new Setting();
    const stored = await setting.getSetting(`passkey_${page}`);

    if (!stored || stored === passkey) {
        // Đúng passkey — set cookie và redirect
        res.cookie(`pk_${page}`, passkey, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.redirect(redirect || `/${page}`);
    } else {
        res.redirect(`/passkey?page=${page}&redirect=${encodeURIComponent(redirect)}&error=1`);
    }
});

export default router;
