const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function test() {
    console.log("Testing Gemini API with Key:", process.env.AI_API_KEY ? "Present" : "Missing");
    const genAI = new GoogleGenerativeAI(process.env.AI_API_KEY);
    try {
        console.log("Attempting to generate content with gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Response:", result.response.text());
    } catch (error) {
        console.error("Error with gemini-1.5-flash:", error.message);

        try {
            console.log("Attempting to generate content with gemini-pro...");
            const model2 = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result2 = await model2.generateContent("Hello");
            console.log("Response:", result2.response.text());
        } catch (err2) {
            console.error("Error with gemini-pro:", err2.message);
        }
    }
}

test();
