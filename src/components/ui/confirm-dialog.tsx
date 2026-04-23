import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Loader from "@/components/ui/Loader";

const dialogClass = "bg-card border-border text-foreground";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  variant?: "danger" | "default";
  /** When true, confirm button shows loading and is disabled */
  confirmLoading?: boolean;
  /** When false, dialog does not close on confirm (parent closes after async work). Default true. */
  closeOnConfirm?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = "default",
  confirmLoading = false,
  closeOnConfirm = true,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    if (confirmLoading) return;
    onConfirm();
    if (closeOnConfirm) onOpenChange(false);
  };

  const handleCancel = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={handleCancel}
            disabled={confirmLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={
              variant === "danger"
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }
            onClick={handleConfirm}
            disabled={confirmLoading}
          >
            {confirmLoading ? <Loader size="sm" className="mr-2 shrink-0" /> : null}
            {confirmLoading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
