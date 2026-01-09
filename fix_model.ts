import { Setting } from './models/setting.js';
import dotenv from "dotenv";

dotenv.config();

async function fixModel() {
    try {
        const settingM = new Setting();
        // Fallback to a Lite model which usually has better availability/quota separation
        const targetModel = 'gemini-2.0-flash-lite-preview-02-05';
        console.log(`Updating DB to: "${targetModel}"`);
        
        await settingM.save({ key: 'ai_model', value: targetModel }, { key: 'ai_model' });
        
        console.log('✅ Successfully updated ai_model in database.');
    } catch (error) {
        console.error('❌ Error updating model:', error);
    } finally {
        process.exit(0);
    }
}

fixModel();
