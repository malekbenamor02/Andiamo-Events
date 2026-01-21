/**
 * PhoneNumberPreview Component
 * Displays a preview of selected phone numbers with source labels
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { PhoneNumberWithMetadata } from '@/types/bulk-sms';
import { formatPhoneForDisplay, getSourceDisplayName } from '@/lib/phone-numbers';
import ExcelJS from 'exceljs';

interface PhoneNumberPreviewProps {
  phoneNumbers: PhoneNumberWithMetadata[];
  language: 'en' | 'fr';
  onExport?: () => void;
}

export function PhoneNumberPreview({ phoneNumbers, language, onExport }: PhoneNumberPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const displayNumbers = expanded ? phoneNumbers : phoneNumbers.slice(0, 10);

  const handleExport = async () => {
    if (onExport) {
      onExport();
      return;
    }

    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Phone Numbers');

      // Add header row
      worksheet.columns = [
        { header: language === 'en' ? 'Phone Number' : 'Numéro de Téléphone', key: 'phone', width: 20 },
        { header: language === 'en' ? 'Source' : 'Source', key: 'source', width: 30 },
        { header: language === 'en' ? 'City' : 'Ville', key: 'city', width: 15 },
        { header: language === 'en' ? 'Ville (Neighborhood)' : 'Quartier', key: 'ville', width: 20 }
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
      phoneNumbers.forEach(num => {
        worksheet.addRow({
          phone: formatPhoneForDisplay(num.phone),
          source: getSourceDisplayName(num.source, language),
          city: num.city || '',
          ville: num.ville || ''
        });
      });

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `phone_numbers_${dateStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting phone numbers:', error);
    } finally {
      setExporting(false);
    }
  };

  if (phoneNumbers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {language === 'en' ? 'Phone Numbers Preview' : 'Aperçu des Numéros'}
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
      <CardContent>
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'en' ? 'Phone Number' : 'Numéro'}</TableHead>
                <TableHead>{language === 'en' ? 'Source' : 'Source'}</TableHead>
                <TableHead>{language === 'en' ? 'City' : 'Ville'}</TableHead>
                <TableHead>{language === 'en' ? 'Ville' : 'Quartier'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayNumbers.map((num, index) => (
                <TableRow key={`${num.phone}-${num.source}-${index}`}>
                  <TableCell className="font-mono">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      {formatPhoneForDisplay(num.phone)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getSourceDisplayName(num.source, language)}
                    </Badge>
                  </TableCell>
                  <TableCell>{num.city || '-'}</TableCell>
                  <TableCell>{num.ville || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {phoneNumbers.length > 10 && (
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Show Less' : 'Afficher Moins'}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    {language === 'en' ? `Show All (${phoneNumbers.length})` : `Afficher Tout (${phoneNumbers.length})`}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
