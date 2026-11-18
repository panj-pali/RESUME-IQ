
const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
});

// =====================================
// GEMINI RETRY FUNCTION
// =====================================

const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

async function generateWithRetry(requestData) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await ai.models.generateContent(requestData);
        } catch (error) {
            const isTemporaryError =
                error.status === 503 ||
                error.status === 429 ||
                error.message?.includes("503") ||
                error.message?.includes("429");

            if (!isTemporaryError || attempt === 3) {
                throw error;
            }

            console.log(`Gemini retry attempt: ${attempt}`);

            await sleep(attempt * 3000);
        }
    }
}

// =====================================
// INTERVIEW REPORT SCHEMA
// =====================================

const interviewReportSchema = z.object({

    matchScore: z.number().min(0).max(100),

    technicalQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string()
        })
    ).min(10),

    behavioralQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string()
        })
    ).min(8),

    skillGaps: z.array(
        z.object({
            skill: z.string(),
            severity: z.enum(["low", "medium", "high"])
        })
    ),

    preparationPlan: z.array(
        z.object({
            day: z.number(),
            focus: z.string(),
            tasks: z.array(z.string())
        })
    ),

    title: z.string()

});

// =====================================
// GENERATE INTERVIEW REPORT
// =====================================

async function generateInterviewReport({
    resume,
    selfDescription,
    jobDescription,
    preparationDays = 7
}) {

    const days = Number(preparationDays);

    if (!Number.isInteger(days) || days < 1 || days > 90) {
        throw new Error("Preparation days must be between 1 and 90");
    }

    const prompt = `

Generate a COMPLETE interview report for the candidate.

CANDIDATE RESUME:
${resume}

SELF DESCRIPTION:
${selfDescription}

JOB DESCRIPTION:
${jobDescription}

IMPORTANT INSTRUCTIONS:

1. TECHNICAL QUESTIONS

Generate at least 10 relevant technical questions.

Cover technologies, projects, skills, databases, APIs,
authentication, security, performance and other relevant topics.

Every question must contain:
- question
- intention
- answer

2. BEHAVIORAL QUESTIONS

Generate at least 8 relevant behavioral questions.

Cover teamwork, projects, problem solving, strengths,
weaknesses, pressure, deadlines and career goals.

Every question must contain:
- question
- intention
- answer

3. SKILL GAPS

Compare the candidate's resume with the job description.

Generate relevant skill gaps.

Every skill gap must contain:
- skill
- severity

Severity must be low, medium or high.

4. PREPARATION PLAN

Generate EXACTLY ${days} DAYS.

The preparationPlan must contain exactly ${days} objects.

Day numbers must start from 1 and continue sequentially
up to ${days}.

Each day must contain:
- day
- focus
- tasks

Each day must have multiple practical tasks.

Distribute the preparation topics across all ${days} days.
Do not generate fewer or more days.

5. MATCH SCORE

Generate a score between 0 and 100 based on the
candidate's match with the job description.

6. TITLE

Generate the appropriate job title from the job description.

FINAL REQUIREMENT:

Return only valid JSON containing:
matchScore,
technicalQuestions,
behavioralQuestions,
skillGaps,
preparationPlan,
title.

Technical questions: at least 10.
Behavioral questions: at least 8.
Preparation plan: exactly ${days} days.

`;

    // =====================================
    // DYNAMIC JSON SCHEMA
    // =====================================

    const response = await generateWithRetry({

        model: "gemini-3.5-flash-lite",

        contents: prompt,

        config: {

            responseMimeType: "application/json",

            responseJsonSchema: {

                type: "object",

                properties: {

                    matchScore: {
                        type: "number",
                        minimum: 0,
                        maximum: 100
                    },

                    technicalQuestions: {
                        type: "array",
                        minItems: 10,
                        items: {
                            type: "object",
                            properties: {
                                question: { type: "string" },
                                intention: { type: "string" },
                                answer: { type: "string" }
                            },
                            required: [
                                "question",
                                "intention",
                                "answer"
                            ]
                        }
                    },

                    behavioralQuestions: {
                        type: "array",
                        minItems: 8,
                        items: {
                            type: "object",
                            properties: {
                                question: { type: "string" },
                                intention: { type: "string" },
                                answer: { type: "string" }
                            },
                            required: [
                                "question",
                                "intention",
                                "answer"
                            ]
                        }
                    },

                    skillGaps: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                skill: { type: "string" },
                                severity: {
                                    type: "string",
                                    enum: ["low", "medium", "high"]
                                }
                            },
                            required: ["skill", "severity"]
                        }
                    },

                    preparationPlan: {
                        type: "array",
                        minItems: days,
                        maxItems: days,
                        items: {
                            type: "object",
                            properties: {
                                day: { type: "number" },
                                focus: { type: "string" },
                                tasks: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            },
                            required: ["day", "focus", "tasks"]
                        }
                    },

                    title: {
                        type: "string"
                    }

                },

                required: [
                    "matchScore",
                    "technicalQuestions",
                    "behavioralQuestions",
                    "skillGaps",
                    "preparationPlan",
                    "title"
                ]

            }

        }

    });

    // =====================================
    // VALIDATE AI RESPONSE
    // =====================================

    const report = interviewReportSchema.parse(
        JSON.parse(response.text)
    );

    // Extra validation for day sequence
    if (report.preparationPlan.length !== days) {
        throw new Error(
            `Expected ${days} preparation days, received ${report.preparationPlan.length}`
        );
    }

    report.preparationPlan.forEach((item, index) => {
        if (item.day !== index + 1) {
            throw new Error(
                `Invalid preparation day number at position ${index + 1}`
            );
        }
    });

    console.log("Technical Questions:", report.technicalQuestions.length);
    console.log("Behavioral Questions:", report.behavioralQuestions.length);
    console.log("Preparation Days:", report.preparationPlan.length);

    return report;
}

// =====================================
// GENERATE PDF FROM HTML
// =====================================

async function generatePdfFromHtml(htmlContent) {

    const puppeteerModule = process.env.VERCEL
        ? await import("puppeteer-core")
        : await import("puppeteer");

    const puppeteer = puppeteerModule.default;
    const launchOptions = {};

    if (process.env.VERCEL) {
        const chromium = require("@sparticuz/chromium").default;

        launchOptions.args = chromium.args;
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.headless = true;
    }

    const browser = await puppeteer.launch(launchOptions);

    try {
        const page = await browser.newPage();

        await page.setContent(htmlContent, {
            waitUntil: "networkidle0"
        });

        return await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "10mm",
                bottom: "10mm",
                left: "10mm",
                right: "10mm"
            }
        });

    } finally {
        await browser.close();
    }
}

// =====================================
// GENERATE RESUME PDF
// =====================================

async function generateResumePdf({
    resume,
    selfDescription,
    jobDescription
}) {

    const resumePdfSchema = z.object({
        html: z.string()
    });

    const prompt = `Generate a professional, ATS-friendly resume using the following information:

Resume: ${resume}

Self Description: ${selfDescription}

Job Description: ${jobDescription}

Return a JSON object with a single field "html" containing a complete HTML document.

Requirements:
- Use only candidate-provided information.
- Do not invent qualifications or experience.
- Keep the resume concise and ATS-friendly.
- Aim for 1-2 pages.
- Use a simple single-column layout.
- Use Arial or a similar font.
- Include CSS inside a style tag.
- Keep spacing compact and consistent.
- Center the candidate name and contact information.
- Ensure the HTML is valid and suitable for A4 PDF printing.`;

    const response = await generateWithRetry({

        model: "gemini-3.5-flash-lite",

        contents: prompt,

        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema)
        }

    });

    const jsonContent = JSON.parse(response.text);

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html);

    return pdfBuffer;
}

// =====================================
// EXPORT FUNCTIONS
// =====================================

module.exports = {
    generateInterviewReport,
    generateResumePdf
};
