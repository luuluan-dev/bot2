import { User } from "../models/user.js";
import { BaseController } from "./Base.controller.js";
import { Response } from 'express';
import { Request } from "../interfaces/request.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class HomeController extends BaseController {
    async index(req: Request, res: Response): Promise<void> {
        const users = await new User().findMany({
            where: {
                NOT: {
                    OR: [
                        { role: 'SUPER_ADMIN' },
                        { id: req.user?.id }
                    ]
                }
            },
            select: {
                id: true,
                username: true,
                role: true,
                status: true
            }
        });
        res.render('pages/home', { 
            title: 'Users',
            activePage: 'home',
            users
        });
    }
    async dashboard(req: Request, res: Response): Promise<void> {
        const commandsDir = path.resolve(__dirname, '../services/commands');
        const slashDir = path.resolve(__dirname, '../services/slashCommands');
        const commands: { name: string; description: string }[] = [];
        const slashCommands: { name: string; description: string }[] = [];

        try {
            const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js') && !f.startsWith('_') && f !== 'types.js');
            for (const file of files) {
                try {
                    const mod = await import(path.join(commandsDir, file));
                    const cmd = mod.default;
                    if (cmd?.name && cmd?.description) commands.push({ name: cmd.name, description: cmd.description });
                } catch {}
            }
        } catch {}

        try {
            const files = fs.readdirSync(slashDir).filter(f => f.endsWith('.js'));
            for (const file of files) {
                try {
                    const mod = await import(path.join(slashDir, file));
                    if (mod.data?.name && mod.data?.description) slashCommands.push({ name: mod.data.name, description: mod.data.description });
                } catch {}
            }
        } catch {}

        res.render('pages/dashboard', { title: 'Dashboard', activePage: 'dashboard', commands, slashCommands });
    }

    async feature(req: Request, res: Response): Promise<void> {
        res.render('pages/feature', {
            title: 'Features',
            activePage: 'features'
        });
    }
}