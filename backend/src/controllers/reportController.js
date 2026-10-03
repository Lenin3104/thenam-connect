const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const reportService = require('../services/reportService');

/**
 * GET /api/reports/my-tasks
 * Strictly returns task information for the logged-in employee only
 */
const getMyTaskReport = asyncHandler(async (req, res) => {
  const options = {
    search: req.query.search,
    status: req.query.status,
    priority: req.query.priority,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    sortBy: req.query.sortBy || 'completedDate',
    sortOrder: req.query.sortOrder || 'desc'
  };

  const report = await reportService.getMyTaskReport(req.user, options);
  return success(res, report, 'Employee task report retrieved successfully');
});

/**
 * GET /api/reports/my-tasks/pdf
 * Strictly downloads the authenticated employee's task completion report as PDF
 */
const downloadMyTaskReportPDF = asyncHandler(async (req, res) => {
  const options = {
    search: req.query.search,
    status: req.query.status,
    priority: req.query.priority,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    sortBy: req.query.sortBy || 'completedDate',
    sortOrder: req.query.sortOrder || 'desc'
  };

  const { pdfData, reportData } = await reportService.generateMyTaskReportPDF(req.user, options);

  const filename = `Thenam_Task_Report_${reportData.employee.employeeId || 'ME'}_${new Date().toISOString().slice(0, 10)}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfData.length);

  return res.end(pdfData);
});

/**
 * GET /api/reports/my-tasks/excel
 * Strictly downloads the authenticated employee's task completion report as Excel (.xlsx)
 */
const downloadMyTaskReportExcel = asyncHandler(async (req, res) => {
  const options = {
    search: req.query.search,
    status: req.query.status,
    priority: req.query.priority,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    sortBy: req.query.sortBy || 'completedDate',
    sortOrder: req.query.sortOrder || 'desc'
  };

  const { buffer, reportData } = await reportService.generateMyTaskReportExcel(req.user, options);

  const filename = `Thenam_Task_Report_${reportData.employee.employeeId || 'ME'}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);

  return res.end(buffer);
});

/**
 * POST /api/reports/email
 * Admin sends task report to an employee via email
 */
const sendEmployeeReportEmail = asyncHandler(async (req, res) => {
  const { employeeId, subject, message, includeTaskSummary, includePdf, includeExcel } = req.body;

  const result = await reportService.sendEmployeeReportEmail({
    adminUser: req.user,
    employeeId,
    subject,
    message,
    includeTaskSummary: includeTaskSummary !== false,
    includePdf: includePdf !== false,
    includeExcel: !!includeExcel,
    req
  });

  return success(
    res,
    result,
    `Report email sent successfully to ${result.recipientEmail}`
  );
});

/**
 * GET /api/reports/emails/latest
 * Retrieve latest report email (restricted to recipient or admin)
 */
const getLatestReportEmail = asyncHandler(async (req, res) => {
  const email = await reportService.getLatestReportEmailForUser(req.user, req.query.employeeId);
  return success(res, email, 'Latest report email retrieved successfully');
});

/**
 * GET /api/reports/emails/:id
 * Retrieve sent report email details (restricted to recipient or admin)
 */
const getReportEmail = asyncHandler(async (req, res) => {
  const email = await reportService.getReportEmailById(req.params.id, req.user);
  return success(res, email, 'Report email retrieved successfully');
});

/**
 * GET /api/reports/emails/:id/attachment/:type
 * Download attachment (pdf or excel) (restricted to recipient or admin)
 */
const downloadReportEmailAttachment = asyncHandler(async (req, res) => {
  const { buffer, filename, contentType } = await reportService.getReportEmailAttachment(
    req.params.id,
    req.params.type,
    req.user
  );

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);

  return res.end(buffer);
});

module.exports = {
  getMyTaskReport,
  downloadMyTaskReportPDF,
  downloadMyTaskReportExcel,
  sendEmployeeReportEmail,
  getLatestReportEmail,
  getReportEmail,
  downloadReportEmailAttachment
};

