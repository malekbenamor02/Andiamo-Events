import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Loader from "@/components/ui/Loader";

const dialogClass = "bg-[#1F1F1F] border-[#2A2A2A] text-white";

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  inputLabel: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (value: string | undefined) => void;
  /** When true, confirm button shows loading and is disabled */
  confirmLoading?: boolean;
  /** When false, dialog does not close on confirm (parent closes after async work). Default true. */
  closeOnConfirm?: boolean;
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  inputLabel,
  placeholder = "",
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmLoading = false,
  closeOnConfirm = true,
}: ReasonDialogProps) {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const handleConfirm = () => {
    if (confirmLoading) return;
    const v = value.trim() || undefined;
    onConfirm(v);
    if (closeOnConfirm) onOpenChange(false);
  };

  const handleCancel = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-[#B0B0B0]">{inputLabel}</Label>
          <Input
            className="bg-[#252525] border-[#2A2A2A] text-white placeholder:text-[#666]"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="border-[#2A2A2A] text-[#B0B0B0] hover:bg-[#2A2A2A] hover:text-white"
            onClick={handleCancel}
            disabled={confirmLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className="bg-[#E21836] hover:bg-[#c4142e] text-white"
            onClick={handleConfirm}
            disabled={confirmLoading}
          >
            {confirmLoading ? <Loader size="sm" className="mr-2 shrink-0" /> : null}
            {confirmLoading ? "Rejecting..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
