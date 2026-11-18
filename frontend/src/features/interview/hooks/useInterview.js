
import { useContext, useEffect } from "react";
import { useParams } from "react-router";

import { InterviewContext } from "../interview.context";

import {
    getAllInterviewReports,
    generateInterviewReport,
    getInterviewReportById,
    generateResumePdf
} from "../servives/interview.api.js";


export const useInterview = () => {

    const context = useContext(InterviewContext);
    const { interviewId } = useParams();

    if (!context) {
        throw new Error(
            "useInterview must be used within an InterviewProvider"
        );
    }

    const {
        loading,
        setLoading,
        report,
        setReport,
        reports,
        setReports
    } = context;


    // Generate interview report
    const generateReport = async ({
        jobDescription,
        selfDescription,
        resumeFile,
        preparationDays = 7
    }) => {

        setLoading(true);

        try {
            const response = await generateInterviewReport({
                jobDescription,
                selfDescription,
                resumeFile,
                preparationDays
            });

            setReport(response.interviewReport);

            return response.interviewReport;

        } catch (error) {

            console.error(
                "Generate Report Error:",
                error.response?.data || error.message
            );

            alert(
                error.response?.data?.message ||
                "Report generate nahi hua."
            );

            return null;

        } finally {
            setLoading(false);
        }
    };


    // Get report by ID
    const getReportById = async (id) => {

        setLoading(true);

        try {
            const response = await getInterviewReportById(id);

            setReport(response.interviewReport);

            return response.interviewReport;

        } catch (error) {

            console.error(
                "Get Report Error:",
                error.response?.data || error.message
            );

            return null;

        } finally {
            setLoading(false);
        }
    };


    // Get all reports
    const getReports = async () => {

        setLoading(true);

        try {
            const response = await getAllInterviewReports();

            setReports(response.interviewReports || []);

            return response.interviewReports || [];

        } catch (error) {

            console.error(
                "Get All Reports Error:",
                error.response?.data || error.message
            );

            return [];

        } finally {
            setLoading(false);
        }
    };


    // Download resume PDF
    const getResumePdf = async (interviewReportId) => {

        setLoading(true);

        try {
            const response = await generateResumePdf({
                interviewReportId
            });

            const url = window.URL.createObjectURL(
                new Blob([response], {
                    type: "application/pdf"
                })
            );

            const link = document.createElement("a");

            link.href = url;
            link.download = `resume_${interviewReportId}.pdf`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(url);

        } catch (error) {

            console.error(
                "PDF Download Error:",
                error.response?.data || error.message
            );

            alert("PDF download nahi hua.");

        } finally {
            setLoading(false);
        }
    };


    // Load report or all reports
    useEffect(() => {

        if (interviewId) {
            getReportById(interviewId);
        } else {
            getReports();
        }

    }, [interviewId]);


    return {
        loading,
        report,
        reports,
        generateReport,
        getReportById,
        getReports,
        getResumePdf
    };
};
