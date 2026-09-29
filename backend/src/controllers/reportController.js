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

module.exports = {
  getMyTaskReport,
  downloadMyTaskReportPDF,
  downloadMyTaskReportExcel
};
