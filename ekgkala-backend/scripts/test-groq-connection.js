const mongoose = require('mongoose');
const Groq = require('groq-sdk');
const Settings = require('./models/Settings');
require('dotenv').config();

async function test() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).select('+aiConfig.apiKey');

        if (!settings) {
            console.error('Settings not found!');
            return;
        }

        const apiKey = settings.aiConfig?.apiKey;
        console.log('API Key from DB:', apiKey ? (apiKey.substring(0, 10) + '...') : 'MISSING');

        if (!apiKey) {
            console.error('API Key is missing in DB.');
            return;
        }

        console.log('Initializing Groq...');
        const groq = new Groq({ apiKey });

        console.log('Sending test request...');
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: 'Hello' }],
            model: 'llama-3.3-70b-versatile',
        });

        console.log('Response:', completion.choices[0]?.message?.content);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

test();
