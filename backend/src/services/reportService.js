const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Task = require('../models/Task');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Venture = require('../models/Venture');
const User = require('../models/User');
const ReportEmail = require('../models/ReportEmail');
const AppError = require('../utils/AppError');
const { resolveEmployee } = require('../utils/resolveEmployee');
const emailService = require('./emailService');
const notificationService = require('./notificationService');
const { logActivity } = require('./activityService');
const { normalizeRole, checkPermission } = require('../config/rbac');

/**
 * Helper to compute human-readable duration between two dates
 */
const formatDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return '—';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${Math.max(1, diffMinutes)}m`;
};

/**
 * Strictly retrieves the authenticated employee's task completion report.
 * Cross-user access is impossible because filter is strictly locked to resolveEmployee(user)._id
 */
const getMyTaskReport = async (user, options = {}) => {
  const employee = await resolveEmployee(user);

  if (!employee) {
    return {
      employee: {
        name: user.name || 'User',
        employeeId: 'EMP-000',
        department: user.department || 'General',
        email: user.email || '',
        role: user.role || 'Member'
      },
      summary: {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        totalPoints: 0
      },
      tasks: []
    };
  }

  const {
    search,
    status,
    priority,
    startDate,
    endDate,
    sortBy = 'completedDate',
    sortOrder = 'desc'
  } = options;

  // STRICT SECURITY: Always filter by the authenticated employee's ID
  const query = {
    assignedTo: employee._id
  };

  // Priority filter
  if (priority && priority !== 'all') {
    query.priority = priority;
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endD;
    }
  }

  // Text search on task title or description
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ title: searchRegex }, { description: searchRegex }];
  }

  // Fetch all tasks for this employee
  const rawTasks = await Task.find(query)
    .populate('venture', 'name key')
    .populate('project', 'name')
    .populate('assignedBy', 'name email')
    .lean();

  const now = new Date();

  // Process & format tasks with computed statuses and durations
  let formattedTasks = rawTasks.map((t) => {
    const isCompleted = t.status === 'Completed';
    const isOverdue = !isCompleted && t.deadline && new Date(t.deadline) < now;

    let displayStatus = t.status;
    if (isOverdue) {
      displayStatus = 'Overdue';
    }

    const assignedDate = t.createdAt;
    const completedDate = t.completedDate || (isCompleted ? t.updatedAt : null);
    const duration = t.completionDuration || (completedDate ? formatDuration(assignedDate, completedDate) : '—');
    const points = t.rewardPointAwarded || isCompleted ? 1 : 0;

    return {
      taskId: t._id,
      taskName: t.title,
      description: t.description || '',
      assignedDate,
      dueDate: t.deadline || null,
      completedDate,
      status: displayStatus,
      rawStatus: t.status,
      priority: t.priority || 'Medium',
      assignedBy: t.assignedBy?.name || 'Administrator',
      completionRemarks: t.completionRemarks || (isCompleted ? 'Completed successfully' : 'Pending completion'),
      completionDuration: duration,
      pointsEarned: points,
      project: t.project?.name || 'General',
      venture: t.venture?.name || 'Thenam'
    };
  });

  // Calculate summary metrics across all employee tasks
  const totalTasks = formattedTasks.length;
  const completedTasks = formattedTasks.filter((t) => t.rawStatus === 'Completed').length;
  const pendingTasks = formattedTasks.filter((t) => t.status === 'Pending').length;
  const inProgressTasks = formattedTasks.filter((t) => t.rawStatus === 'In Progress').length;
  const overdueTasks = formattedTasks.filter((t) => t.status === 'Overdue').length;
  // Consistency rule: 1 completed task = 1 point
  const totalPoints = Math.max(completedTasks, employee.rewardPoints || 0);

  // Apply status filter if provided
  if (status && status !== 'all') {
    if (status === 'Overdue') {
      formattedTasks = formattedTasks.filter((t) => t.status === 'Overdue');
    } else {
      formattedTasks = formattedTasks.filter((t) => t.rawStatus === status || t.status === status);
    }
  }

  // Sorting
  formattedTasks.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (sortBy === 'points') {
      valA = a.pointsEarned;
      valB = b.pointsEarned;
    } else if (sortBy === 'completedDate') {
      valA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
      valB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
    } else if (sortBy === 'dueDate') {
      valA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      valB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    } else if (sortBy === 'assignedDate') {
      valA = a.assignedDate ? new Date(a.assignedDate).getTime() : 0;
      valB = b.assignedDate ? new Date(b.assignedDate).getTime() : 0;
    }

    if (sortOrder === 'asc') {
      return valA > valB ? 1 : -1;
    } else {
      return valA < valB ? 1 : -1;
    }
  });

  return {
    employee: {
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department || 'General',
      email: employee.email,
      role: employee.role,
      avatar: employee.avatar
    },
    summary: {
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      overdueTasks,
      totalPoints
    },
    tasks: formattedTasks
  };
};

/**
 * Generates a branded PDF for the employee's task completion report
 */
const generateMyTaskReportPDF = async (user, options = {}) => {
  const reportData = await getMyTaskReport(user, options);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve({ pdfData, reportData });
      });

      // Brand Header
      doc.rect(40, 40, 515, 60).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
        .text('THENAM SOFTWARE SOLUTIONS', 55, 52);
      doc.fontSize(10).font('Helvetica')
        .fillColor('#94a3b8')
        .text('Thenam ERP Connect — Employee Task Completion Report', 55, 74);

      doc.moveDown(2);

      // Report Metadata Box
      const metaY = 115;
      doc.roundedRect(40, metaY, 515, 65, 8).fill('#f8fafc').stroke('#e2e8f0');

      doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold')
        .text('EMPLOYEE INFORMATION', 55, metaY + 10);
      
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a')
        .text(`Name: ${reportData.employee.name}`, 55, metaY + 25)
        .text(`Employee ID: ${reportData.employee.employeeId}`, 55, metaY + 40)
        .text(`Department: ${reportData.employee.department}`, 230, metaY + 25)
        .text(`Role: ${reportData.employee.role}`, 230, metaY + 40)
        .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 380, metaY + 25)
        .text(`Status: Active`, 380, metaY + 40);

      // Summary Cards
      const cardY = 190;
      const cardWidth = 120;
      const cardHeight = 45;

      const stats = [
        { label: 'Total Tasks', value: reportData.summary.totalTasks, color: '#4f46e5' },
        { label: 'Completed', value: reportData.summary.completedTasks, color: '#16a34a' },
        { label: 'In Progress', value: reportData.summary.inProgressTasks, color: '#0284c7' },
        { label: 'Points Earned', value: `${reportData.summary.totalPoints} pts`, color: '#d97706' }
      ];

      stats.forEach((st, idx) => {
        const x = 40 + idx * (cardWidth + 11);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 6).fill('#ffffff').stroke('#e2e8f0');
        doc.fillColor(st.color).fontSize(14).font('Helvetica-Bold').text(String(st.value), x + 10, cardY + 8);
        doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(st.label, x + 10, cardY + 28);
      });

      // Table Header
      let tableY = 250;
      doc.rect(40, tableY, 515, 22).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
        .text('TASK NAME', 45, tableY + 7, { width: 150 })
        .text('DUE DATE', 200, tableY + 7, { width: 65 })
        .text('COMPLETED', 270, tableY + 7, { width: 75 })
        .text('PRIORITY', 350, tableY + 7, { width: 50 })
        .text('STATUS', 405, tableY + 7, { width: 60 })
        .text('POINTS', 475, tableY + 7, { width: 45, align: 'right' });

      tableY += 22;

      // Table Rows
      const tasksToRender = reportData.tasks.slice(0, 25); // Top 25 for page limits
      tasksToRender.forEach((task, index) => {
        if (tableY > 740) {
          doc.addPage();
          tableY = 40;
          // Re-render header on new page
          doc.rect(40, tableY, 515, 22).fill('#1e293b');
          doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
            .text('TASK NAME', 45, tableY + 7, { width: 150 })
            .text('DUE DATE', 200, tableY + 7, { width: 65 })
            .text('COMPLETED', 270, tableY + 7, { width: 75 })
            .text('PRIORITY', 350, tableY + 7, { width: 50 })
            .text('STATUS', 405, tableY + 7, { width: 60 })
            .text('POINTS', 475, tableY + 7, { width: 45, align: 'right' });
          tableY += 22;
        }

        const bg = index % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, tableY, 515, 20).fill(bg);

        const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
        const completedDateStr = task.completedDate ? new Date(task.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

        doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
          .text(task.taskName.slice(0, 28), 45, tableY + 6, { width: 150, ellipsis: true })
          .text(dueDateStr, 200, tableY + 6, { width: 65 })
          .text(completedDateStr, 270, tableY + 6, { width: 75 })
          .text(task.priority, 350, tableY + 6, { width: 50 })
          .text(task.status, 405, tableY + 6, { width: 60 })
          .font('Helvetica-Bold')
          .text(`+${task.pointsEarned}`, 475, tableY + 6, { width: 45, align: 'right' });

        tableY += 20;
      });

      // Footer
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text('© Thenam Software Solutions — Confidential & Proprietary Report', 40, 785, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generates an Excel workbook (.xlsx) for the employee's task completion report
 */
const generateMyTaskReportExcel = async (user, options = {}) => {
  const reportData = await getMyTaskReport(user, options);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Thenam ERP Connect';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Task Completion Report');

  // Title Row
  sheet.mergeCells('A1:L1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'THENAM SOFTWARE SOLUTIONS — TASK COMPLETION REPORT';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 30;

  // Employee Metadata
  sheet.addRow([]);
  sheet.addRow(['Employee Name:', reportData.employee.name, '', 'Employee ID:', reportData.employee.employeeId]);
  sheet.addRow(['Department:', reportData.employee.department, '', 'Role:', reportData.employee.role]);
  sheet.addRow(['Generated Date:', new Date().toLocaleString(), '', 'Total Points Earned:', reportData.summary.totalPoints]);
  sheet.addRow([]);

  // Bold metadata labels
  [3, 4, 5].forEach((rowNum) => {
    const row = sheet.getRow(rowNum);
    row.getCell(1).font = { bold: true };
    row.getCell(4).font = { bold: true };
  });

  // Table Headers
  const headerRow = sheet.addRow([
    'Task ID',
    'Task Name',
    'Description',
    'Assigned Date',
    'Due Date',
    'Completed Date',
    'Status',
    'Priority',
    'Assigned By',
    'Completion Remarks',
    'Duration',
    'Points Earned'
  ]);
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Table Data
  reportData.tasks.forEach((t) => {
    const row = sheet.addRow([
      String(t.taskId),
      t.taskName,
      t.description,
      t.assignedDate ? new Date(t.assignedDate).toISOString().slice(0, 10) : '—',
      t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '—',
      t.completedDate ? new Date(t.completedDate).toISOString().slice(0, 10) : '—',
      t.status,
      t.priority,
      t.assignedBy,
      t.completionRemarks,
      t.completionDuration,
      t.pointsEarned
    ]);

    row.getCell(12).alignment = { horizontal: 'center' };
  });

  // Column Widths
  sheet.columns = [
    { width: 26 }, // Task ID
    { width: 30 }, // Task Name
    { width: 35 }, // Description
    { width: 14 }, // Assigned Date
    { width: 14 }, // Due Date
    { width: 16 }, // Completed Date
    { width: 14 }, // Status
    { width: 12 }, // Priority
    { width: 18 }, // Assigned By
    { width: 28 }, // Remarks
    { width: 14 }, // Duration
    { width: 14 }  // Points
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, reportData };
};

/**
 * Admin sends an employee task completion report via email.
 * Includes optional PDF, Excel, and task summary.
 */
const sendEmployeeReportEmail = async ({
  adminUser,
  employeeId,
  subject,
  message,
  includeTaskSummary = true,
  includePdf = true,
  includeExcel = false,
  req = null
}) => {
  // 1. Role & Permission verification
  const candidateRoles = [];
  if (req && req.userRole) candidateRoles.push(normalizeRole(req.userRole));
  if (adminUser.userRole) candidateRoles.push(normalizeRole(adminUser.userRole));
  if (adminUser.role) candidateRoles.push(normalizeRole(adminUser.role));
  if (Array.isArray(adminUser.roles)) {
    adminUser.roles.forEach((r) => candidateRoles.push(normalizeRole(r)));
  }
  if (Array.isArray(adminUser.systemRoles)) {
    adminUser.systemRoles.forEach((r) => candidateRoles.push(normalizeRole(r)));
  }

  const uniqueRoles = [...new Set(candidateRoles.filter(Boolean))];

  const privilegedRoles = ['admin', 'founder', 'manager', 'super admin', 'ceo'];
  const hasPrivilegedRole = uniqueRoles.some((r) => privilegedRoles.includes(r));
  const hasRbacPermission = uniqueRoles.some(
    (r) =>
      checkPermission(r, 'reports', 'create') ||
      checkPermission(r, 'reports', 'send') ||
      checkPermission(r, 'reports', 'email') ||
      checkPermission(r, 'reports', 'send_email')
  );

  const isAuthorized = hasPrivilegedRole && hasRbacPermission;

  // Safe debug logging (no sensitive credentials or secrets)
  console.log('[REPORT EMAIL AUTH]', {
    userId: String(adminUser._id || adminUser.id),
    roles: uniqueRoles,
    requiredPermission: 'reports:send_email',
    hasPrivilegedRole,
    hasRbacPermission,
    authorized: isAuthorized
  });

  if (!isAuthorized) {
    throw new AppError('You do not have permission to send employee reports.', 403);
  }

  // 2. Validate employeeId and find employee
  if (!employeeId) {
    throw new AppError('Employee ID is required.', 400);
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new AppError('Employee not found.', 404);
  }

  // 3. Validate employee email
  const recipientEmail = (employee.email || '').trim();
  if (!recipientEmail || !recipientEmail.includes('@')) {
    throw new AppError('Unable to send email. This employee does not have a registered email address.', 400);
  }

  // 4. Retrieve the employee's report data using existing report engine
  let reportData;
  try {
    reportData = await getMyTaskReport(employee);
  } catch (err) {
    console.error('Report data retrieval error:', err);
    throw new AppError('Unable to generate the employee report.', 500);
  }

  // 5. Generate attachments
  const attachments = [];
  const attachmentsList = [];
  const safeName = (employee.name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
  let pdfBuffer = null;
  let excelBuffer = null;
  let pdfFilename = null;
  let xlsxFilename = null;

  if (includePdf) {
    try {
      const { pdfData } = await generateMyTaskReportPDF(employee);
      pdfBuffer = pdfData;
      pdfFilename = `Thenam_Employee_Report_${safeName}.pdf`;
      attachments.push({
        filename: pdfFilename,
        content: pdfData,
        contentType: 'application/pdf'
      });
      attachmentsList.push(pdfFilename);
    } catch (err) {
      console.error('PDF generation error:', err);
      throw new AppError('Unable to generate the employee report PDF.', 500);
    }
  }

  if (includeExcel) {
    try {
      const { buffer } = await generateMyTaskReportExcel(employee);
      excelBuffer = buffer;
      xlsxFilename = `Thenam_Employee_Report_${safeName}.xlsx`;
      attachments.push({
        filename: xlsxFilename,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      attachmentsList.push(xlsxFilename);
    } catch (err) {
      console.error('Excel generation error:', err);
      throw new AppError('Unable to generate the employee report Excel.', 500);
    }
  }

  // 6. Build email HTML and text
  const emailHtml = emailService.buildReportEmailHtml({
    employeeName: employee.name,
    department: employee.department,
    customMessage: message,
    summary: includeTaskSummary ? reportData.summary : null,
    attachmentsList
  });

  const emailText = `Hello ${employee.name},\n\nPlease find your latest task completion report from Thenam ERP Connect.\n\nEmployee: ${employee.name}\nDepartment: ${employee.department || 'General'}\n\nTotal Assigned: ${reportData.summary.totalTasks}\nCompleted: ${reportData.summary.completedTasks}\nIn Progress: ${reportData.summary.inProgressTasks}\nPending: ${reportData.summary.pendingTasks}\nOverdue: ${reportData.summary.overdueTasks}\nPoints Earned: ${reportData.summary.totalPoints}\n\n${message ? `Admin Note:\n${message}\n\n` : ''}This report was generated automatically from Thenam ERP Connect.\n\nRegards,\nAdmin\nThenam Software Solutions`;

  // 7. Send actual email
  try {
    await emailService.sendEmail({
      to: recipientEmail,
      subject: subject || 'Thenam ERP - Employee Task Report',
      html: emailHtml,
      text: emailText,
      attachments
    });
  } catch (err) {
    console.error('Email send error:', err);
    throw new AppError(err.message || 'Unable to send email right now. Please try again.', 500);
  }

  // 8. Resolve recipient User account for in-app notification & ownership
  let recipientUser = null;
  if (employee.email) {
    recipientUser = await User.findOne({ email: new RegExp(`^${employee.email.trim()}$`, 'i') });
  }
  if (!recipientUser && employee.firebaseUid) {
    recipientUser = await User.findOne({ firebaseUid: employee.firebaseUid });
  }
  if (!recipientUser && employee._id) {
    recipientUser = await User.findById(employee._id);
  }
  if (!recipientUser && employee.name) {
    recipientUser = await User.findOne({ name: new RegExp(`^${employee.name.trim()}$`, 'i') });
  }

  const recipientUserId = recipientUser ? recipientUser._id : employee._id;

  // 9. Persist Sent Email Record with attachments and summary
  let reportEmail = null;
  try {
    reportEmail = await ReportEmail.create({
      sender: adminUser._id || adminUser.id,
      senderName: adminUser.name || 'Administrator',
      fromEmail: process.env.MAIL_FROM || 'admin@thenamsoftwaresolutions.com',
      recipient: recipientUserId,
      recipientEmployee: employee._id,
      recipientName: employee.name,
      recipientEmail,
      subject: subject || 'Thenam ERP - Employee Task Report',
      message: message || '',
      emailHtml,
      emailText,
      summary: reportData.summary,
      department: employee.department || 'General',
      hasPdf: !!includePdf && !!pdfBuffer,
      hasExcel: !!includeExcel && !!excelBuffer,
      pdfAttachment: (includePdf && pdfBuffer) ? {
        filename: pdfFilename,
        contentType: 'application/pdf',
        data: pdfBuffer,
        size: pdfBuffer.length
      } : undefined,
      excelAttachment: (includeExcel && excelBuffer) ? {
        filename: xlsxFilename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: excelBuffer,
        size: excelBuffer.length
      } : undefined,
      status: 'SENT',
      sentAt: new Date()
    });
  } catch (emailSaveErr) {
    console.error('Error saving ReportEmail record:', emailSaveErr);
  }

  const emailId = reportEmail ? String(reportEmail._id) : null;

  // 10. Create in-app notification for the target employee
  let notif = null;
  try {
    notif = await notificationService.createNotification({
      userId: recipientUserId,
      title: 'New Employee Report Email',
      message: `${adminUser.name || 'Admin'} sent you your Employee Task Report.`,
      type: 'employee_report_email',
      entityType: 'ReportEmail',
      entityId: reportEmail ? reportEmail._id : null,
      relatedId: reportEmail ? reportEmail._id : null,
      relatedType: 'ReportEmail',
      actionUrl: emailId ? `/reports?emailId=${emailId}` : '/reports',
      icon: 'FileText',
      metadata: {
        emailId,
        reportId: emailId,
        employeeId: String(employee._id),
        employeeName: employee.name,
        senderName: adminUser.name || 'Admin',
        subject: subject || 'Thenam ERP - Employee Task Report',
        hasPdf: !!includePdf && !!pdfBuffer,
        hasExcel: !!includeExcel && !!excelBuffer,
        sentAt: new Date().toISOString()
      }
    });
  } catch (notifErr) {
    console.error('Error creating employee notification:', notifErr);
  }

  // 11. Emit realtime socket notification
  try {
    const { emitToUser } = require('./socketService');
    const realtimePayload = {
      notificationId: notif ? notif._id : null,
      type: 'EMPLOYEE_REPORT_EMAIL',
      title: 'New Employee Report Email',
      message: `${adminUser.name || 'Admin'} sent you your Employee Task Report.`,
      employeeId: String(employee._id),
      emailId,
      reportId: emailId,
      createdAt: new Date().toISOString()
    };
    emitToUser(String(recipientUserId), 'employee:report_email', realtimePayload);
    if (String(employee._id) !== String(recipientUserId)) {
      emitToUser(String(employee._id), 'employee:report_email', realtimePayload);
    }
  } catch (sockErr) {
    // Socket emission is best-effort
  }

  // 12. Record audit log
  await logActivity({
    userId: adminUser._id || adminUser.id,
    userName: adminUser.name || 'Admin',
    action: 'Sent Employee Report Email',
    entity: 'Report',
    entityId: employee._id,
    entityName: `Task Report for ${employee.name}`,
    newValue: {
      adminName: adminUser.name,
      adminId: String(adminUser._id || adminUser.id),
      employeeName: employee.name,
      employeeId: employee.employeeId || String(employee._id),
      recipientEmail,
      subject: subject || 'Thenam ERP - Employee Task Report',
      reportType: 'Task Completion Report',
      pdfAttached: !!includePdf,
      excelAttached: !!includeExcel,
      emailId,
      status: 'Sent',
      timestamp: new Date()
    },
    req
  });

  return {
    success: true,
    emailId,
    recipientEmail,
    employeeName: employee.name,
    attachmentsCount: attachments.length
  };
};

/**
 * Retrieve sent report email details securely
 */
const getReportEmailById = async (emailId, user) => {
  if (!emailId) {
    throw new AppError('Email ID is required.', 400);
  }

  const reportEmail = await ReportEmail.findById(emailId).lean();
  if (!reportEmail) {
    throw new AppError('This email is no longer available.', 404);
  }

  // Security Check:
  const userId = String(user._id || user.id);
  const userRole = normalizeRole(user.userRole || user.role);
  const userRoles = (user.roles || []).map((r) => normalizeRole(r));
  const isAdmin = ['admin', 'founder', 'super admin', 'manager', 'ceo'].includes(userRole) ||
    userRoles.some((r) => ['admin', 'founder', 'super admin', 'manager', 'ceo'].includes(r));

  const isRecipient =
    (reportEmail.recipient && String(reportEmail.recipient) === userId) ||
    (reportEmail.recipientEmployee && String(reportEmail.recipientEmployee) === userId) ||
    (user.email && user.email.toLowerCase() === reportEmail.recipientEmail.toLowerCase());

  if (!isAdmin && !isRecipient) {
    throw new AppError("You don't have permission to view this email.", 403);
  }

  return {
    _id: reportEmail._id,
    sender: reportEmail.sender,
    senderName: reportEmail.senderName,
    fromEmail: reportEmail.fromEmail || 'admin@thenamsoftwaresolutions.com',
    recipient: reportEmail.recipient,
    recipientEmployee: reportEmail.recipientEmployee,
    recipientName: reportEmail.recipientName,
    recipientEmail: reportEmail.recipientEmail,
    subject: reportEmail.subject,
    message: reportEmail.message,
    emailHtml: reportEmail.emailHtml,
    emailText: reportEmail.emailText,
    summary: reportEmail.summary,
    department: reportEmail.department,
    hasPdf: reportEmail.hasPdf,
    hasExcel: reportEmail.hasExcel,
    pdfFilename: reportEmail.pdfAttachment?.filename || null,
    pdfSize: reportEmail.pdfAttachment?.size || 0,
    excelFilename: reportEmail.excelAttachment?.filename || null,
    excelSize: reportEmail.excelAttachment?.size || 0,
    status: reportEmail.status,
    sentAt: reportEmail.sentAt,
    createdAt: reportEmail.createdAt
  };
};

/**
 * Download sent report email attachment securely (PDF / Excel)
 */
const getReportEmailAttachment = async (emailId, type, user) => {
  if (!emailId) {
    throw new AppError('Email ID is required.', 400);
  }

  const reportEmail = await ReportEmail.findById(emailId);
  if (!reportEmail) {
    throw new AppError('This email is no longer available.', 404);
  }

  // Security Check
  const userId = String(user._id || user.id);
  const userRole = normalizeRole(user.userRole || user.role);
  const userRoles = (user.roles || []).map((r) => normalizeRole(r));
  const isAdmin = ['admin', 'founder', 'super admin', 'manager', 'ceo'].includes(userRole) ||
    userRoles.some((r) => ['admin', 'founder', 'super admin', 'manager', 'ceo'].includes(r));

  const isRecipient =
    (reportEmail.recipient && String(reportEmail.recipient) === userId) ||
    (reportEmail.recipientEmployee && String(reportEmail.recipientEmployee) === userId) ||
    (user.email && user.email.toLowerCase() === reportEmail.recipientEmail.toLowerCase());

  if (!isAdmin && !isRecipient) {
    throw new AppError("You don't have permission to view this email.", 403);
  }

  if (type === 'pdf') {
    if (!reportEmail.pdfAttachment || !reportEmail.pdfAttachment.data) {
      throw new AppError('Report attachment is currently unavailable.', 404);
    }
    return {
      buffer: reportEmail.pdfAttachment.data,
      filename: reportEmail.pdfAttachment.filename || 'Employee_Report.pdf',
      contentType: reportEmail.pdfAttachment.contentType || 'application/pdf'
    };
  }

  if (type === 'excel' || type === 'xlsx') {
    if (!reportEmail.excelAttachment || !reportEmail.excelAttachment.data) {
      throw new AppError('Report attachment is currently unavailable.', 404);
    }
    return {
      buffer: reportEmail.excelAttachment.data,
      filename: reportEmail.excelAttachment.filename || 'Employee_Report.xlsx',
      contentType: reportEmail.excelAttachment.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  throw new AppError('Invalid attachment type requested.', 400);
};

module.exports = {
  getMyTaskReport,
  generateMyTaskReportPDF,
  generateMyTaskReportExcel,
  sendEmployeeReportEmail,
  getReportEmailById,
  getReportEmailAttachment
};

