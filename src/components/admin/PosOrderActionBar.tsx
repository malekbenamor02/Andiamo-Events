import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
import {
  ADMIN_BTN_DELETE,
  ADMIN_BTN_EDIT,
} from "@/pages/admin/components/AdminTabShell";

const BTN_APPROVE =
  "h-8 border-emerald-500/40 px-2.5 text-xs text-emerald-600 hover:bg-emerald-500/10";
const BTN_REJECT =
  "h-8 border-amber-500/40 px-2.5 text-xs text-amber-600 hover:bg-amber-500/10";

export interface PosOrderActionBarOrder {
  id: string;
  status: string;
}

export interface PosOrderActionBarProps {
  order: PosOrderActionBarOrder;
  labels: {
    view: string;
    approve: string;
    reject: string;
    remove: string;
  };
  layout?: "grid" | "inline";
  showView?: boolean;
  orderActionLoading?: { orderId: string; action: "approve" | "reject" | "remove" } | null;
  onView?: () => void;
  onRequestApprove: (order: PosOrderActionBarOrder) => void;
  onRequestReject: (order: PosOrderActionBarOrder) => void;
  onRequestRemove: (order: PosOrderActionBarOrder) => void;
}

export function PosOrderActionBar({
  order,
  labels,
  layout = "grid",
  showView = true,
  orderActionLoading,
  onView,
  onRequestApprove,
  onRequestReject,
  onRequestRemove,
}: PosOrderActionBarProps) {
  const isPending = order.status === "PENDING_ADMIN_APPROVAL";
  const canRemove = isPending || order.status === "PAID";
  const loading = orderActionLoading?.orderId === order.id;
  const loadingAction = loading ? orderActionLoading?.action : null;

  const viewBtn = showView && onView ? (
    <Button
      size="sm"
      variant="outline"
      className={cn(ADMIN_BTN_EDIT, layout === "grid" && "w-full")}
      onClick={onView}
    >
      <Eye className="mr-1 h-3.5 w-3.5" />
      {labels.view}
    </Button>
  ) : null;

  const approveBtn = isPending ? (
    <Button
      size="sm"
      variant="outline"
      className={cn(BTN_APPROVE, layout === "grid" && "w-full")}
      onClick={() => onRequestApprove(order)}
      disabled={loading}
    >
      {loadingAction === "approve" ? <Loader size="sm" className="mr-1 shrink-0" /> : null}
      {labels.approve}
    </Button>
  ) : null;

  const rejectBtn = isPending ? (
    <Button
      size="sm"
      variant="outline"
      className={cn(BTN_REJECT, layout === "grid" && "w-full")}
      onClick={() => onRequestReject(order)}
      disabled={loading}
    >
      {loadingAction === "reject" ? <Loader size="sm" className="mr-1 shrink-0" /> : null}
      {labels.reject}
    </Button>
  ) : null;

  const removeBtn = canRemove ? (
    <Button
      size="sm"
      variant="outline"
      className={cn(ADMIN_BTN_DELETE, layout === "grid" && "w-full")}
      onClick={() => onRequestRemove(order)}
      disabled={loading}
    >
      {loadingAction === "remove" ? <Loader size="sm" className="mr-1 shrink-0" /> : null}
      {labels.remove}
    </Button>
  ) : null;

  if (layout === "inline") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {viewBtn}
        {approveBtn}
        {rejectBtn}
        {removeBtn}
      </div>
    );
  }

  const actionCount = [approveBtn, rejectBtn, removeBtn].filter(Boolean).length;

  return (
    <div
      className={cn(
        "grid gap-1.5",
        actionCount >= 2 ? "grid-cols-2" : "grid-cols-1",
        showView && "border-t border-border/50 pt-3"
      )}
    >
      {viewBtn && (
        <div className={cn(actionCount >= 1 ? "col-span-2" : undefined)}>{viewBtn}</div>
      )}
      {approveBtn}
      {rejectBtn}
      {removeBtn && (
        <div className={cn(isPending || !rejectBtn ? "col-span-2" : undefined)}>{removeBtn}</div>
      )}
    </div>
  );
}
