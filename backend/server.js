const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
app.use(express.json());
app.use(cors());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = 'gemini-2.5-pro';

// 1. A-F Job Evaluation & Scoring
app.post('/api/evaluate-job', async (req, res) => {
    try {
        const { userProfile, jobDescription } = req.body;
        
        const prompt = `Evaluate this job description against the user profile using the career-ops framework logic.
        
User Profile:
${JSON.stringify(userProfile, null, 2)}

Job Description:
${jobDescription}`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallScore: { type: Type.NUMBER, description: "Scale 1.0 to 5.0" },
                        grades: {
                            type: Type.OBJECT,
                            properties: {
                                skillAlignment: { type: Type.STRING, description: "A through F" },
                                cultureFit: { type: Type.STRING, description: "A through F" },
                                compensationMatching: { type: Type.STRING, description: "A through F" },
                                growthPotential: { type: Type.STRING, description: "A through F" }
                            }
                        },
                        gapAnalysis: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Missing skills or requirements" },
                        verdict: { type: Type.STRING, description: "Quick summary of why it fits or doesn't" }
                    },
                    required: ["overallScore", "grades", "gapAnalysis", "verdict"]
                }
            }
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 2. ATS-Optimized CV & Resume Tailoring
app.post('/api/tailor-resume', async (req, res) => {
    try {
        const { masterCvMarkdown, jobDescription } = req.body;
        
        const prompt = `Tailor the user's master CV to the provided job description. 
Rule: NEVER invent or hallucinate professional experience, dates, or certifications. If a critical skill is missing, DO NOT add it.
        
Master CV Markdown:
${masterCvMarkdown}

Job Description:
${jobDescription}`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tailoredCvMarkdown: { type: Type.STRING, description: "Full tailored resume text in valid Markdown" },
                        keywordsTargeted: { type: Type.ARRAY, items: { type: Type.STRING }, description: "ATS keywords integrated into the text" },
                        changesMade: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Brief list of bullet points altered for visibility" }
                    },
                    required: ["tailoredCvMarkdown", "keywordsTargeted", "changesMade"]
                }
            }
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Automated Portal & Career Page Processing
app.post('/api/process-portal', async (req, res) => {
    try {
        const { domSnippet } = req.body;
        
        const prompt = `Extract raw metadata from the scraped job page DOM snippet.
        
DOM Snippet:
${domSnippet}`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        companyName: { type: Type.STRING },
                        roleTitle: { type: Type.STRING },
                        location: { type: Type.STRING },
                        salaryRange: { type: Type.STRING },
                        strictRequirements: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["companyName", "roleTitle", "location", "salaryRange", "strictRequirements"]
                }
            }
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Parallel Batch Processing
app.post('/api/batch-evaluate', async (req, res) => {
    try {
        const { userProfile, jobs } = req.body; // jobs is an array of job descriptions
        
        const prompt = `Evaluate an array of multiple job descriptions at once against the user profile.
        
User Profile:
${JSON.stringify(userProfile, null, 2)}

Jobs:
${JSON.stringify(jobs, null, 2)}`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        batchEvaluations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    jobIndex: { type: Type.INTEGER, description: "Maps back to the input array index" },
                                    companyName: { type: Type.STRING },
                                    roleTitle: { type: Type.STRING },
                                    overallScore: { type: Type.NUMBER },
                                    primaryGap: { type: Type.STRING }
                                },
                                required: ["jobIndex", "companyName", "roleTitle", "overallScore", "primaryGap"]
                            }
                        }
                    },
                    required: ["batchEvaluations"]
                }
            }
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Interview Prep & AI Simulation Debrief
app.post('/api/interview-prep', async (req, res) => {
    try {
        const { mode, userProfile, targetRole, interviewData } = req.body;
        // mode should be 'A', 'B', or 'C'
        let schema;
        let prompt = `Acting as an interview prep AI agent from the career-ops framework.\nUser Profile:\n${JSON.stringify(userProfile, null, 2)}\nTarget Role:\n${targetRole}\n`;

        if (mode === 'A') {
            prompt += `Task: Create a time-blocked interview prep plan.\nAdditional Info: ${JSON.stringify(interviewData)}`;
            schema = {
                type: Type.OBJECT,
                properties: {
                    timeBlockedAgenda: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                day: { type: Type.STRING },
                                focusTopic: { type: Type.STRING },
                                suggestedResources: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ["day", "focusTopic", "suggestedResources"]
                        }
                    }
                },
                required: ["timeBlockedAgenda"]
            };
        } else if (mode === 'B') {
            prompt += `Task: Act as a Mock Interview Agent and ask a targeted interview question.\nAdditional Info: ${JSON.stringify(interviewData)}`;
            schema = {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING, description: "Single targeted interview question" },
                    focusArea: { type: Type.STRING, description: "'technical' or 'behavioral'" }
                },
                required: ["question", "focusArea"]
            };
        } else if (mode === 'C') {
            prompt += `Task: Provide a debrief from a mock interview simulation.\nInterview Transcript or Notes:\n${JSON.stringify(interviewData)}`;
            schema = {
                type: Type.OBJECT,
                properties: {
                    detectedGaps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mistakes made during the interview" },
                    profileUpdates: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Topics to append to user's improvement tracker" }
                },
                required: ["detectedGaps", "profileUpdates"]
            };
        } else {
            return res.status(400).json({ error: "Invalid mode. Use 'A', 'B', or 'C'." });
        }

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema
            }
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 6. LinkedIn & Cold Email Outreach Engine
app.post('/api/outreach', async (req, res) => {
    try {
        const { userProfile, targetCompany, targetContact } = req.body;
        
        const prompt = `Draft three distinct high-conversion outreach iterations for the user to contact someone.
        
User Profile:
${JSON.stringify(userProfile, null, 2)}

Target Company: ${targetCompany}
Target Contact: ${JSON.stringify(targetContact)}

Generate exactly these three variants: "Short & Direct", "Value-Add / Referral", "Casual Peer Connection".`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        outreachTemplates: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    variant: { type: Type.STRING },
                                    subject: { type: Type.STRING },
                                    body: { type: Type.STRING }
                                },
                                required: ["variant", "subject", "body"]
                            }
                        }
                    },
                    required: ["outreachTemplates"]
                }
            }
        });

        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Career-Ops Backend Orchestration Engine running on port ${PORT}`);
});
