#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const dashboardPath = path.join(__dirname, "../src/pages/admin/Dashboard.tsx");
let content = fs.readFileSync(dashboardPath, "utf8");

const startMarker = "      {/* Order Details Dialog */}";
const endMarker = "\n\n      {/* Remove Order Dialog */}";
const replacement = `      <OrderDetailsDialog
        open={isOrderDetailsOpen}
        onOpenChange={(open) => {
          setIsOrderDetailsOpen(open);
          if (!open) {
            setSelectedOrder(null);
            setSelectedOrderAmbassador(null);
            setEmailDeliveryLogs([]);
            setIsEditingEmail(false);
            setEditingEmailValue('');
            setIsEditingAdminNotes(false);
            setEditingAdminNotesValue('');
          }
        }}
        order={selectedOrder}
        ambassador={selectedOrderAmbassador}
        orderLogs={orderLogs}
        language={language}
        resendingTicketEmail={resendingTicketEmail}
        onOrderUpdate={(updates) => setSelectedOrder(prev => prev ? { ...prev, ...updates } : null)}
        onRefresh={(status) => fetchAmbassadorSalesData(status)}
        orderFilters={orderFilters}
        onApprove={handleApproveOrderAsAdmin}
        onRequestReject={(id) => { setRejectingOrderId(id); setIsRejectDialogOpen(true); }}
        onRequestRemove={(id) => { setRemovingOrderId(id); setIsRemoveOrderDialogOpen(true); }}
        onRequestSkip={(id) => { setSkippingOrderId(id); setIsSkipConfirmationDialogOpen(true); }}
        onComplete={handleCompleteOrderAsAdmin}
        onResendTicket={handleResendTicketEmail}
      />

      {/* Remove Order Dialog */}`;

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found. startIdx:", startIdx, "endIdx:", endIdx);
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after = content.substring(endIdx); // includes "\n\n      {/* Remove Order Dialog */}..."
content = before + replacement + after;

fs.writeFileSync(dashboardPath, content);
console.log("Replaced Order Details Dialog successfully.");
