import { WIDGET_IDS, type WidgetId } from "./types";

export const DASHBOARD_WIDGET_STORAGE_KEY =
  "dishpatch.control.dashboard.widgets.v5";

export const DASHBOARD_RESET_VIEW_EVENT = "dashboard:reset-widget-view";

export const MIN_ROW_HEIGHT = 260;
export const DEFAULT_ROW_HEIGHT = 420;
export const MIN_COLUMN_WIDTH = 18;

export interface DashboardWidgetColumn {
  widgetIds: WidgetId[];
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
    height: 480,
    columns: [
      { widgetIds: ["robot-map"], width: 61.5 },
      { widgetIds: ["robot-list", "pos-orders"], width: 38.5 },
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
    const columns = row.columns
      .map((column) => {
        const widgetIds = column.widgetIds.filter((widgetId) => {
          if (!visibleIdSet.has(widgetId) || seenWidgetIds.has(widgetId)) {
            return false;
          }

          seenWidgetIds.add(widgetId);
          return true;
        });

        return { ...column, widgetIds };
      })
      .filter((column) => column.widgetIds.length > 0);

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

      const column = columnItem as { widgetIds?: unknown; width?: unknown };

      if (
        !Array.isArray(column.widgetIds) ||
        column.widgetIds.length === 0 ||
        !column.widgetIds.every(isWidgetId) ||
        typeof column.width !== "number"
      ) {
        return null;
      }

      columns.push({
        widgetIds: column.widgetIds,
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
    columns: [{ widgetIds: [widgetId], width: 100 }],
  };
}

function removeWidgetFromRows(rows: DashboardWidgetRow[], widgetId: WidgetId) {
  return rows
    .map((row) => ({
      ...row,
      columns: row.columns
        .map((column) => ({
          ...column,
          widgetIds: column.widgetIds.filter((id) => id !== widgetId),
        }))
        .filter((column) => column.widgetIds.length > 0),
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
    widgetIds: column.widgetIds,
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
    columns: row.columns.map((column) => ({
      ...column,
      widgetIds: [...column.widgetIds],
    })),
  }));
}
