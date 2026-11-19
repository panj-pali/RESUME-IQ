
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true
});

// Generate interview report
export const generateInterviewReport = async ({
    jobDescription,
    selfDescription,
    resumeFile,
    preparationDays = 7
}) => {
    const formData = new FormData();

    formData.append("jobDescription", jobDescription);
    formData.append("selfDescription", selfDescription);
    formData.append("resume", resumeFile);
    formData.append("preparationDays", String(preparationDays));

    const response = await api.post(
        "/api/interview/",
        formData
    );

    return response.data;
};

// Get report by ID
export const getInterviewReportById = async (interviewId) => {
    const response = await api.get(
        `/api/interview/report/${interviewId}`
    );

    return response.data;
};

// Get all interview reports
export const getAllInterviewReports = async () => {
    const response = await api.get("/api/interview/");

    console.log("ALL REPORTS:", response.data);

    return response.data;
};

// Generate resume PDF
export const generateResumePdf = async ({
    interviewReportId
}) => {
    const response = await api.post(
        `/api/interview/resume/pdf/${interviewReportId}`,
        null,
        {
            responseType: "blob"
        }
    );

    return response.data;
};
