import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useDashboardWidgets } from "../../context/DashboardWidgetsContext";
import { AlertsSnackbarStack } from "./AlertsNotificationsWidget";
import {
  DEFAULT_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_STACK_PANE_HEIGHT,
  setColumnPairWidths,
  setRowHeight,
  setStackPairHeights,
  type DashboardWidgetColumn,
  type DashboardWidgetRow,
} from "./dashboardLayout";
import { WIDGET_BY_ID } from "./widgetRegistry";
import type { DashboardWidgetDefinition, WidgetId } from "./types";

interface RowResizeState {
  rowId: string;
  startY: number;
  startHeight: number;
}

interface ColumnResizeState {
  rowId: string;
  columnIndex: number;
  startX: number;
  rowWidth: number;
  leftWidth: number;
  rightWidth: number;
}

const DESKTOP_WIDGET_MEDIA_QUERY = "(min-width: 1024px)";

/** Matches the gap-3 utility between stacked widgets. */
const STACK_GAP_PX = 12;

function getMediaQueryMatches(query: string) {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => getMediaQueryMatches(query));

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQueryList.matches);

    handleChange();
    mediaQueryList.addEventListener("change", handleChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

function WidgetBody({ widget }: { widget: DashboardWidgetDefinition }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-1 sm:px-5 sm:pb-5 sm:pt-1.5">
      {widget.render()}
    </div>
  );
}

function WidgetHeader({ widget }: { widget: DashboardWidgetDefinition }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
      <h3 className="min-w-0 truncate text-theme-xl font-semibold text-gray-900 dark:text-white">
        {widget.title}
      </h3>
      <div className="flex shrink-0 items-center gap-2">
        {widget.renderHeaderActions?.()}
      </div>
    </div>
  );
}

function WidgetFrame({
  widget,
  children,
}: {
  widget: DashboardWidgetDefinition;
  children?: ReactNode;
}) {
  const frameContent = (
    <>
      <WidgetHeader widget={widget} />
      <WidgetBody widget={widget} />
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs transition dark:border-gray-800 dark:bg-white/[0.03]">
      {widget.wrap ? widget.wrap(frameContent) : frameContent}
      {children}
    </div>
  );
}

function MobileWidget({ widget }: { widget: DashboardWidgetDefinition }) {
  const content = (
    <>
      <WidgetHeader widget={widget} />
      <WidgetBody widget={widget} />
    </>
  );

  return (
    <div
      className="flex flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
      style={{ height: DEFAULT_ROW_HEIGHT }}
    >
      {widget.wrap ? widget.wrap(content) : content}
    </div>
  );
}

function WidgetTile({ widget }: { widget: DashboardWidgetDefinition }) {
  return <WidgetFrame widget={widget} />;
}

function RowResizeHandle({
  onResizeStart,
  label = "Resize row",
}: {
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="group absolute inset-x-5 -bottom-2 z-30 flex h-4 cursor-row-resize touch-none items-center justify-center rounded-full focus:outline-none"
      onPointerDown={onResizeStart}
      aria-label={label}
      title={label}
    >
      <span className="h-px w-24 rounded-full bg-gray-200 transition group-hover:h-1 group-hover:bg-brand-400 dark:bg-gray-700 dark:group-hover:bg-brand-400" />
    </button>
  );
}

function ColumnResizeHandle({
  onResizeStart,
}: {
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className="group absolute -right-2 top-0 z-30 flex h-full w-4 cursor-col-resize touch-none items-center justify-center focus:outline-none"
      onPointerDown={onResizeStart}
      aria-label="Resize widget columns"
      title="Resize columns"
    >
      <span className="h-12 w-px rounded-full bg-gray-200 transition group-hover:bg-brand-400 dark:bg-gray-700 dark:group-hover:bg-brand-400" />
    </button>
  );
}

function WidgetStack({
  column,
  columnIndex,
  rowId,
}: {
  column: DashboardWidgetColumn;
  columnIndex: number;
  rowId: string;
}) {
  const { setWidgetState } = useDashboardWidgets();
  const stackRef = useRef<HTMLDivElement>(null);

  const fallbackHeight = 100 / column.widgetIds.length;
  const panes = column.widgetIds.flatMap((widgetId, index) => {
    const widget = WIDGET_BY_ID.get(widgetId);
    const height = column.heights?.[index] ?? fallbackHeight;

    return widget ? [{ widget, height }] : [];
  });

  if (panes.length === 0) {
    return null;
  }

  function handleResizeStart(
    stackIndex: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    // Gaps are fixed, so only the space the panes flex into scales the drag.
    const stackHeight = stackRef.current?.getBoundingClientRect().height ?? 0;
    const flexSpace = stackHeight - (panes.length - 1) * STACK_GAP_PX;

    if (flexSpace <= 0) {
      return;
    }

    const startY = event.clientY;
    const startHeight = panes[stackIndex].height;
    const pairTotal = startHeight + panes[stackIndex + 1].height;
    const pairMin = Math.min(
      (MIN_STACK_PANE_HEIGHT / flexSpace) * 100,
      pairTotal / 2,
    );
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaPercent = ((moveEvent.clientY - startY) / flexSpace) * 100;
      const topHeight = Math.min(
        Math.max(startHeight + deltaPercent, pairMin),
        pairTotal - pairMin,
      );

      setWidgetState((currentState) => ({
        ...currentState,
        rows: setStackPairHeights(
          currentState.rows,
          rowId,
          columnIndex,
          stackIndex,
          topHeight,
          pairTotal - topHeight,
        ),
      }));
    }

    function finishResize() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      window.removeEventListener("blur", finishResize);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
    window.addEventListener("blur", finishResize);
  }

  return (
    <div ref={stackRef} className="flex h-full flex-col gap-3">
      {panes.map((pane, stackIndex) => (
        <div
          key={pane.widget.id}
          className="relative min-h-0"
          style={{ flexGrow: pane.height, flexBasis: 0 }}
        >
          <WidgetTile widget={pane.widget} />
          {stackIndex < panes.length - 1 && (
            <RowResizeHandle
              label="Resize widgets"
              onResizeStart={(handleEvent) =>
                handleResizeStart(stackIndex, handleEvent)
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function DashboardRow({
  row,
  onColumnResizeStart,
  onRowResizeStart,
}: {
  row: DashboardWidgetRow;
  onColumnResizeStart: (
    row: DashboardWidgetRow,
    columnIndex: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onRowResizeStart: (
    row: DashboardWidgetRow,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
}) {
  return (
    <div
      className="relative flex-1"
      data-dashboard-row="true"
      style={{
        minHeight: row.height,
        flexBasis: 0,
      }}
    >
      <div
        className="grid h-full gap-3"
        style={{
          gridTemplateColumns: row.columns
            .map((column) => `minmax(0, ${column.width}fr)`)
            .join(" "),
        }}
      >
        {row.columns.map((column, columnIndex) => (
          <div
            key={column.widgetIds.join("-")}
            className="relative min-h-0 min-w-0"
          >
            <WidgetStack
              column={column}
              columnIndex={columnIndex}
              rowId={row.id}
            />
            {columnIndex < row.columns.length - 1 && (
              <ColumnResizeHandle
                onResizeStart={(event) =>
                  onColumnResizeStart(row, columnIndex, event)
                }
              />
            )}
          </div>
        ))}
      </div>
      <RowResizeHandle onResizeStart={(event) => onRowResizeStart(row, event)} />
    </div>
  );
}

function DesktopWorkspace({
  onColumnResizeStart,
  rows,
  onRowResizeStart,
}: {
  onColumnResizeStart: (
    row: DashboardWidgetRow,
    columnIndex: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  rows: DashboardWidgetRow[];
  onRowResizeStart: (
    row: DashboardWidgetRow,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-theme-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400">
        Select at least one widget to build the dashboard.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {rows.map((row) => (
        <DashboardRow
          key={row.id}
          row={row}
          onColumnResizeStart={onColumnResizeStart}
          onRowResizeStart={onRowResizeStart}
        />
      ))}
    </div>
  );
}

export default function DashboardWidgets() {
  const { widgetState, setWidgetState, visibleWidgets } =
    useDashboardWidgets();
  const [rowResizeState, setRowResizeState] = useState<RowResizeState | null>(
    null,
  );
  const [columnResizeState, setColumnResizeState] =
    useState<ColumnResizeState | null>(null);
  const isDesktopWorkspace = useMediaQuery(DESKTOP_WIDGET_MEDIA_QUERY);

  const { rows } = widgetState;

  useEffect(() => {
    setRowResizeState(null);
    setColumnResizeState(null);
  }, [isDesktopWorkspace]);

  useEffect(() => {
    if (!rowResizeState) {
      return;
    }

    const { rowId, startHeight, startY } = rowResizeState;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(event: PointerEvent) {
      const nextHeight = startHeight + event.clientY - startY;

      setWidgetState((currentState) => ({
        ...currentState,
        rows: setRowHeight(currentState.rows, rowId, nextHeight),
      }));
    }

    function finishResize() {
      setRowResizeState(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        finishResize();
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
    window.addEventListener("blur", finishResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      window.removeEventListener("blur", finishResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [rowResizeState]);

  useEffect(() => {
    if (!columnResizeState) {
      return;
    }

    const {
      columnIndex,
      leftWidth: startLeftWidth,
      rightWidth: startRightWidth,
      rowId,
      rowWidth,
      startX,
    } = columnResizeState;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(event: PointerEvent) {
      const deltaPercent = ((event.clientX - startX) / rowWidth) * 100;
      const pairTotal = startLeftWidth + startRightWidth;
      const pairMin = Math.min(MIN_COLUMN_WIDTH, pairTotal / 2);
      const leftWidth = Math.min(
        Math.max(startLeftWidth + deltaPercent, pairMin),
        pairTotal - pairMin,
      );
      const rightWidth = pairTotal - leftWidth;

      setWidgetState((currentState) => ({
        ...currentState,
        rows: setColumnPairWidths(
          currentState.rows,
          rowId,
          columnIndex,
          leftWidth,
          rightWidth,
        ),
      }));
    }

    function finishResize() {
      setColumnResizeState(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        finishResize();
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
    window.addEventListener("blur", finishResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      window.removeEventListener("blur", finishResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [columnResizeState]);

  function handleRowResizeStart(
    row: DashboardWidgetRow,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setRowResizeState({
      rowId: row.id,
      startY: event.clientY,
      startHeight: row.height,
    });
  }

  function handleColumnResizeStart(
    row: DashboardWidgetRow,
    columnIndex: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const leftColumn = row.columns[columnIndex];
    const rightColumn = row.columns[columnIndex + 1];
    const rowElement = event.currentTarget.closest("[data-dashboard-row]");
    const rowWidth = rowElement?.getBoundingClientRect().width ?? 0;

    event.preventDefault();
    event.stopPropagation();

    if (!leftColumn || !rightColumn || rowWidth <= 0) {
      return;
    }

    setColumnResizeState({
      rowId: row.id,
      columnIndex,
      startX: event.clientX,
      rowWidth,
      leftWidth: leftColumn.width,
      rightWidth: rightColumn.width,
    });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <AlertsSnackbarStack />
      {isDesktopWorkspace ? (
        <div className="min-h-0 flex-1">
          <DesktopWorkspace
            onColumnResizeStart={handleColumnResizeStart}
            onRowResizeStart={handleRowResizeStart}
            rows={rows}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {visibleWidgets.map((widget) => (
            <MobileWidget key={widget.id} widget={widget} />
          ))}
        </div>
      )}
    </div>
  );
}
