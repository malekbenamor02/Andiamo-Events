/**
 * Extracts Events tab content from Dashboard.tsx
 * Run: node scripts/extract-events-tab.cjs
 */
const fs = require("fs");
const path = require("path");

const dashboardPath = path.join(__dirname, "..", "src", "pages", "admin", "Dashboard.tsx");
const content = fs.readFileSync(dashboardPath, "utf8");
const crlf = content.includes("\r\n") ? "\r\n" : "\n";

const startMarker = "              {/* Events Tab */}" + crlf + "              <TabsContent value=\"events\" className=\"space-y-6\">";
const endMarker = "              </TabsContent>" + crlf + crlf + "              {/* Admins Management Tab";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found", { startIdx, endIdx });
  process.exit(1);
}

let transformed = content.slice(startIdx + startMarker.length, endIdx);

// Replace t. with p.t. first (avoids breaking "téléchargé" etc in French text)
transformed = transformed.replace(/\bt\./g, "p.t.");

// Other variables to replace - use word boundaries, exclude when already p.xxx
const vars = [
  "editingEvent", "setEditingEvent", "isEventDialogOpen", "setIsEventDialogOpen",
  "pendingGalleryImages", "setPendingGalleryImages", "pendingGalleryVideos", "setPendingGalleryVideos",
  "passValidationErrors", "setPassValidationErrors", "events", "language",
  "isInstagramUrl", "handleSaveEvent", "handleGalleryFileSelect", "removeGalleryFile", "removePendingGalleryFile",
  "isPassManagementDialogOpen", "setIsPassManagementDialogOpen", "eventForPassManagement", "passesForManagement",
  "setPassesForManagement", "newPassForm", "setNewPassForm", "setConfirmDelete", "confirmDelete",
  "isPassManagementLoading", "setIsPassManagementLoading", "setEventForPassManagement",
  "animatedEvents", "handleDeleteEvent", "getApiBaseUrl", "supabase", "toast"
];

for (const v of vars) {
  const re = new RegExp("\\b" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
  transformed = transformed.replace(re, "p." + v);
}
transformed = transformed.replace(/p\.t\.p\./g, "p.t.");

fs.writeFileSync(path.join(__dirname, "..", "events-tab-raw.txt"), transformed, "utf8");
console.log("Extracted Events tab to events-tab-raw.txt, length:", transformed.length);
