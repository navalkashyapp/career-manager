import { getGenerativeModel } from "firebase/ai";
import { ai } from "../firebase.js";

// We use string literals for types to avoid import issues if Type enum is not exported
const Type = {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    ARRAY: "ARRAY",
    INTEGER: "INTEGER"
};

const modelName = "gemini-2.5-pro";

// Helper to get a model with a specific JSON schema
function getJsonModel(schema) {
    return getGenerativeModel(ai, {
        model: modelName,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });
}

// 1. A-F Job Evaluation & Scoring
export async function evaluateJob(userProfile, jobDescription) {
    const schema = {
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
    };

    const model = getJsonModel(schema);
    const prompt = `Evaluate this job description against the user profile using the career-ops framework logic.
    
User Profile:
${JSON.stringify(userProfile, null, 2)}

Job Description:
${jobDescription}`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

// 2. ATS-Optimized CV & Resume Tailoring
export async function tailorResume(masterCvMarkdown, jobDescription) {
    const schema = {
        type: Type.OBJECT,
        properties: {
            tailoredCvMarkdown: { type: Type.STRING, description: "Full tailored resume text in valid Markdown" },
            keywordsTargeted: { type: Type.ARRAY, items: { type: Type.STRING }, description: "ATS keywords integrated into the text" },
            changesMade: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Brief list of bullet points altered for visibility" }
        },
        required: ["tailoredCvMarkdown", "keywordsTargeted", "changesMade"]
    };

    const model = getJsonModel(schema);
    const prompt = `Tailor the user's master CV to the provided job description. 
Rule: NEVER invent or hallucinate professional experience, dates, or certifications. If a critical skill is missing, DO NOT add it.
    
Master CV Markdown:
${masterCvMarkdown}

Job Description:
${jobDescription}`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

// 3. Automated Portal & Career Page Processing
export async function processPortal(domSnippet) {
    const schema = {
        type: Type.OBJECT,
        properties: {
            companyName: { type: Type.STRING },
            roleTitle: { type: Type.STRING },
            location: { type: Type.STRING },
            salaryRange: { type: Type.STRING },
            strictRequirements: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["companyName", "roleTitle", "location", "salaryRange", "strictRequirements"]
    };

    const model = getJsonModel(schema);
    const prompt = `Extract raw metadata from the scraped job page DOM snippet.
    
DOM Snippet:
${domSnippet}`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

// 4. Parallel Batch Processing
export async function batchEvaluate(userProfile, jobs) {
    const schema = {
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
    };

    const model = getJsonModel(schema);
    const prompt = `Evaluate an array of multiple job descriptions at once against the user profile.
    
User Profile:
${JSON.stringify(userProfile, null, 2)}

Jobs:
${JSON.stringify(jobs, null, 2)}`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

// 5. Interview Prep & AI Simulation Debrief
export async function interviewPrep(mode, userProfile, targetRole, interviewData) {
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
        throw new Error("Invalid mode. Use 'A', 'B', or 'C'.");
    }

    const model = getJsonModel(schema);
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

// 6. LinkedIn & Cold Email Outreach Engine
export async function generateOutreach(userProfile, targetCompany, targetContact) {
    const schema = {
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
    };

    const model = getJsonModel(schema);
    const prompt = `Draft three distinct high-conversion outreach iterations for the user to contact someone.
    
User Profile:
${JSON.stringify(userProfile, null, 2)}

Target Company: ${targetCompany}
Target Contact: ${JSON.stringify(targetContact)}

Generate exactly these three variants: "Short & Direct", "Value-Add / Referral", "Casual Peer Connection".`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}
