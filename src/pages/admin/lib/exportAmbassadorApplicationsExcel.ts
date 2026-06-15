/**
 * Branded Excel export for ambassador applications (all applications list + draft selections).
 */

import type ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type {
  Ambassador,
  AmbassadorApplication,
  AmbassadorApplicationSelection,
  AmbassadorApplicationSelectionItem,
} from '../types';

const COLORS = {
  darkBackground: { argb: 'FF2A2A2A' },
  darkCharcoal: { argb: 'FF3A3A3A' },
  darkGray1: { argb: 'FF2F2F2F' },
  darkGray2: { argb: 'FF353535' },
  white: { argb: 'FFFFFFFF' },
  lightGray: { argb: 'FFB0B0B0' },
  green: { argb: 'FF22C55E' },
  redStatus: { argb: 'FFEF4444' },
  orange: { argb: 'FFF97316' },
  grey: { argb: 'FF6B7280' },
  border: { argb: 'FF3A3A3A' },
  innerBorder: { argb: 'FF2A2A2A' },
};

const BASE_HEADERS = [
  'Name',
  'Age',
  'Phone',
  'Email',
  'City',
  'Ville',
  'Status',
  'Instagram',
  'Applied Date',
];

const COLUMN_WIDTHS = [25, 8, 15, 30, 15, 15, 12, 25, 15, 18, 18];

export function formatInstagramLink(
  link: string | undefined,
): { displayText: string; url: string } | null {
  if (!link || link === '-') return null;

  let username = link.trim();
  username = username.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  username = username.replace(/^instagram\.com\//i, '');
  username = username.replace(/^@/, '');
  username = username.replace(/\/$/, '');
  username = username.split('?')[0];
  username = username.split('/')[0];

  if (!username) return null;

  const displayText = username.startsWith('@') ? username : `@${username}`;
  const url = `https://instagram.com/${username.replace('@', '')}`;
  return { displayText, url };
}

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80)
      .trim() || 'draft'
  );
}

function buildTimestampFilename(prefix: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `${prefix}_${dateStr}_${timeStr}.xlsx`;
}

async function createExcelWorkbook() {
  const { default: ExcelJSModule } = await import('exceljs');
  return new ExcelJSModule.Workbook();
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function getVille(application: AmbassadorApplication, ambassadors: Ambassador[]): string {
  let ville = application.ville || '';
  if (!ville && (application.city === 'Sousse' || application.city === 'Tunis')) {
    const matchingAmbassador = ambassadors.find(
      (amb) =>
        amb.phone === application.phone_number ||
        (application.email && amb.email === application.email),
    );
    ville = matchingAmbassador?.ville || '';
  }
  return ville;
}

function getStatusDisplay(status: string): { text: string; color: { argb: string } } {
  switch (status) {
    case 'approved':
      return { text: 'Active', color: COLORS.green };
    case 'pending':
      return { text: 'Pending', color: COLORS.orange };
    case 'rejected':
      return { text: 'Rejected', color: COLORS.redStatus };
    case 'removed':
      return { text: 'Removed', color: COLORS.redStatus };
    case 'suspended':
      return { text: 'Paused', color: COLORS.grey };
    default:
      return { text: status, color: COLORS.lightGray };
  }
}

function styleTitleCell(
  worksheet: ExcelJS.Worksheet,
  title: string,
  mergeEndCol: string,
) {
  worksheet.mergeCells(`A1:${mergeEndCol}1`);

  const titleRow = worksheet.getRow(1);
  titleRow.height = 30;
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: COLORS.white };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.darkBackground };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.getCell(1).border = {
    top: { style: 'thin', color: COLORS.border },
    bottom: { style: 'thin', color: COLORS.border },
    left: { style: 'thin', color: COLORS.border },
    right: { style: 'thin', color: COLORS.border },
  };
}

function styleHeaderRow(worksheet: ExcelJS.Worksheet, rowNum: number, headers: string[]) {
  const headerRow = worksheet.getRow(rowNum);
  headerRow.height = 25;

  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Arial', size: 11, bold: true, color: COLORS.white };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.darkCharcoal };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: COLORS.border },
      bottom: { style: 'thin', color: COLORS.border },
      left: { style: 'thin', color: COLORS.border },
      right: { style: 'thin', color: COLORS.border },
    };
  });

  headers.forEach((_, index) => {
    worksheet.getColumn(index + 1).width = COLUMN_WIDTHS[index] ?? 15;
  });
}

function writeApplicationRow(
  worksheet: ExcelJS.Worksheet,
  rowNum: number,
  application: AmbassadorApplication,
  ambassadors: Ambassador[],
  rowIndex: number,
  extraCells?: [string, string],
) {
  const row = worksheet.getRow(rowNum);
  row.height = 20;
  const rowColor = rowIndex % 2 === 0 ? COLORS.darkGray1 : COLORS.darkGray2;

  const ville = getVille(application, ambassadors);
  const { text: statusText, color: statusColor } = getStatusDisplay(application.status);
  const instagramInfo = formatInstagramLink(application.social_link);
  const instagramDisplay = instagramInfo ? instagramInfo.displayText : '-';

  const cells: (string | number)[] = [
    application.full_name,
    application.age || 0,
    application.phone_number,
    application.email || '-',
    application.city,
    ville || '-',
    statusText,
    instagramDisplay,
    new Date(application.created_at).toLocaleDateString(),
  ];

  if (extraCells) {
    cells.push(extraCells[0], extraCells[1]);
  }

  cells.forEach((value, cellIndex) => {
    const cell = row.getCell(cellIndex + 1);

    if (cellIndex === 7 && instagramInfo) {
      cell.value = { text: instagramInfo.displayText, hyperlink: instagramInfo.url };
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF6B7280' }, underline: true };
    } else {
      cell.value = value;
      if (cellIndex === 6) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: statusColor };
      } else if (cellIndex === 0 || cellIndex === 2) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: COLORS.white };
      } else {
        cell.font = { name: 'Arial', size: 10, color: COLORS.lightGray };
      }
    }

    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: rowColor };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: COLORS.innerBorder },
      bottom: { style: 'thin', color: COLORS.innerBorder },
      left: { style: 'thin', color: COLORS.innerBorder },
      right: { style: 'thin', color: COLORS.innerBorder },
    };
  });
}

function addOuterBorder(worksheet: ExcelJS.Worksheet, lastRow: number, colCount: number) {
  for (let row = 1; row <= lastRow; row++) {
    for (let col = 1; col <= colCount; col++) {
      const cell = worksheet.getCell(row, col);
      if (row === 1 || row === lastRow || col === 1 || col === colCount) {
        if (!cell.border) cell.border = {};
        if (row === 1) cell.border.top = { style: 'medium', color: COLORS.border };
        if (row === lastRow) cell.border.bottom = { style: 'medium', color: COLORS.border };
        if (col === 1) cell.border.left = { style: 'medium', color: COLORS.border };
        if (col === colCount) cell.border.right = { style: 'medium', color: COLORS.border };
      }
    }
  }
}

function addFooter(worksheet: ExcelJS.Worksheet, lastRow: number, mergeEndCol: string) {
  const footerRowNum = lastRow + 2;
  const footerRow = worksheet.getRow(footerRowNum);
  footerRow.height = 20;
  const footerCell = worksheet.getCell(`A${footerRowNum}`);
  footerCell.value = `Generated by Andiamo Events on ${new Date().toLocaleString()}`;
  footerCell.font = { name: 'Arial', size: 9, color: COLORS.lightGray, italic: true };
  footerCell.alignment = { horizontal: 'right' };
  worksheet.mergeCells(`A${footerRowNum}:${mergeEndCol}${footerRowNum}`);
}

function styleMetadataRow(
  worksheet: ExcelJS.Worksheet,
  rowNum: number,
  text: string,
  mergeEndCol: string,
) {
  const metaRow = worksheet.getRow(rowNum);
  metaRow.height = 22;
  const metaCell = worksheet.getCell(`A${rowNum}`);
  metaCell.value = text;
  metaCell.font = { name: 'Arial', size: 10, color: COLORS.lightGray };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.darkBackground };
  metaCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.mergeCells(`A${rowNum}:${mergeEndCol}${rowNum}`);
}

export async function exportAmbassadorApplicationsListExcel(params: {
  applications: AmbassadorApplication[];
  ambassadors: Ambassador[];
  filename?: string;
}): Promise<number> {
  const { applications, ambassadors, filename } = params;
  const colCount = BASE_HEADERS.length;
  const mergeEndCol = 'I';

  const workbook = await createExcelWorkbook();
  const worksheet = workbook.addWorksheet('Ambassadors List');

  styleTitleCell(worksheet, 'ANDIAMO EVENTS – AMBASSADORS LIST', mergeEndCol);
  worksheet.getRow(2).height = 10;
  styleHeaderRow(worksheet, 3, BASE_HEADERS);

  applications.forEach((application, index) => {
    writeApplicationRow(worksheet, index + 4, application, ambassadors, index);
  });

  const lastRow = applications.length + 3;
  addOuterBorder(worksheet, lastRow, colCount);
  addFooter(worksheet, lastRow, mergeEndCol);

  await downloadWorkbook(
    workbook,
    filename ?? buildTimestampFilename('Andiamo_Events_Ambassadors_List'),
  );

  return applications.length;
}

export async function exportDraftSelectionToExcel(params: {
  selection: AmbassadorApplicationSelection;
  selectionItems: AmbassadorApplicationSelectionItem[];
  applications: AmbassadorApplication[];
  ambassadors: Ambassador[];
}): Promise<number> {
  const { selection, selectionItems, applications, ambassadors } = params;
  const colCount = BASE_HEADERS.length + 2;
  const mergeEndCol = 'K';
  const draftHeaders = [...BASE_HEADERS, 'Added By', 'Added to Draft'];

  const itemByAppId = new Map(
    selectionItems.map((item) => [item.application_id, item]),
  );
  const appById = new Map(applications.map((app) => [app.id, app]));
  const draftApplications = selectionItems
    .map((item) => appById.get(item.application_id))
    .filter((app): app is AmbassadorApplication => app != null);

  const workbook = await createExcelWorkbook();
  const worksheet = workbook.addWorksheet('Draft Selection');

  styleTitleCell(
    worksheet,
    `ANDIAMO EVENTS – DRAFT SELECTION: ${selection.name}`,
    mergeEndCol,
  );

  const createdBy = selection.created_by_name?.trim() || 'Unknown';
  const createdAt = format(new Date(selection.created_at), 'dd/MM/yyyy HH:mm');
  styleMetadataRow(
    worksheet,
    2,
    `Created by: ${createdBy}  |  Created: ${createdAt}  |  Total applications: ${draftApplications.length}`,
    mergeEndCol,
  );

  worksheet.getRow(3).height = 10;
  styleHeaderRow(worksheet, 4, draftHeaders);

  draftApplications.forEach((application, index) => {
    const item = itemByAppId.get(application.id);
    const addedBy = item?.added_by_name?.trim() || '-';
    const addedAt = item?.added_at
      ? format(new Date(item.added_at), 'dd/MM/yyyy HH:mm')
      : '-';
    writeApplicationRow(worksheet, index + 5, application, ambassadors, index, [
      addedBy,
      addedAt,
    ]);
  });

  const lastRow = draftApplications.length + 4;
  addOuterBorder(worksheet, lastRow, colCount);
  addFooter(worksheet, lastRow, mergeEndCol);

  const filename = buildTimestampFilename(sanitizeFilename(selection.name));
  await downloadWorkbook(workbook, filename);

  return draftApplications.length;
}
