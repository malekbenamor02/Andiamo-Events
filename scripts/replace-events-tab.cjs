/**
 * Replaces inline Events tab in Dashboard with EventsTab component
 * Run: node scripts/replace-events-tab.cjs
 */
const fs = require("fs");
const path = require("path");

const dashboardPath = path.join(__dirname, "..", "src", "pages", "admin", "Dashboard.tsx");
let content = fs.readFileSync(dashboardPath, "utf8");

const crlf = content.includes("\r\n") ? "\r\n" : "\n";
const startMarker = "              {/* Events Tab */}" + crlf + "              <TabsContent value=\"events\" className=\"space-y-6\">";
const endMarker = "              </TabsContent>" + crlf + crlf + "              {/* Admins Management Tab";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found", { startIdx, endIdx });
  process.exit(1);
}

const replacement = `              <EventsTab
                language={language}
                t={t}
                events={events}
                editingEvent={editingEvent}
                setEditingEvent={setEditingEvent}
                isEventDialogOpen={isEventDialogOpen}
                setIsEventDialogOpen={setIsEventDialogOpen}
                pendingGalleryImages={pendingGalleryImages}
                setPendingGalleryImages={setPendingGalleryImages}
                pendingGalleryVideos={pendingGalleryVideos}
                setPendingGalleryVideos={setPendingGalleryVideos}
                passValidationErrors={passValidationErrors}
                setPassValidationErrors={setPassValidationErrors}
                isInstagramUrl={isInstagramUrl}
                handleSaveEvent={handleSaveEvent}
                handleGalleryFileSelect={handleGalleryFileSelect}
                removeGalleryFile={removeGalleryFile}
                removePendingGalleryFile={removePendingGalleryFile}
                isPassManagementDialogOpen={isPassManagementDialogOpen}
                setIsPassManagementDialogOpen={setIsPassManagementDialogOpen}
                eventForPassManagement={eventForPassManagement}
                setEventForPassManagement={setEventForPassManagement}
                passesForManagement={passesForManagement}
                setPassesForManagement={setPassesForManagement}
                newPassForm={newPassForm}
                setNewPassForm={setNewPassForm}
                setConfirmDelete={setConfirmDelete}
                isPassManagementLoading={isPassManagementLoading}
                setIsPassManagementLoading={setIsPassManagementLoading}
                animatedEvents={animatedEvents}
                handleDeleteEvent={handleDeleteEvent}
              />`;

const newContent = content.slice(0, startIdx) + replacement + content.slice(endIdx + endMarker.length);
fs.writeFileSync(dashboardPath, newContent, "utf8");
console.log("Replaced Events tab in Dashboard");
console.log("Dashboard new length:", newContent.split(/\r?\n/).length);
