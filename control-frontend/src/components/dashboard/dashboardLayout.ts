import { WIDGET_IDS, type WidgetId } from "./types";

export const DASHBOARD_WIDGET_STORAGE_KEY =
  "dishpatch.control.dashboard.widgets.v2";

export const DASHBOARD_RESET_VIEW_EVENT = "dashboard:reset-widget-view";

export const MIN_ROW_HEIGHT = 260;
export const DEFAULT_ROW_HEIGHT = 420;
export const MIN_COLUMN_WIDTH = 18;

export type DropPosition = "top" | "right" | "bottom" | "left";

export interface DashboardWidgetColumn {
  widgetId: WidgetId;
  width: number;
}

export interface DashboardWidgetRow {
  id: string;
  height: number;
  columns: DashboardWidgetColumn[];
}

export interface DashboardWidgetState {
  rows: DashboardWidgetRow[];
  visibleWidgetIds: WidgetId[];
}

const DEFAULT_ROWS: DashboardWidgetRow[] = [
  {
    id: "row-main",
    height: 620,
    columns: [
      { widgetId: "robot-map", width: 60 },
      { widgetId: "robot-list", width: 40 },
    ],
  },
  {
    id: "row-secondary",
    height: 360,
    columns: [
      { widgetId: "pos-orders", width: 50 },
      { widgetId: "alerts-notifications", width: 50 },
    ],
  },
];

const DEFAULT_VISIBLE_WIDGETS = [...WIDGET_IDS];
const WIDGET_ID_SET = new Set<string>(WIDGET_IDS);

export function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && WIDGET_ID_SET.has(value);
}

export function createDashboardRowId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `row-${crypto.randomUUID()}`;
  }

  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultWidgetState(): DashboardWidgetState {
  return {
    rows: cloneRows(DEFAULT_ROWS),
    visibleWidgetIds: [...DEFAULT_VISIBLE_WIDGETS],
  };
}

export function readStoredWidgetState(): DashboardWidgetState {
  if (typeof window === "undefined") {
    return defaultWidgetState();
  }

  let storedValue: string | null;

  try {
    storedValue = window.localStorage.getItem(DASHBOARD_WIDGET_STORAGE_KEY);
  } catch {
    return defaultWidgetState();
  }

  if (!storedValue) {
    return defaultWidgetState();
  }

  try {
    const parsed = JSON.parse(storedValue) as {
      rows?: unknown;
      visibleWidgetIds?: unknown;
    };
    const visibleWidgetIds = parseVisibleWidgetIds(parsed.visibleWidgetIds);
    const rows = parseRows(parsed.rows);

    if (!visibleWidgetIds || !rows) {
      return defaultWidgetState();
    }

    return sanitizeWidgetState({ rows, visibleWidgetIds });
  } catch {
    return defaultWidgetState();
  }
}

export function sanitizeWidgetState(
  state: DashboardWidgetState,
): DashboardWidgetState {
  const visibleWidgetIds = uniqueWidgetIds(state.visibleWidgetIds);
  const visibleIdSet = new Set<WidgetId>(visibleWidgetIds);
  const seenWidgetIds = new Set<WidgetId>();
  const seenRowIds = new Set<string>();
  const rows: DashboardWidgetRow[] = [];

  for (const row of state.rows) {
    const columns = row.columns.filter((column) => {
      if (
        !visibleIdSet.has(column.widgetId) ||
        seenWidgetIds.has(column.widgetId)
      ) {
        return false;
      }

      seenWidgetIds.add(column.widgetId);
      return true;
    });

    if (columns.length > 0) {
      rows.push({
        id: getUniqueRowId(row.id, seenRowIds),
        height: normalizeRowHeight(row.height),
        columns: normalizeColumns(columns),
      });
    }
  }

  for (const widgetId of visibleWidgetIds) {
    if (!seenWidgetIds.has(widgetId)) {
      rows.push(createSingleWidgetRow(widgetId));
      seenWidgetIds.add(widgetId);
    }
  }

  return { rows, visibleWidgetIds };
}

export function hideWidgetInState(
  state: DashboardWidgetState,
  widgetId: WidgetId,
) {
  return sanitizeWidgetState({
    visibleWidgetIds: state.visibleWidgetIds.filter((id) => id !== widgetId),
    rows: removeWidgetFromRows(state.rows, widgetId),
  });
}

export function showWidgetInState(
  state: DashboardWidgetState,
  widgetId: WidgetId,
) {
  if (state.visibleWidgetIds.includes(widgetId)) {
    return hideWidgetInState(state, widgetId);
  }

  return sanitizeWidgetState({
    visibleWidgetIds: [...state.visibleWidgetIds, widgetId],
    rows: appendWidgetAsRow(removeWidgetFromRows(state.rows, widgetId), widgetId),
  });
}

export function moveWidgetToBottom(
  rows: DashboardWidgetRow[],
  widgetId: WidgetId,
) {
  return appendWidgetAsRow(removeWidgetFromRows(rows, widgetId), widgetId);
}

export function moveWidgetNearTarget(
  rows: DashboardWidgetRow[],
  widgetId: WidgetId,
  targetWidgetId: WidgetId,
  position: DropPosition,
) {
  if (widgetId === targetWidgetId) {
    return rows;
  }

  const rowsWithoutWidget = removeWidgetFromRows(rows, widgetId);
  const targetRowIndex = rowsWithoutWidget.findIndex((row) =>
    row.columns.some((column) => column.widgetId === targetWidgetId),
  );

  if (targetRowIndex === -1) {
    return rows;
  }

  if (position === "top" || position === "bottom") {
    const targetRow = rowsWithoutWidget[targetRowIndex];
    const insertIndex = position === "top" ? targetRowIndex : targetRowIndex + 1;
    const nextRows = [...rowsWithoutWidget];

    nextRows.splice(
      insertIndex,
      0,
      createSingleWidgetRow(widgetId, targetRow.height),
    );

    return nextRows;
  }

  return rowsWithoutWidget.map((row, rowIndex) => {
    if (rowIndex !== targetRowIndex) {
      return row;
    }

    const targetColumnIndex = row.columns.findIndex(
      (column) => column.widgetId === targetWidgetId,
    );

    if (targetColumnIndex === -1) {
      return row;
    }

    const insertIndex =
      position === "left" ? targetColumnIndex : targetColumnIndex + 1;
    const insertedWidth = 100 / (row.columns.length + 1);
    const retainedWidthScale = (100 - insertedWidth) / 100;
    const columns = row.columns.map((column) => ({
      ...column,
      width: column.width * retainedWidthScale,
    }));

    columns.splice(insertIndex, 0, { widgetId, width: insertedWidth });

    return { ...row, columns: normalizeColumns(columns) };
  });
}

export function setRowHeight(
  rows: DashboardWidgetRow[],
  rowId: string,
  height: number,
) {
  return rows.map((row) =>
    row.id === rowId ? { ...row, height: normalizeRowHeight(height) } : row,
  );
}

export function setColumnPairWidths(
  rows: DashboardWidgetRow[],
  rowId: string,
  columnIndex: number,
  leftWidth: number,
  rightWidth: number,
) {
  return rows.map((row) => {
    if (row.id !== rowId || columnIndex < 0 || columnIndex >= row.columns.length - 1) {
      return row;
    }

    const columns = [...row.columns];
    columns[columnIndex] = { ...columns[columnIndex], width: leftWidth };
    columns[columnIndex + 1] = {
      ...columns[columnIndex + 1],
      width: rightWidth,
    };

    return { ...row, columns: normalizeColumns(columns) };
  });
}

function parseVisibleWidgetIds(value: unknown) {
  if (!Array.isArray(value) || !value.every(isWidgetId)) {
    return null;
  }

  return uniqueWidgetIds(value);
}

function parseRows(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows: DashboardWidgetRow[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const row = item as {
      id?: unknown;
      height?: unknown;
      columns?: unknown;
    };

    if (
      typeof row.id !== "string" ||
      typeof row.height !== "number" ||
      !Array.isArray(row.columns)
    ) {
      return null;
    }

    const columns: DashboardWidgetColumn[] = [];

    for (const columnItem of row.columns) {
      if (!columnItem || typeof columnItem !== "object") {
        return null;
      }

      const column = columnItem as { widgetId?: unknown; width?: unknown };

      if (!isWidgetId(column.widgetId) || typeof column.width !== "number") {
        return null;
      }

      columns.push({
        widgetId: column.widgetId,
        width: column.width,
      });
    }

    rows.push({
      id: row.id,
      height: row.height,
      columns,
    });
  }

  return rows;
}

function appendWidgetAsRow(rows: DashboardWidgetRow[], widgetId: WidgetId) {
  return [...rows, createSingleWidgetRow(widgetId)];
}

function createSingleWidgetRow(
  widgetId: WidgetId,
  height = DEFAULT_ROW_HEIGHT,
): DashboardWidgetRow {
  return {
    id: createDashboardRowId(),
    height,
    columns: [{ widgetId, width: 100 }],
  };
}

function removeWidgetFromRows(rows: DashboardWidgetRow[], widgetId: WidgetId) {
  return rows
    .map((row) => ({
      ...row,
      columns: row.columns.filter((column) => column.widgetId !== widgetId),
    }))
    .filter((row) => row.columns.length > 0)
    .map((row) => ({ ...row, columns: normalizeColumns(row.columns) }));
}

function normalizeColumns(columns: DashboardWidgetColumn[]) {
  if (columns.length === 0) {
    return [];
  }

  const fallbackWidth = 100 / columns.length;
  const rawColumns = columns.map((column) => ({
    widgetId: column.widgetId,
    width:
      Number.isFinite(column.width) && column.width > 0
        ? column.width
        : fallbackWidth,
  }));
  const totalWidth = rawColumns.reduce((total, column) => total + column.width, 0);

  if (totalWidth <= 0) {
    return rawColumns.map((column) => ({ ...column, width: fallbackWidth }));
  }

  return rawColumns.map((column) => ({
    ...column,
    width: (column.width / totalWidth) * 100,
  }));
}

function normalizeRowHeight(height: number) {
  return Number.isFinite(height)
    ? Math.max(MIN_ROW_HEIGHT, height)
    : DEFAULT_ROW_HEIGHT;
}

function getUniqueRowId(rowId: string, seenRowIds: Set<string>) {
  let nextRowId = rowId.trim();

  while (!nextRowId || seenRowIds.has(nextRowId)) {
    nextRowId = createDashboardRowId();
  }

  seenRowIds.add(nextRowId);
  return nextRowId;
}

function uniqueWidgetIds(widgetIds: WidgetId[]) {
  return widgetIds.filter(
    (widgetId, index) => widgetIds.indexOf(widgetId) === index,
  );
}

function cloneRows(rows: DashboardWidgetRow[]) {
  return rows.map((row) => ({
    ...row,
    columns: row.columns.map((column) => ({ ...column })),
  }));
}
