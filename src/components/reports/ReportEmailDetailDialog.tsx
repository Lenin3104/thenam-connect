import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  ExternalLink,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Award,
  User,
  Building
} from "lucide-react";
import { useReportEmail, downloadReportEmailAttachment } from "@/lib/api-hooks";
import { toast } from "sonner";

interface ReportEmailDetailDialogProps {
  emailId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportEmailDetailDialog: React.FC<ReportEmailDetailDialogProps> = ({
  emailId,
  isOpen,
  onClose
}) => {
  const { data: email, isLoading, error } = useReportEmail(isOpen && emailId ? emailId : null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const handleDownloadPdf = async () => {
    if (!emailId) return;
    try {
      setDownloadingPdf(true);
      await downloadReportEmailAttachment(
        emailId,
        "pdf",
        email?.pdfFilename || `Thenam_Employee_Report_${email?.recipientName?.replace(/[^a-zA-Z0-9_-]/g, "_") || "Employee"}.pdf`
      );
      toast.success("PDF report downloaded successfully!");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Report attachment is currently unavailable.";
      toast.error(msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!emailId) return;
    try {
      setDownloadingExcel(true);
      await downloadReportEmailAttachment(
        emailId,
        "excel",
        email?.excelFilename || `Thenam_Employee_Report_${email?.recipientName?.replace(/[^a-zA-Z0-9_-]/g, "_") || "Employee"}.xlsx`
      );
      toast.success("Excel report downloaded successfully!");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Report attachment is currently unavailable.";
      toast.error(msg);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const formattedDate = email?.sentAt || email?.createdAt
    ? new Date(email.sentAt || email.createdAt).toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short"
      })
    : "Just now";

  // Parse error status
  const errorStatus = (error as any)?.response?.status;
  const errorMessage =
    errorStatus === 403
      ? "You don't have permission to view this email."
      : errorStatus === 404
      ? "This email is no longer available."
      : (error as any)?.response?.data?.message || "Unable to load this email.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-card border-border shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  Employee Report Email
                  <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Delivered
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Official employee task completion report emailed from Thenam ERP Connect
                </DialogDescription>
              </div>
            </div>

            {email?.recipientEmail && (
              <a
                href={`mailto:${email.recipientEmail}?subject=${encodeURIComponent(email.subject || "Employee Task Report")}`}
                className="hidden sm:inline-flex"
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-xl cursor-pointer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Email App</span>
                </Button>
              </a>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-medium">Loading report email details...</p>
          </div>
        ) : error ? (
          <div className="p-10 flex flex-col items-center justify-center text-center gap-3">
            <div className="p-3 rounded-full bg-rose-500/10 text-rose-500">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">{errorMessage}</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Please verify your access credentials or contact an administrator if you believe this is an error.
            </p>
            <Button variant="outline" size="sm" onClick={onClose} className="mt-2 rounded-xl">
              Close
            </Button>
          </div>
        ) : email ? (
          <div className="p-5 space-y-5 text-xs">
            {/* Email Header Meta Card */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/40 pb-2">
                <span className="font-semibold text-foreground text-sm">{email.subject}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formattedDate}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground w-12 shrink-0">From:</span>
                  <span className="font-mono text-[11px] text-primary truncate">
                    {email.fromEmail}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground w-12 shrink-0">To:</span>
                  <span className="font-mono text-[11px] truncate">
                    {email.recipientEmail}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground pt-1 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium text-foreground">Employee:</span>
                  <span className="font-semibold text-foreground">{email.recipientName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium text-foreground">Department:</span>
                  <span>{email.department || "General"}</span>
                </div>
              </div>
            </div>

            {/* Task Summary Badges */}
            {email.summary && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Report Summary Overview
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div className="p-2.5 rounded-xl border border-border/60 bg-card text-center">
                    <span className="text-muted-foreground text-[10px] block font-medium">Total</span>
                    <span className="text-base font-extrabold text-foreground">{email.summary.totalTasks}</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px] block font-medium">Completed</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{email.summary.completedTasks}</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-center">
                    <span className="text-blue-600 dark:text-blue-400 text-[10px] block font-medium">In Progress</span>
                    <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">{email.summary.inProgressTasks}</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] block font-medium">Pending</span>
                    <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">{email.summary.pendingTasks}</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
                    <span className="text-rose-600 dark:text-rose-400 text-[10px] block font-medium">Overdue</span>
                    <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">{email.summary.overdueTasks}</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-purple-500/20 bg-purple-500/5 text-center">
                    <span className="text-purple-600 dark:text-purple-400 text-[10px] block font-medium flex items-center justify-center gap-0.5">
                      <Award className="h-2.5 w-2.5" /> Points
                    </span>
                    <span className="text-base font-extrabold text-purple-600 dark:text-purple-400">{email.summary.totalPoints}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Custom Message if any */}
            {email.message && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1">
                <span className="font-semibold text-primary text-[11px] block">
                  Admin Message Note:
                </span>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {email.message}
                </p>
              </div>
            )}

            {/* Email Message Content Body */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-foreground font-medium">
                Hello {email.recipientName},
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Please find your latest employee task completion report from Thenam ERP Connect.
              </p>
              <div className="text-muted-foreground text-[11px] space-y-1 py-1">
                <p>• Employee: <strong className="text-foreground">{email.recipientName}</strong></p>
                <p>• Department: <strong className="text-foreground">{email.department || "General"}</strong></p>
                {email.summary && (
                  <>
                    <p>• Total Tasks Assigned: <strong className="text-foreground">{email.summary.totalTasks}</strong></p>
                    <p>• Successfully Completed: <strong className="text-emerald-500 font-bold">{email.summary.completedTasks}</strong></p>
                    <p>• Rewards Earned: <strong className="text-purple-500 font-bold">{email.summary.totalPoints} pts</strong></p>
                  </>
                )}
              </div>
              <div className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                <p>Regards,</p>
                <p className="font-semibold text-foreground">{email.senderName || "Admin"}</p>
                <p className="text-primary font-medium">Thenam Software Solutions</p>
              </div>
            </div>

            {/* Attachments Section */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Attachments ({[email.hasPdf, email.hasExcel].filter(Boolean).length})
              </p>

              {!email.hasPdf && !email.hasExcel ? (
                <div className="rounded-xl border border-border/50 p-4 text-center text-muted-foreground text-xs">
                  No attachments were included with this report email.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {email.hasPdf && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-xs truncate">
                            {email.pdfFilename || "Employee_Task_Report.pdf"}
                          </p>
                          <span className="text-[10px] text-muted-foreground">PDF Document</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        className="h-8 shrink-0 gap-1.5 rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                      >
                        {downloadingPdf ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        <span>Download</span>
                      </Button>
                    </div>
                  )}

                  {email.hasExcel && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-xs truncate">
                            {email.excelFilename || "Employee_Task_Report.xlsx"}
                          </p>
                          <span className="text-[10px] text-muted-foreground">Excel Spreadsheet</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadExcel}
                        disabled={downloadingExcel}
                        className="h-8 shrink-0 gap-1.5 rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        {downloadingExcel ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        <span>Download</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
