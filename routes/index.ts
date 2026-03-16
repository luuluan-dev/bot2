import { Request, Response, NextFunction, Application } from 'express';
import { authenticateUser } from "../middlewares/auth.middleware.js";
import AuthRoute from "./auth.js";
import HomeRoute from "./home.js";
import UserRoute from "./user.js";
import SettingRoute from "./setting.js";
import OtpRoute from "./otp.js";
import DiscordRoute from "./discord.js";
import { HomeController } from '../controllers/Home.controller.js';
import { DiscordController } from '../controllers/Discord.controller.js';
import { getPublicPages, checkPasskey, CONFIGURABLE_PAGES } from '../utils/publicPages.js';
import PasskeyRoute from './passkey.js';
const homeController: HomeController = new HomeController();
const discordController: DiscordController = new DiscordController();

export const Route = (app: Application): void => {
    app.use('/auth', AuthRoute);
    app.use('/passkey', PasskeyRoute);
    app.get('/login', (req: Request, res: Response): void => {
        const token = req.cookies.accessToken;
        if (token) {
            res.redirect("/dashboard");
        }
        res.render('pages/login', {
            title: 'Đăng nhập',
            activePage: 'login',
            layout: false
        });
    });

    app.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // User đã login → đi qua auth bình thường, không check passkey
        if (req.cookies?.accessToken) {
            return authenticateUser(req, res, next);
        }

        const publicPages = await getPublicPages();
        const matchedPage = CONFIGURABLE_PAGES.find(c => {
            return publicPages.includes(c.key) && (req.path === c.path || req.path.startsWith(c.path + '/'));
        });
        if (matchedPage) {
            const ok = await checkPasskey(matchedPage.key, req);
            if (!ok) {
                res.redirect(`/passkey?page=${matchedPage.key}&redirect=${encodeURIComponent(req.originalUrl)}`);
                return;
            }
            (req as any).user = { role: 'GUEST', username: 'Guest' };
            return next();
        }
        return authenticateUser(req, res, next);
    });
    
    app.get('/', (req: Request, res: Response): void => {
        res.redirect("/dashboard");
    });
    app.get('/update-password', (req: Request, res: Response): void => {
        res.render('pages/user/update_password', { 
            title: 'Cập nhật mật khẩu',
            activePage: 'users',
        });
    });
    app.get('/features', discordController.index.bind(discordController));
    app.use('/dashboard', HomeRoute);
    app.use('/users', UserRoute);
    app.use('/settings', SettingRoute);
    app.use('/otp', OtpRoute);
    app.use('/discord', DiscordRoute)
}