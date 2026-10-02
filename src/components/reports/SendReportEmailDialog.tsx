import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, FileText, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { useEmployees, useSendEmployeeReportEmail } from "@/lib/api-hooks";
import { toast } from "sonner";

interface SendReportEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
}

export function SendReportEmailDialog({
  isOpen,
  onClose,
  defaultEmployeeId,
}: SendReportEmailDialogProps) {
  const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();
  const sendEmailMutation = useSendEmployeeReportEmail();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [subject, setSubject] = useState<string>("Thenam ERP - Employee Task Report");
  const [message, setMessage] = useState<string>("");
  const [includeTaskSummary, setIncludeTaskSummary] = useState<boolean>(true);
  const [includePdf, setIncludePdf] = useState<boolean>(true);
  const [includeExcel, setIncludeExcel] = useState<boolean>(false);

  // Set default employee if provided
  useEffect(() => {
    if (defaultEmployeeId) {
      setSelectedEmployeeId(defaultEmployeeId);
    } else if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0]._id || employees[0].id);
    }
  }, [defaultEmployeeId, employees]);

  // Find currently selected employee object
  const currentEmployee = employees.find(
    (e: any) => (e._id || e.id) === selectedEmployeeId
  );

  const recipientEmail = (currentEmployee?.email || "").trim();
  const hasValidEmail = Boolean(recipientEmail && recipientEmail.includes("@"));

  const handleReset = () => {
    setSubject("Thenam ERP - Employee Task Report");
    setMessage("");
    setIncludeTaskSummary(true);
    setIncludePdf(true);
    setIncludeExcel(false);
  };

  const handleClose = () => {
    if (!sendEmailMutation.isPending) {
      handleReset();
      onClose();
    }
  };

  const handleSendEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedEmployeeId) {
      toast.error("Please select an employee.");
      return;
    }

    if (!hasValidEmail) {
      toast.error("This employee does not have a registered email address.");
      return;
    }

    try {
      await sendEmailMutation.mutateAsync({
        employeeId: selectedEmployeeId,
        subject: subject.trim() || "Thenam ERP - Employee Task Report",
        message: message.trim(),
        includeTaskSummary,
        includePdf,
        includeExcel,
      });

      toast.success(`Report email sent successfully to ${recipientEmail}`);
      handleClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        "Unable to send email right now. Please try again.";
      toast.error(errorMsg);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[620px] max-h-[88vh] flex flex-col p-0 gap-0 bg-card text-foreground border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <DialogHeader className="px-5 py-3.5 border-b border-border/70 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Send Employee Report
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Automatically generate and email task completion reports to employees.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSendEmail} className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          {/* Row 1: Select Employee (Left) & To (Right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="employee-select" className="text-xs font-semibold text-foreground">
                Select Employee
              </Label>
              {isEmployeesLoading ? (
                <div className="h-9 rounded-xl bg-muted/50 border border-border flex items-center px-3 gap-2 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Loading...
                </div>
              ) : (
                <Select
                  value={selectedEmployeeId}
                  onValueChange={(val) => setSelectedEmployeeId(val)}
                  disabled={sendEmailMutation.isPending}
                >
                  <SelectTrigger
                    id="employee-select"
                    className="h-9 rounded-xl bg-muted/40 border-border text-xs focus:ring-primary"
                  >
                    <SelectValue placeholder="Select an employee..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 bg-popover text-foreground border-border rounded-xl">
                    {employees.map((emp: any) => {
                      const id = emp._id || emp.id;
                      const email = emp.email || "No email registered";
                      const dept = emp.department || "General";
                      return (
                        <SelectItem key={id} value={id} className="text-xs cursor-pointer py-1.5">
                          <div className="flex flex-col text-left">
                            <span className="font-semibold text-foreground leading-tight">
                              {emp.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {dept} • {email}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                To (Registered Email)
              </Label>
              <div
                className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-colors ${
                  hasValidEmail
                    ? "bg-muted/40 border-border text-foreground"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className={`h-3.5 w-3.5 shrink-0 ${hasValidEmail ? "text-primary" : "text-rose-500"}`} />
                  <span className="truncate text-xs">
                    {hasValidEmail ? recipientEmail : "No registered email"}
                  </span>
                </div>
                {hasValidEmail && (
                  <span className="text-[9px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {!hasValidEmail && selectedEmployeeId && (
            <p className="text-[11px] text-rose-500 flex items-center gap-1 -mt-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              This employee does not have a registered email address. Email cannot be sent.
            </p>
          )}

          {/* Row 2: Subject & Sender */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="email-subject" className="text-xs font-semibold text-foreground">
                Subject
              </Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sendEmailMutation.isPending}
                placeholder="Thenam ERP - Employee Task Report"
                className="h-9 rounded-xl bg-muted/40 border-border text-xs focus-visible:ring-primary"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                From
              </Label>
              <div className="h-9 px-2.5 rounded-xl border border-border/60 bg-muted/30 flex items-center text-[11px] text-muted-foreground font-medium truncate" title="admin@thenamsoftwaresolutions.com">
                admin@thenamsoft...
              </div>
            </div>
          </div>

          {/* Row 3: Message Textarea */}
          <div className="space-y-1">
            <Label htmlFor="email-message" className="text-xs font-semibold text-foreground">
              Message (Optional Note)
            </Label>
            <textarea
              id="email-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sendEmailMutation.isPending}
              rows={2}
              placeholder="Add personal notes or instructions for the employee..."
              className="w-full rounded-xl bg-muted/40 border border-border text-xs p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
            />
          </div>

          {/* Row 4: Attachments Checkboxes */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Report Options & Attachments
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inc-summary"
                  checked={includeTaskSummary}
                  onCheckedChange={(checked) => setIncludeTaskSummary(!!checked)}
                  disabled={sendEmailMutation.isPending}
                />
                <Label htmlFor="inc-summary" className="text-xs cursor-pointer text-foreground font-medium">
                  Summary in body
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inc-pdf"
                  checked={includePdf}
                  onCheckedChange={(checked) => setIncludePdf(!!checked)}
                  disabled={sendEmailMutation.isPending}
                />
                <Label htmlFor="inc-pdf" className="text-xs cursor-pointer text-foreground font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  PDF Attachment
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inc-excel"
                  checked={includeExcel}
                  onCheckedChange={(checked) => setIncludeExcel(!!checked)}
                  disabled={sendEmailMutation.isPending}
                />
                <Label htmlFor="inc-excel" className="text-xs cursor-pointer text-foreground font-medium flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  Excel Attachment
                </Label>
              </div>
            </div>
          </div>
        </form>

        {/* Sticky Modal Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border/70 bg-muted/30 flex-row justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={sendEmailMutation.isPending}
            className="rounded-xl text-xs h-9 px-4 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleSendEmail()}
            disabled={!hasValidEmail || !selectedEmployeeId || sendEmailMutation.isPending}
            className="rounded-xl gradient-royal text-white gap-2 text-xs font-semibold h-9 px-4 cursor-pointer disabled:opacity-50"
          >
            {sendEmailMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-3.5 w-3.5" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
