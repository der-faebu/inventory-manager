// Hand-written type declaration for the vendored SheetJS build xlsx.full.min.js.
// Only the subset of the XLSX API actually used by web/src/lib/excel-export.ts is typed.
// The UMD build only exposes a default export under Node/Vite ESM interop.

export interface WorkSheet {
  [cellRef: string]: unknown;
  '!cols'?: Array<{ wch: number }>;
  '!autofilter'?: { ref: string };
  '!rows'?: Array<{ level: number } | undefined>;
  '!outline'?: { above?: boolean; left?: boolean };
}

export interface WorkBook {
  SheetNames: string[];
  Sheets: Record<string, WorkSheet>;
}

export interface XLSXStatic {
  utils: {
    book_new: () => WorkBook;
    book_append_sheet: (workbook: WorkBook, sheet: WorkSheet, name: string) => void;
    aoa_to_sheet: (rows: unknown[][]) => WorkSheet;
    encode_col: (col: number) => string;
    sheet_to_json: (sheet: WorkSheet, opts?: { header?: number }) => unknown[][];
  };
  write: (workbook: WorkBook, opts: { type: 'array'; bookType: 'xlsx' }) => ArrayBuffer;
  read: (data: ArrayBuffer, opts: { type: 'array' }) => WorkBook;
  version: string;
}

declare const XLSX: XLSXStatic;
export default XLSX;
