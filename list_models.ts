import dotenv from 'dotenv';

dotenv.config();

async function listModels() {
    try {
        const listModelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.AI_API_KEY}`);
        const data = await listModelsResponse.json();
        if (data.models) {
            const geminiModels = data.models
                .filter((m: any) => m.name.includes('gemini') || m.name.includes('flash'))
                .map((m: any) => ({ name: m.name, methods: m.supportedGenerationMethods }));
            console.log('Gemini Models:', JSON.stringify(geminiModels, null, 2));
        } else {
            console.log('No models found or error:', data);
        }
    } catch (error) {
        console.error('Error listing models:', error);
    } finally {
        process.exit(0);
    }
}

listModels();
