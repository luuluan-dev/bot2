import { BaseRepo } from "./base.js";
export class OtpSecretRepo extends BaseRepo {
    constructor() {
        super({ tableName: "otp_secrets" });
    }
}
