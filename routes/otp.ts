import { SettingController } from "../controllers/Settings.controller.js";
import { permissions } from "../middlewares/auth.middleware.js";
import { Router } from 'express';

const Setting: SettingController = new SettingController();
const router: Router = Router();

router.get('/', Setting.indexOtp);
router.post('/:id/share-token', permissions.requireManager, Setting.generateShareToken);
router.post('/:id/verify-passkey', Setting.verifyOtpPasskey);
router.post('/:id/share-passkey', permissions.requireManager, Setting.saveSharePasskey);
router.get('/share/:token', Setting.viewOtpShare);
router.post('/share/:token/code', Setting.otpShareCode);

export default router;
