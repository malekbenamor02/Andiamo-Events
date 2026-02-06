/**
 * Extracts Settings tab content from Dashboard.tsx
 * Run: node scripts/extract-settings-tab.cjs
 */
const fs = require("fs");
const path = require("path");

const dashboardPath = path.join(__dirname, "..", "src", "pages", "admin", "Dashboard.tsx");
const content = fs.readFileSync(dashboardPath, "utf8");
const crlf = content.includes("\r\n") ? "\r\n" : "\n";

// Settings tab is: {currentAdminRole === 'super_admin' && ( <TabsContent value="settings"> ... </TabsContent> )}
const startMarker = "              {/* Settings Tab - Only visible to super_admin */}" + crlf + "              {currentAdminRole === 'super_admin' && (" + crlf + "                <TabsContent value=\"settings\" className=\"space-y-6\">";
const endMarker = "                </div>" + crlf + "              </TabsContent>" + crlf + "              )}";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found", { startIdx, endIdx });
  console.log("Trying alternative...");
  const altStart = content.indexOf("Settings Tab - Only visible");
  console.log("Alt start:", altStart);
  process.exit(1);
}

// We want the inner content (without the conditional wrapper), from the first <div> after TabsContent to </TabsContent>
const innerStart = content.indexOf(crlf + "                <div ", startIdx) + crlf.length;
const settingsContent = content.slice(innerStart, endIdx);

// Variable names to replace with p.xxx (only as standalone identifiers, not in strings)
const vars = [
  "t", "language",
  "salesEnabled", "updateSalesSettingsData", "loadingSalesSettings",
  "maintenanceEnabled", "maintenanceMessage", "allowAmbassadorApplication",
  "updateMaintenanceSettings", "loadingMaintenanceSettings", "setMaintenanceMessage", "setAllowAmbassadorApplication",
  "expirationSettings", "loadingExpirationSettings", "updateExpirationSettings", "triggerAutoRejectExpired", "rejectingExpired",
  "ambassadorApplicationEnabled", "ambassadorApplicationMessage", "updateAmbassadorApplicationSettings",
  "loadingAmbassadorApplicationSettings", "setAmbassadorApplicationMessage",
  "heroImages", "handleUploadHeroImage", "uploadingHeroImage", "loadingHeroImages", "handleReorderHeroImages", "handleDeleteHeroImage",
  "aboutImages", "handleUploadAboutImage", "uploadingAboutImage", "loadingAboutImages", "handleReorderAboutImages", "handleDeleteAboutImage",
  "faviconSettings", "handleUploadFavicon", "handleDeleteFavicon", "loadingFaviconSettings", "uploadingFavicon"
];

let transformed = settingsContent;
// Replace each variable - use regex to match whole words
for (const v of vars) {
  const re = new RegExp("\\b" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
  transformed = transformed.replace(re, "p." + v);
}
// Fix p.t.p.xxx -> p.t.xxx (t's properties were incorrectly prefixed)
transformed = transformed.replace(/p\.t\.p\./g, "p.t.");

fs.writeFileSync(
  path.join(__dirname, "..", "settings-tab-inner.txt"),
  transformed,
  "utf8"
);
console.log("Extracted Settings tab inner content to settings-tab-inner.txt, length:", transformed.length);
