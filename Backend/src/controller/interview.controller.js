
require("@napi-rs/canvas");

const pdfParse = require("pdf-parse");

const {
    generateInterviewReport,
    generateResumePdf
} = require("../service/ai.service");

const interviewReportModel = require("../model/interviewReport.model");


/**
 * Generate interview report
 */
async function generateInterViewReportController(req, res) {
    try {

        // 1. Check uploaded resume
        if (!req.file) {
            return res.status(400).json({
                message: "Please upload your resume PDF."
            });
        }

        // 2. Get data from frontend
        const {
            selfDescription,
            jobDescription,
            preparationDays = 7
        } = req.body;

        // 3. Validate required fields
        if (!selfDescription || !jobDescription) {
            return res.status(400).json({
                message: "Self description and job description are required."
            });
        }

        // 4. Validate preparation days
        const days = Number(preparationDays);

        if (!Number.isInteger(days) || days < 1 || days > 90) {
            return res.status(400).json({
                message: "Preparation days must be between 1 and 90."
            });
        }

        // 5. Extract resume text
        const resumeContent = await (
            new pdfParse.PDFParse(
                Uint8Array.from(req.file.buffer)
            )
        ).getText();

        // 6. Generate AI report
        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            preparationDays: days
        });

        // 7. Save report in MongoDB
        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        });

        // 8. Send response
        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        });

    } catch (error) {

        console.error("Generate interview report error:", error);

        return res.status(500).json({
            message: "Failed to generate interview report.",
            error: error.message
        });

    }
}


/**
 * Get interview report by ID
 */
async function getInterviewReportByIdController(req, res) {

    try {

        const { interviewId } = req.params;

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewId,
            user: req.user.id
        });

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        return res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport
        });

    } catch (error) {

        console.error("Get interview report error:", error);

        return res.status(500).json({
            message: "Failed to fetch interview report."
        });

    }
}


/**
 * Get all interview reports
 */
async function getAllInterviewReportsController(req, res) {

    try {

        const interviewReports = await interviewReportModel
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("-resume");

        return res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        });

    } catch (error) {

        console.error("Get reports error:", error);

        return res.status(500).json({
            message: "Failed to fetch reports."
        });

    }
}


/**
 * Generate resume PDF
 */
async function generateResumePdfController(req, res) {

    try {

        const { interviewReportId } = req.params;

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewReportId,
            user: req.user.id
        });

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        const {
            resume,
            jobDescription,
            selfDescription
        } = interviewReport;

        const pdfBuffer = await generateResumePdf({
            resume,
            jobDescription,
            selfDescription
        });

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        });

        return res.send(pdfBuffer);

    } catch (error) {

        console.error("Generate resume PDF error:", error);

        return res.status(500).json({
            message: "Failed to generate resume PDF."
        });

    }
}


module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController
};