/**
 * BulkSmsResults Component
 * Displays results of bulk SMS sending operation
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, XCircle, Download, FileText, AlertCircle, 
  Phone, Send, TrendingUp
} from 'lucide-react';
import { formatPhoneForDisplay, getSourceDisplayName } from '@/lib/phone-numbers';
import ExcelJS from 'exceljs';

interface BulkSmsResultsProps {
  results: {
    total: number;
    sent: number;
    failed: number;
    results: Array<{
      phone: string;
      status: 'sent' | 'failed';
      source?: string;
      sourceId?: string;
      error?: string;
      sentAt?: string;
      apiResponse?: any;
    }>;
  };
  language: 'en' | 'fr';
  onExport?: () => void;
}

export function BulkSmsResults({ results, language, onExport }: BulkSmsResultsProps) {
  const [exporting, setExporting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const successRate = results.total > 0 ? ((results.sent / results.total) * 100).toFixed(1) : '0';

  const handleExport = async () => {
    if (onExport) {
      onExport();
      return;
    }

    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('SMS Results');

      // Add header row
      worksheet.columns = [
        { header: language === 'en' ? 'Phone Number' : 'Numéro de Téléphone', key: 'phone', width: 20 },
        { header: language === 'en' ? 'Status' : 'Statut', key: 'status', width: 15 },
        { header: language === 'en' ? 'Source' : 'Source', key: 'source', width: 30 },
        { header: language === 'en' ? 'Error' : 'Erreur', key: 'error', width: 40 },
        { header: language === 'en' ? 'Sent At' : 'Envoyé Le', key: 'sentAt', width: 20 }
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE21836' }
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Add data rows
      results.results.forEach(result => {
        worksheet.addRow({
          phone: formatPhoneForDisplay(result.phone),
          status: result.status === 'sent' 
            ? (language === 'en' ? 'Sent' : 'Envoyé')
            : (language === 'en' ? 'Failed' : 'Échoué'),
          source: result.source ? getSourceDisplayName(result.source as any, language) : '',
          error: result.error || '',
          sentAt: result.sentAt ? new Date(result.sentAt).toLocaleString() : ''
        });
      });

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      link.download = `sms_results_${dateStr}_${timeStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting results:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {language === 'en' ? 'SMS Results' : 'Résultats SMS'}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className="w-4 h-4 mr-2" />
            {language === 'en' ? 'Export' : 'Exporter'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <p className="text-sm text-muted-foreground">{language === 'en' ? 'Total' : 'Total'}</p>
            <p className="text-2xl font-bold">{results.total}</p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-sm text-muted-foreground">{language === 'en' ? 'Sent' : 'Envoyé'}</p>
            <p className="text-2xl font-bold text-green-500">{results.sent}</p>
          </div>
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-muted-foreground">{language === 'en' ? 'Failed' : 'Échoué'}</p>
            <p className="text-2xl font-bold text-red-500">{results.failed}</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-muted-foreground">{language === 'en' ? 'Success Rate' : 'Taux de Réussite'}</p>
            <p className="text-2xl font-bold text-blue-500">{successRate}%</p>
          </div>
        </div>

        {/* Alerts */}
        {results.failed > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {language === 'en' 
                ? `${results.failed} SMS failed to send. Check the details below.`
                : `${results.failed} SMS ont échoué. Vérifiez les détails ci-dessous.`}
            </AlertDescription>
          </Alert>
        )}

        {results.sent === results.total && results.total > 0 && (
          <Alert>
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              {language === 'en' 
                ? 'All SMS sent successfully!'
                : 'Tous les SMS ont été envoyés avec succès!'}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {language === 'en' ? 'Details' : 'Détails'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails 
                ? (language === 'en' ? 'Hide Details' : 'Masquer les Détails')
                : (language === 'en' ? 'Show Details' : 'Afficher les Détails')}
            </Button>
          </div>

          {showDetails && (
            <div className="max-h-[500px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'en' ? 'Phone' : 'Téléphone'}</TableHead>
                    <TableHead>{language === 'en' ? 'Source' : 'Source'}</TableHead>
                    <TableHead>{language === 'en' ? 'Status' : 'Statut'}</TableHead>
                    <TableHead>{language === 'en' ? 'Error' : 'Erreur'}</TableHead>
                    <TableHead>{language === 'en' ? 'Time' : 'Heure'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.results.map((result, index) => (
                    <TableRow key={`${result.phone}-${index}`}>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {formatPhoneForDisplay(result.phone)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.source ? (
                          <Badge variant="outline">
                            {getSourceDisplayName(result.source as any, language)}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {result.status === 'sent' ? (
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {language === 'en' ? 'Sent' : 'Envoyé'}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                            <XCircle className="w-3 h-3 mr-1" />
                            {language === 'en' ? 'Failed' : 'Échoué'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {result.error || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {result.sentAt 
                          ? new Date(result.sentAt).toLocaleString(language === 'en' ? 'en-US' : 'fr-FR')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
