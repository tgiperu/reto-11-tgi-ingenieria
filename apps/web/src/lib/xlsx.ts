import type { Cell } from "exceljs";

export type Grid = unknown[][];

export interface GridFile {
  grid: Grid;
  sheet: string;
  sheets: string[];
}

const PREFERRED_SHEET = "base de datos";
const LINE_BREAK = /\r?\n/;
const CSV_SPECIAL = /[",\n;]/;
const CSV_DELIMITERS = [",", ";", "\t"] as const;
const BYTES_PER_KB = 1024;

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(LINE_BREAK, 1)[0] ?? "";
  let best: string = CSV_DELIMITERS[0];
  let bestCount = -1;
  for (const d of CSV_DELIMITERS) {
    const count = firstLine.split(d).length;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** CSV con comillas dobles y saltos de línea dentro de campos. */
export function parseCsv(text: string): Grid {
  const clean = text.charCodeAt(0) === 0xfe_ff ? text.slice(1) : text;
  const delimiter = detectDelimiter(clean);
  const rows: Grid = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((v) => v.trim() !== "")) {
      rows.push(row);
    }
    row = [];
  };
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean.charAt(i);
    if (quoted) {
      if (ch === '"' && clean.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === "\n") {
      endRow();
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    endRow();
  }
  return rows;
}

function plainValue(value: Cell["value"]): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    value instanceof Date ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "VERDADERO" : "FALSO";
  }
  if ("result" in value) {
    return plainValue(value.result as Cell["value"]);
  }
  if ("richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  if ("text" in value) {
    return String(value.text);
  }
  return null;
}

export async function readGridFile(
  file: File,
  sheetName?: string
): Promise<GridFile> {
  const isCsv =
    file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
  if (isCsv) {
    return { grid: parseCsv(await file.text()), sheet: "CSV", sheets: ["CSV"] };
  }
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheets = workbook.worksheets.map((w) => w.name);
  const preferred = sheets.find((n) => n.toLowerCase() === PREFERRED_SHEET);
  const sheet = sheetName ?? preferred ?? sheets[0] ?? "";
  const ws = workbook.getWorksheet(sheet);
  const grid: Grid = [];
  ws?.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as Cell["value"][]).slice(1);
    grid.push(values.map(plainValue));
  });
  return { grid, sheet, sheets };
}

export interface SheetData {
  headers: string[];
  name: string;
  rows: unknown[][];
  widths?: number[];
}

const HEADER_FILL = "FF245237";
const MIN_COLUMN_WIDTH = 10;
const MAX_COLUMN_WIDTH = 42;

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), BYTES_PER_KB);
}

export async function downloadWorkbook(
  fileName: string,
  sheets: readonly SheetData[]
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  for (const data of sheets) {
    const ws = workbook.addWorksheet(data.name.slice(0, 31));
    ws.addRow(data.headers);
    for (const row of data.rows) {
      ws.addRow(row);
    }
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      fgColor: { argb: HEADER_FILL },
      pattern: "solid",
      type: "pattern",
    };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const [i, h] of data.headers.entries()) {
      const longest = data.rows.reduce(
        (acc, r) => Math.max(acc, String(r[i] ?? "").length),
        h.length
      );
      ws.getColumn(i + 1).width =
        data.widths?.[i] ??
        Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, longest + 2));
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    fileName
  );
}

export function downloadCsv(
  fileName: string,
  headers: readonly string[],
  rows: readonly unknown[][]
): void {
  const esc = (v: unknown) => {
    const text = String(v ?? "");
    return CSV_SPECIAL.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const body = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  saveBlob(new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8" }), fileName);
}
