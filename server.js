require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Multer memory storage (files temporary memory mein rahengi)
const upload = multer({ storage: multer.memoryStorage() });

// AI Smart File Organizer Endpoint
app.post('/api/organize-file', async (req, res) => {
    try {
        const { fileName, fileType, fileContent } = req.body;

        if (!fileName) {
            return res.status(400).json({ error: 'File name is required' });
        }

        const prompt = `
You are an expert AI Smart File Organizer and Data Classifier.
Analyze the following file details:
- File Name: "${fileName}"
- File Type / Extension: "${fileType || 'Unknown'}"
- Content / Extracted Snippet: "${fileContent ? fileContent.slice(0, 3000) : 'No direct text content, analyze by file name and extension.'}"

Please classify and organize this file by returning ONLY a valid JSON object (no markdown formatting, no backticks, no extra words) with these exact keys:
{
  "category": "One standard folder name (e.g., Invoices & Receipts, Resumes & Careers, Academic & Notes, Legal & Contracts, Code & Development, Media & Images, Personal, Miscellaneous)",
  "suggestedFileName": "A clean, standardized, descriptive file name with extension (e.g., Radhika_Software_Resume_2026.pdf or Electricity_Bill_June2026.pdf)",
  "summary": "A 1-2 sentence concise summary of what this file is about",
  "tags": ["tag1", "tag2", "tag3"],
  "priority": "High / Medium / Low"
}
`;

        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openrouter/free",
                messages: [
                    { role: "user", content: prompt }
                ],
                max_tokens: 1000
            })
        });

        const data = await openRouterResponse.json();

        if (data.error) {
            console.error("OpenRouter API Error:", data.error);
            return res.status(500).json({ error: data.error.message || 'AI API Error' });
        }

        let rawReply = data.choices[0].message.content.trim();

        // Agar response markdown code fences (```json ... ```) ke sath aaye toh clean karein
        if (rawReply.startsWith('```')) {
            rawReply = rawReply.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
        }

        const parsedAnalysis = JSON.parse(rawReply);

        return res.json({
            success: true,
            analysis: parsedAnalysis
        });

    } catch (err) {
        console.error("Server execution error:", err);
        return res.status(500).json({ error: "Failed to process file with AI" });
    }
});

app.listen(PORT, () => {
    console.log(`AI Smart File Organizer Server running at http://localhost:${PORT}`);
});