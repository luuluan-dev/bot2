import dotenv from 'dotenv';

dotenv.config();

async function listModels() {
    try {
        const listModelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.AI_API_KEY}`);
        const data = await listModelsResponse.json();
        if (data.models) {
            const available = data.models
                .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''));
            console.log('Available models for generateContent:', available);
        } else {
            console.log('No models found:', data);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

listModels();
