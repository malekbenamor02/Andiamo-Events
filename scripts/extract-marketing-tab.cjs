/**
 * Extracts Marketing tab content from Dashboard and creates MarketingTab component.
 * Run: node scripts/extract-marketing-tab.cjs
 */
const fs = require("fs");
const path = require("path");

const dashboardPath = path.join(__dirname, "..", "src", "pages", "admin", "Dashboard.tsx");
const content = fs.readFileSync(dashboardPath, "utf8");
const crlf = content.includes("\r\n") ? "\r\n" : "\n";

const startMarker = "              {/* Marketing Tab */}" + crlf + '              <TabsContent value="marketing" className="space-y-6">';
const endMarker = "              </TabsContent>" + crlf + crlf + "              <AioEventsTab";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  console.error("Markers not found", { startIdx, endIdx });
  process.exit(1);
}

const marketingContent = content.slice(startIdx, endIdx);
// Save raw extracted content for reference
fs.writeFileSync(
  path.join(__dirname, "..", "marketing-tab-raw.txt"),
  marketingContent,
  "utf8"
);
console.log("Extracted Marketing tab content to marketing-tab-raw.txt, length:", marketingContent.length);
