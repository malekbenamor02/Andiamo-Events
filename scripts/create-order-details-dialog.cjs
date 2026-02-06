#!/usr/bin/env node
/**
 * Creates OrderDetailsDialog component and replaces in Dashboard.
 */
const fs = require("fs");
const path = require("path");

const dashboardPath = path.join(__dirname, "..", "src", "pages", "admin", "Dashboard.tsx");
const componentPath = path.join(__dirname, "..", "src", "pages", "admin", "components", "OrderDetailsDialog.tsx");
const content = fs.readFileSync(dashboardPath, "utf8");

const startMarker = "      {/* Order Details Dialog */}";
const endMarker = "      {/* Remove Order Dialog */}";
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found", { startIdx, endIdx });
  process.exit(1);
}

let extracted = content.slice(startIdx, endIdx).trim();
// Remove the start marker from extracted - we'll rebuild the Dialog
extracted = extracted.replace(/^      \{\/\* Order Details Dialog \*\/}\s*\n?/, "");

// Replace Dialog open/onOpenChange with props
extracted = extracted.replace(
  /open=\{isOrderDetailsOpen\} onOpenChange=\{[^}]+\}[^>]*>/,
  "open={open} onOpenChange={onOpenChange}>"
);

// Replace selectedOrder with order
extracted = extracted.replace(/\bselectedOrder\b/g, "order");
// Replace selectedOrderAmbassador with ambassador
extracted = extracted.replace(/\bselectedOrderAmbassador\b/g, "ambassador");

// Replace handlers and setters
extracted = extracted.replace(/\bhandleApproveOrderAsAdmin\b/g, "onApprove");
extracted = extracted.replace(/\bhandleCompleteOrderAsAdmin\b/g, "onComplete");
extracted = extracted.replace(/\bhandleResendTicketEmail\b/g, "onResendTicket");
// handleReject/Remove/Skip are only in the sibling dialogs, not in Order Details
extracted = extracted.replace(/\bfetchAmbassadorSalesData\b/g, "onRefresh");

// Replace setSelectedOrder with onOrderUpdate - for partial updates
extracted = extracted.replace(
  /setSelectedOrder\(\{\s*\.\.\.order,\s*user_email:\s*editingEmailValue\.trim\(\)\s*\}\)/g,
  "onOrderUpdate({ user_email: editingEmailValue.trim() })"
);
extracted = extracted.replace(
  /setSelectedOrder\(\{\s*\.\.\.order,\s*admin_notes:\s*editingAdminNotesValue\.trim\(\)\s*\|\|\s*null\s*\}\)/g,
  "onOrderUpdate({ admin_notes: editingAdminNotesValue.trim() || null })"
);

// Replace dialog openers - these open sibling dialogs in parent
extracted = extracted.replace(
  /setRejectingOrderId\(order\.id\);\s*setIsRejectDialogOpen\(true\)/g,
  "onRequestReject(order.id)"
);
extracted = extracted.replace(
  /setRemovingOrderId\(order\.id\);\s*setIsRemoveOrderDialogOpen\(true\)/g,
  "onRequestRemove(order.id)"
);
extracted = extracted.replace(
  /setSkippingOrderId\(order\.id\);\s*setIsSkipConfirmationDialogOpen\(true\)/g,
  "onRequestSkip(order.id)"
);

const header = `/**
 * Admin Dashboard - Order Details Dialog (COD/Ambassador orders).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from "@/lib/api-routes";
import { cn } from "@/lib/utils";
import {
  Package, FileText, Activity, Database, Calendar as CalendarIcon, Clock, DollarSign,
  User, Phone, Mail, MapPin, Ticket, Users, Percent, Save, X, Edit, RefreshCw, Send,
  Trash2, Wrench, CheckCircle, XCircle, CheckCircle2, Zap, MailCheck
} from "lucide-react";

export interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Record<string, unknown> | null;
  ambassador: Record<string, unknown> | null;
  orderLogs: unknown[];
  language: "en" | "fr";
  resendingTicketEmail: boolean;
  onOrderUpdate: (updates: Record<string, unknown>) => void;
  onRefresh: () => void;
  onApprove: (orderId: string) => void | Promise<void>;
  onRequestReject: (orderId: string) => void;
  onRequestRemove: (orderId: string) => void;
  onRequestSkip: (orderId: string) => void;
  onComplete: (orderId: string) => void | Promise<void>;
  onResendTicket: (orderId: string) => void | Promise<void>;
}

export function OrderDetailsDialog({
  open,
  onOpenChange,
  order,
  ambassador,
  orderLogs,
  language,
  resendingTicketEmail,
  onOrderUpdate,
  onRefresh,
  onApprove,
  onRequestReject,
  onRequestRemove,
  onRequestSkip,
  onComplete,
  onResendTicket,
}: OrderDetailsDialogProps) {
  const { toast } = useToast();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [isEditingAdminNotes, setIsEditingAdminNotes] = useState(false);
  const [editingAdminNotesValue, setEditingAdminNotesValue] = useState("");
  const [updatingAdminNotes, setUpdatingAdminNotes] = useState(false);
  const [emailDeliveryLogs, setEmailDeliveryLogs] = useState([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  return (
`;

const footer = `
  );
}`;

const fullComponent = header + extracted + footer;
fs.writeFileSync(componentPath, fullComponent, "utf8");
console.log("Created OrderDetailsDialog.tsx");
