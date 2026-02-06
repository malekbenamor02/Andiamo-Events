#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dashboardPath = path.join(__dirname, '../src/pages/admin/Dashboard.tsx');
let content = fs.readFileSync(dashboardPath, 'utf8');

const startMarker = '      {/* Online Order Details Dialog */}';
const endMarker = '\n\n      <AmbassadorInfoDialog';
const replacement = `      <OnlineOrderDetailsDialog
        open={isOnlineOrderDetailsOpen}
        onOpenChange={(open) => {
          setIsOnlineOrderDetailsOpen(open);
          if (!open) setSelectedOnlineOrder(null);
        }}
        order={selectedOnlineOrder}
        language={language}
        onUpdateStatus={updateOnlineOrderStatus}
      />`;

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found. startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after = content.substring(endIdx); // includes "\n\n      <AmbassadorInfoDialog..."
content = before + replacement + after;

fs.writeFileSync(dashboardPath, content);
console.log('Replaced Online Order Details Dialog successfully.');
