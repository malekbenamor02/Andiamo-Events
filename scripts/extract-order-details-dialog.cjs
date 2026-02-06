/**
 * Extracts Order Details Dialog from Dashboard.tsx
 * Run: node scripts/extract-order-details-dialog.cjs
 */
const fs = require("fs");
const path = require("path");

const dashboardPath = path.join(__dirname, "..", "src", "pages", "admin", "Dashboard.tsx");
const content = fs.readFileSync(dashboardPath, "utf8");
const crlf = content.includes("\r\n") ? "\r\n" : "\n";

const startMarker = "      {/* Order Details Dialog */}" + crlf + "      <Dialog open={isOrderDetailsOpen} onOpenChange={(open) => {";
const endMarker = "      </Dialog>" + crlf + crlf + "      {/* Online Order Details Dialog */}";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found", { startIdx, endIdx });
  process.exit(1);
}

let extracted = content.slice(startIdx, endIdx + "      </Dialog>".length);

// Replace variable refs with p.xxx
const vars = [
  "isOrderDetailsOpen", "setIsOrderDetailsOpen", "setSelectedOrder", "setSelectedOrderAmbassador",
  "setEmailDeliveryLogs", "setIsEditingEmail", "setEditingEmailValue", "setIsEditingAdminNotes", "setEditingAdminNotesValue",
  "selectedOrder", "selectedOrderAmbassador", "language", "isEditingEmail", "editingEmailValue",
  "setEditingEmailValue", "updatingEmail", "setUpdatingEmail", "toast", "getApiBaseUrl", "buildFullApiUrl", "API_ROUTES",
  "setSelectedOrder", "setIsEditingEmail", "setEditingEmailValue", "isEditingAdminNotes", "editingAdminNotesValue",
  "setEditingAdminNotesValue", "updatingAdminNotes", "setUpdatingAdminNotes", "orderFilters", "fetchAmbassadorSalesData",
  "emailDeliveryLogs", "loadingEmailLogs", "resendingEmail", "resendingTicketEmail",
  "setIsRejectDialogOpen", "setRejectingOrderId", "setIsRemoveOrderDialogOpen", "setRemovingOrderId",
  "setIsSkipConfirmationDialogOpen", "setSkippingOrderId", "setIsAmbassadorInfoDialogOpen",
  "handleApproveOrder", "handleRejectOrder", "handleRemoveOrder", "handleSkipConfirmation", "resendTicketEmail"
];

// Replace t. with p.t.
extracted = extracted.replace(/\bt\./g, "p.t.");

for (const v of vars) {
  const re = new RegExp("\\b" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
  extracted = extracted.replace(re, "p." + v);
}
extracted = extracted.replace(/p\.t\.p\./g, "p.t.");

fs.writeFileSync(path.join(__dirname, "..", "order-details-dialog-raw.txt"), extracted, "utf8");
console.log("Extracted Order Details Dialog, length:", extracted.length);
