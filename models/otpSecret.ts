import { config } from "../config.js";
const repoPath: string = config.repoPath || 'mongodb';
import Base from "./base.js";
const { OtpSecretRepo } = await import(`../repo/${repoPath}/otpSecret.js`);

export class OtpSecret extends Base {
    constructor() {
        super(new OtpSecretRepo());
    }

    async getAll(): Promise<{ id: string; name: string; value: string }[]> {
        return this.repo.findMany({ select: { id: true, name: true, value: true } });
    }

    async getByName(name: string): Promise<{ id: string; name: string; value: string } | null> {
        return this.repo.findFirst({ name }, { id: true, name: true, value: true });
    }
}
