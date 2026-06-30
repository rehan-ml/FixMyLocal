require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const path = require('path');
app.use(express.static(path.join(__dirname, '.')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => {
  res.json({ status: 'FixMyLocal API running!' });
});

async function callGemini(contents) {
  const body = JSON.stringify({ contents });
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      body,
      compress: false
    }
  );
  const data = await response.json();
  console.log('Gemini response:', JSON.stringify(data).slice(0, 300));
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

app.post('/analyze', async (req, res) => {
  try {
    const { category, severity, desc, imageData } = req.body;

    const prompt = `You are an AI assistant for FixMyLocal, a civic issue reporting platform in India.

A user has submitted a report with the following details:
- Category: ${category}
- Severity: ${severity}
- Description: ${desc}

FIRST, analyze if the uploaded image shows a real civic/infrastructure issue (pothole, broken light, water leak, garbage, damaged road, sewer problem, fallen tree etc.).

If the image is a selfie, meme, random photo, cartoon, animal, food, person, or anything NOT related to a civic infrastructure problem, respond with:
{"spam": true, "reason": "brief reason why this is not a valid civic issue"}

If it IS a valid civic issue, respond with:
{"spam": false, "category": "one of: Pothole/Road Damage, Broken Streetlight, Water Leakage, Garbage/Waste, Fallen Tree, Sewer/Drainage, Infrastructure", "severity": "one of: Low, Medium, High", "priority": "one of: Low Priority, Normal Priority, High Priority, Emergency", "department": "appropriate department e.g. Public Works Department, Municipal Corporation, Water Authority, Electricity Board", "estimated_resolution": "e.g. 24-48 hours, 3-5 days, 1-2 weeks", "summary": "1-2 sentence summary of the issue and its community impact.", "action_required": "specific action officials should take"}

Respond ONLY with valid JSON. No markdown, no backticks.`;

    const messages = [{ role: 'user', parts: [{ text: prompt }] }];

    if (imageData) {
      const base64 = imageData.split(',')[1];
      const mimeType = imageData.split(';')[0].split(':')[1];
      messages[0].parts.unshift({ inline_data: { mime_type: mimeType, data: base64 } });
    }

    const text = await callGemini(messages);
    const cleaned = text.replace(/```json|```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        spam: false,
        category: category || 'Infrastructure',
        severity: severity || 'Medium',
        priority: 'Normal Priority',
        department: 'Municipal Corporation',
        estimated_resolution: '3-5 days',
        summary: 'Issue reported and categorized.',
        action_required: 'Inspection required.'
      };
    }
    
    res.json(parsed);
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;
    const allMessages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood! I am FixMyLocal AI assistant ready to help.' }] },
      ...messages
    ];
    const reply = await callGemini(allMessages);
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat failed' });
  }
});

app.post('/city-report', async (req, res) => {
  try {
    const { prompt } = req.body;
    const report = await callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
    res.json({ report });
  } catch (err) {
    console.error('Report error:', err.message);
    res.status(500).json({ error: 'Report generation failed' });
  }
});

app.post('/complaint', async (req, res) => {
  try {
    const { prompt } = req.body;
    const letter = await callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
    res.json({ letter });
  } catch (err) {
    console.error('Complaint error:', err.message);
    res.status(500).json({ error: 'Letter generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FixMyLocal API running on port ${PORT}`));