import { SettingController } from "../controllers/Settings.controller.js";
import { permissions } from "../middlewares/auth.middleware.js";
import { Router } from 'express';

const Setting: SettingController = new SettingController();
const router: Router = Router();

router.get('/', permissions.requireManager, Setting.index);
router.post('/save', permissions.requireManager, Setting.save);
router.post('/otp/save', permissions.requireManager, Setting.saveOtp);
router.get('/otp/:id/generate', permissions.requireManager, Setting.generateOtp);
router.delete('/otp/:id', permissions.requireManager, Setting.deleteOtp);

export default router;
