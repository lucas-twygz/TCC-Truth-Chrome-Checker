const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Image verification endpoint
router.post('/verify-image', upload.single('image'), async (req, res) => {
    try {
        const { apiKeyGemini, context } = req.body;
        
const googleNewsSearch = require("./googleNewsSearch");
        if (!apiKeyGemini) {
            return res.status(400).json({ error: "API key is required" });
        }

        if (!req.file) {
            return res.status(400).json({ error: "Image file is required" });
        }

        const genAI = new GoogleGenerativeAI(apiKeyGemini);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

        // Convert image to base64
        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');
        const mimeType = req.file.mimetype;

        const now = new Date();
        const datetime = now.toISOString();
        const prompt = `
Date/time: ${datetime}
Analyze the image and answer in English. Output a probability (0-100%) of being real, main indicators, and a short explanation. Format: "Probability: X% | Indicators: [list] | Analysis: [brief explanation]"
`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: mimeType
                }
            }
        ]);

        const response = result.response.text();
        
        res.json({
            status: "success",
            analysis: response,
            imageInfo: {
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });

    } catch (error) {
        console.error("Error in image verification:", error);
        res.status(500).json({ 
            error: "Failed to analyze image", 
            details: error.message 
        });
    }
});

module.exports = router;
