/**
 * Replaces inline Settings tab in Dashboard with SettingsTab component
 * Run: node scripts/replace-settings-tab.cjs
 */
const fs = require("fs");
const path = require("path");

const dashboardPath = path.join(__dirname, "..", "src", "pages", "admin", "Dashboard.tsx");
let content = fs.readFileSync(dashboardPath, "utf8");

const startMarker = "              {/* Settings Tab - Only visible to super_admin */}\n              {currentAdminRole === 'super_admin' && (\n                <TabsContent value=\"settings\" className=\"space-y-6\">\n                <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-2\">";
const endMarker = "                </div>\n              </TabsContent>\n              )}";

// Use \r\n if file uses CRLF
const crlf = content.includes("\r\n") ? "\r\n" : "\n";
const startMarkerCrlf = startMarker.replace(/\n/g, crlf);
const endMarkerCrlf = endMarker.replace(/\n/g, crlf);

const startIdx = content.indexOf(startMarkerCrlf);
const endIdx = content.indexOf(endMarkerCrlf, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found", { startIdx, endIdx });
  process.exit(1);
}

const replacement = `              {currentAdminRole === 'super_admin' && (
                <SettingsTab
                  language={language}
                  t={t}
                  salesEnabled={salesEnabled}
                  updateSalesSettingsData={updateSalesSettingsData}
                  loadingSalesSettings={loadingSalesSettings}
                  maintenanceEnabled={maintenanceEnabled}
                  maintenanceMessage={maintenanceMessage}
                  allowAmbassadorApplication={allowAmbassadorApplication}
                  updateMaintenanceSettings={updateMaintenanceSettings}
                  loadingMaintenanceSettings={loadingMaintenanceSettings}
                  setMaintenanceMessage={setMaintenanceMessage}
                  setAllowAmbassadorApplication={setAllowAmbassadorApplication}
                  expirationSettings={expirationSettings}
                  loadingExpirationSettings={loadingExpirationSettings}
                  updateExpirationSettings={updateExpirationSettings}
                  triggerAutoRejectExpired={triggerAutoRejectExpired}
                  rejectingExpired={rejectingExpired}
                  ambassadorApplicationEnabled={ambassadorApplicationEnabled}
                  ambassadorApplicationMessage={ambassadorApplicationMessage}
                  updateAmbassadorApplicationSettings={updateAmbassadorApplicationSettings}
                  loadingAmbassadorApplicationSettings={loadingAmbassadorApplicationSettings}
                  setAmbassadorApplicationMessage={setAmbassadorApplicationMessage}
                  heroImages={heroImages}
                  handleUploadHeroImage={handleUploadHeroImage}
                  uploadingHeroImage={uploadingHeroImage}
                  loadingHeroImages={loadingHeroImages}
                  handleReorderHeroImages={handleReorderHeroImages}
                  handleDeleteHeroImage={handleDeleteHeroImage}
                  aboutImages={aboutImages}
                  handleUploadAboutImage={handleUploadAboutImage}
                  uploadingAboutImage={uploadingAboutImage}
                  loadingAboutImages={loadingAboutImages}
                  handleReorderAboutImages={handleReorderAboutImages}
                  handleDeleteAboutImage={handleDeleteAboutImage}
                  faviconSettings={faviconSettings}
                  handleUploadFavicon={handleUploadFavicon}
                  handleDeleteFavicon={handleDeleteFavicon}
                  loadingFaviconSettings={loadingFaviconSettings}
                  uploadingFavicon={uploadingFavicon}
                />
              )}`;

const newContent = content.slice(0, startIdx) + replacement + content.slice(endIdx + endMarkerCrlf.length);
fs.writeFileSync(dashboardPath, newContent, "utf8");
console.log("Replaced Settings tab in Dashboard. Lines removed:", (content.length - newContent.length) / 50);
console.log("Dashboard new length:", newContent.split(/\r?\n/).length);
