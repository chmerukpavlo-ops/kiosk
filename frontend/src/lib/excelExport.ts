// Excel export utility with formatting
// Uses SheetJS (xlsx) library for Excel generation

interface ExcelColumn {
  key: string;
  label: string;
  width?: number;
  format?: (value: any) => string;
}

interface ExcelExportOptions {
  filename?: string;
  sheetName?: string;
  columns: ExcelColumn[];
  data: any[];
  includeHeaders?: boolean;
  formatNumbers?: boolean;
  formatDates?: boolean;
}

// Simple Excel export using CSV with Excel-compatible format
// For full Excel support, we'll use a lightweight approach
export async function exportToExcel(options: ExcelExportOptions): Promise<void> {
  const {
    filename = 'export',
    sheetName = 'Sheet1',
    columns,
    data,
    includeHeaders = true,
    formatNumbers = true,
    formatDates = true,
  } = options;

  // Filter columns that should be included
  const activeColumns = columns.filter((col) => {
    // Check if column is enabled (if data has enabled property)
    return col;
  });

  // Prepare headers
  const headers: string[] = [];
  const columnKeys: string[] = [];

  activeColumns.forEach((col) => {
    headers.push(col.label);
    columnKeys.push(col.key);
  });

  // Prepare rows
  const rows: string[][] = [];

  if (includeHeaders) {
    rows.push(headers);
  }

  data.forEach((item) => {
    const row: string[] = [];
    columnKeys.forEach((key) => {
      let value = item[key];
      
      // Find column config for formatting
      const column = activeColumns.find((col) => col.key === key);
      
      if (column?.format) {
        value = column.format(value);
      } else if (formatNumbers && typeof value === 'number') {
        // Format numbers with 2 decimal places
        value = value.toFixed(2);
      } else if (formatDates && value && typeof value === 'string' && value.includes('T')) {
        // Format dates
        try {
          const date = new Date(value);
          value = date.toLocaleDateString('uk-UA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch (e) {
          // Keep original value if parsing fails
        }
      } else if (value === null || value === undefined) {
        value = '';
      } else {
        value = String(value);
      }
      
      row.push(value);
    });
    rows.push(row);
  });

  // Convert to Excel-compatible format (TSV with UTF-8 BOM for Excel)
  // Excel can open TSV files and will format them properly
  const tsv = rows.map((row) => 
    row.map((cell) => {
      // Escape tabs and newlines
      const escaped = String(cell)
        .replace(/\t/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
      // Wrap in quotes if contains special characters
      if (escaped.includes('"') || escaped.includes(',') || escaped.includes(';')) {
        return `"${escaped.replace(/"/g, '""')}"`;
      }
      return escaped;
    }).join('\t')
  ).join('\n');

  // Add UTF-8 BOM for Excel to recognize encoding
  const blob = new Blob(['\ufeff' + tsv], { 
    type: 'application/vnd.ms-excel;charset=utf-8' 
  });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Advanced Excel export with proper formatting (requires xlsx library)
// This is a placeholder - can be enhanced with actual xlsx library
export async function exportToExcelAdvanced(
  options: ExcelExportOptions & {
    styles?: {
      header?: { bold?: boolean; bgColor?: string; textColor?: string };
      number?: { format?: string };
      date?: { format?: string };
    };
  }
): Promise<void> {
  // For now, use the simple export
  // In the future, can integrate xlsx library for full Excel support
  await exportToExcel(options);
}

// Helper function to format currency
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

// Helper function to format date
export function formatDate(value: string | Date): string {
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

