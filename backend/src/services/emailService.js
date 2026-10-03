const nodemailer = require('nodemailer');

const MAIL_FROM = process.env.MAIL_FROM || 'admin@thenamsoftwaresolutions.com';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || 'admin@thenamsoftwaresolutions.com';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;

/**
 * Creates and caches the Nodemailer transporter instance.
 */
let cachedTransporter = null;

const getTransporter = async () => {
  if (cachedTransporter) return cachedTransporter;

  // 1. If SMTP credentials are fully provided, use real SMTP transporter
  if (SMTP_HOST && SMTP_PASSWORD) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });

    try {
      await cachedTransporter.verify();
      console.log('[EmailService] SMTP Connection established successfully to', SMTP_HOST);
    } catch (verifyErr) {
      console.warn('[EmailService] SMTP Verification warning:', verifyErr.message);
    }

    return cachedTransporter;
  }

  // 2. In development when SMTP credentials are not yet set in .env
  if (process.env.NODE_ENV !== 'production') {
    console.log('[EmailService] No SMTP_HOST / SMTP_PASSWORD configured. Using simulated delivery transporter for development.');
    
    cachedTransporter = {
      sendMail: async (mailOptions) => {
        console.log('================== [SIMULATED EMAIL DISPATCH] ==================');
        console.log(`FROM: ${mailOptions.from}`);
        console.log(`TO: ${mailOptions.to}`);
        console.log(`SUBJECT: ${mailOptions.subject}`);
        console.log(`ATTACHMENTS: ${(mailOptions.attachments || []).map(a => a.filename).join(', ') || 'None'}`);
        console.log('================================================================');
        return {
          messageId: `dev-${Date.now()}@thenamsoftwaresolutions.com`,
          response: '250 2.0.0 OK: Simulated email delivery successful',
          accepted: [mailOptions.to]
        };
      }
    };

    return cachedTransporter;
  }

  // 3. In production, missing credentials must be reported clearly
  return null;
};

/**
 * Generates responsive branded HTML email template for Thenam ERP Task Report.
 */
const buildReportEmailHtml = ({
  employeeName,
  department,
  customMessage,
  summary,
  attachmentsList = []
}) => {
  const {
    totalTasks = 0,
    completedTasks = 0,
    inProgressTasks = 0,
    pendingTasks = 0,
    overdueTasks = 0,
    totalPoints = 0
  } = summary || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thenam ERP - Employee Task Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 24px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; text-align: left; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
    .header p { color: #94a3b8; margin: 6px 0 0 0; font-size: 13px; font-weight: 500; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
    .message-box { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 6px; font-size: 13px; color: #334155; margin-bottom: 24px; font-style: italic; }
    .badge-bar { display: flex; gap: 8px; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 5px 12px; background: #e0f2fe; color: #0369a1; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .stats-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 24px; }
    .stats-row { display: table-row; }
    .stat-card { display: table-cell; width: 33.33%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 10px; text-align: center; }
    .stat-val { font-size: 22px; font-weight: 800; line-height: 1.1; margin-bottom: 4px; }
    .stat-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; }
    .attachment-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #166534; margin-bottom: 24px; }
    .footer { background-color: #f8fafc; padding: 24px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>THENAM SOFTWARE SOLUTIONS</h1>
      <p>Thenam ERP Connect — Employee Task Completion Report</p>
    </div>

    <div class="content">
      <div class="greeting">Hello ${employeeName},</div>
      
      <p class="intro">
        Please find your latest verified task completion report from Thenam ERP Connect.
      </p>

      ${customMessage ? `<div class="message-box"><strong>Admin Note:</strong><br>${customMessage.replace(/\n/g, '<br>')}</div>` : ''}

      <div style="margin-bottom: 16px;">
        <span class="badge">Employee: <strong>${employeeName}</strong></span>
        <span class="badge" style="background: #f1f5f9; color: #475569;">Department: <strong>${department || 'General'}</strong></span>
      </div>

      <div class="stats-grid">
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-val" style="color: #4f46e5;">${totalTasks}</div>
            <div class="stat-label">Total Assigned</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #16a34a;">${completedTasks}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #0284c7;">${inProgressTasks}</div>
            <div class="stat-label">In Progress</div>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-val" style="color: #64748b;">${pendingTasks}</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #ef4444;">${overdueTasks}</div>
            <div class="stat-label">Overdue</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #d97706;">${totalPoints} pts</div>
            <div class="stat-label">Points Earned</div>
          </div>
        </div>
      </div>

      ${attachmentsList.length > 0 ? `
        <div class="attachment-box">
          📎 <strong>Attached Report Documents:</strong><br>
          ${attachmentsList.map(a => `• ${a}`).join('<br>')}
        </div>
      ` : ''}

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
        This report was generated automatically from <strong>Thenam ERP Connect</strong>.
        If you have any questions regarding your task status or points, please contact your project manager or team administrator.
      </p>

      <p style="font-size: 13px; color: #334155; margin-top: 20px;">
        Regards,<br>
        <strong>Administration</strong><br>
        Thenam Software Solutions
      </p>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} Thenam Software Solutions. All rights reserved.<br>
      This is a confidential and proprietary employee communication.
    </div>
  </div>
</body>
</html>
`;
};

/**
 * Sends an email with optional attachments.
 */
const sendEmail = async ({ to, subject, html, text, attachments = [] }) => {
  if (!to || !to.includes('@')) {
    throw new Error('A valid recipient email address is required.');
  }

  const transporter = await getTransporter();

  if (!transporter) {
    throw new Error('Email service is not configured. Please contact the system administrator.');
  }

  const mailOptions = {
    from: `"Thenam ERP Administration" <${MAIL_FROM}>`,
    to: to.trim(),
    subject: subject || 'Thenam ERP - Employee Task Report',
    text: text || 'Please find your latest task report attached.',
    html,
    attachments
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

module.exports = {
  getTransporter,
  buildReportEmailHtml,
  sendEmail,
  MAIL_FROM
};
