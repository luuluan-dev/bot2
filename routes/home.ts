import { HomeController } from "../controllers/Home.controller.js";
import { Router } from 'express';

const homeController: HomeController = new HomeController();
const router: Router = Router();

router.get('/', homeController.dashboard.bind(homeController));

export default router;