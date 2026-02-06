const fs = require('fs');
const path = require('path');

const dashboardPath = path.join(__dirname, '../src/pages/admin/Dashboard.tsx');
let content = fs.readFileSync(dashboardPath, 'utf8');
const hadCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const startMarker = '              {/* Marketing Tab */}\n              <TabsContent value="marketing" className="space-y-6">';
const endMarker = `              <AioEventsTab`;

const replacement = `              <MarketingTab
                language={language}
                marketingSubTab={marketingSubTab}
                setMarketingSubTab={setMarketingSubTab}
                emailSubscribers={emailSubscribers}
                fetchEmailSubscribers={fetchEmailSubscribers}
                loadingBalance={loadingBalance}
                smsBalance={smsBalance}
                fetchSmsBalance={fetchSmsBalance}
                testPhoneNumber={testPhoneNumber}
                setTestPhoneNumber={setTestPhoneNumber}
                testSmsMessage={testSmsMessage}
                setTestSmsMessage={setTestSmsMessage}
                handleSendTestSms={handleSendTestSms}
                sendingTestSms={sendingTestSms}
                phoneSubscribers={phoneSubscribers}
                handleExportPhones={handleExportPhones}
                showImportDialog={showImportDialog}
                setShowImportDialog={setShowImportDialog}
                handleImportPhonesFromExcel={handleImportPhonesFromExcel}
                importingPhones={importingPhones}
                loadingLogs={loadingLogs}
                smsLogs={smsLogs}
                fetchSmsLogs={fetchSmsLogs}
                fetchPhoneSubscribers={fetchPhoneSubscribers}
                loadingEmailSubscribers={loadingEmailSubscribers}
                handleExportEmails={handleExportEmails}
                showEmailImportDialog={showEmailImportDialog}
                setShowEmailImportDialog={setShowEmailImportDialog}
                handleImportEmailsFromExcel={handleImportEmailsFromExcel}
                importingEmails={importingEmails}
                emailSubject={emailSubject}
                setEmailSubject={setEmailSubject}
                emailContent={emailContent}
                setEmailContent={setEmailContent}
                testEmailAddress={testEmailAddress}
                setTestEmailAddress={setTestEmailAddress}
                handleSendTestEmail={handleSendTestEmail}
                sendingTestEmail={sendingTestEmail}
                emailDelaySeconds={emailDelaySeconds}
                setEmailDelaySeconds={setEmailDelaySeconds}
                handleSendBulkEmails={handleSendBulkEmails}
                sendingBulkEmails={sendingBulkEmails}
                getSourceDisplayName={getSourceDisplayName}
              />`;

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1) {
  console.error('Start marker not found');
  process.exit(1);
}
if (endIdx === -1) {
  console.error('End marker not found');
  process.exit(1);
}

const before = content.slice(0, startIdx);
const after = content.slice(endIdx); // includes "\n\n              <AioEventsTab..."

const newContent = before + replacement + after;
const toWrite = hadCrlf ? newContent.replace(/\n/g, '\r\n') : newContent;
fs.writeFileSync(dashboardPath, toWrite);

console.log('Replaced Marketing block with MarketingTab component');
console.log('Removed', (content.length - newContent.length), 'characters');
