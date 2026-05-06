import { useEffect, useMemo, useState } from "react";

import { CloseIcon } from "../../icons";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  defaultWidgetState,
  hideWidgetInState,
  readStoredWidgetState,
  showWidgetInState,
  type DashboardWidgetRow,
  type DashboardWidgetState,
} from "./dashboardLayout";
import { DASHBOARD_WIDGETS, WIDGET_BY_ID } from "./widgetRegistry";
import type { DashboardWidgetDefinition, WidgetId } from "./types";

function ToolbarTitle({ widget }: { widget: DashboardWidgetDefinition }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90">
        {widget.title}
      </p>
      {widget.description && (
        <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
          {widget.description}
        </p>
      )}
    </div>
  );
}

function HideButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(event) => event.stopPropagation()}
      className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
      aria-label="Hide widget"
      title="Hide widget"
    >
      <CloseIcon className="size-4" />
    </button>
  );
}

function WidgetBody({ widget }: { widget: DashboardWidgetDefinition }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
      {widget.render()}
    </div>
  );
}

function WidgetHeader({
  widget,
  onHide,
}: {
  widget: DashboardWidgetDefinition;
  onHide: () => void;
}) {
  return (
    <div className="flex min-h-[74px] items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5">
      <ToolbarTitle widget={widget} />
      <HideButton onClick={onHide} />
    </div>
  );
}

function WidgetFrame({
  widget,
  onHide,
}: {
  widget: DashboardWidgetDefinition;
  onHide: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
      <WidgetHeader widget={widget} onHide={onHide} />
      <WidgetBody widget={widget} />
    </div>
  );
}

function MobileWidget({
  widget,
  onHide,
}: {
  widget: DashboardWidgetDefinition;
  onHide: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <WidgetHeader widget={widget} onHide={onHide} />
      <WidgetBody widget={widget} />
    </div>
  );
}

function DashboardRow({
  row,
  onHideWidget,
}: {
  row: DashboardWidgetRow;
  onHideWidget: (widgetId: WidgetId) => void;
}) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: row.columns
          .map((column) => `minmax(0, ${column.width}fr)`)
          .join(" "),
        height: row.height,
      }}
    >
      {row.columns.map((column) => {
        const widget = WIDGET_BY_ID.get(column.widgetId);

        if (!widget) {
          return null;
        }

        return (
          <div key={column.widgetId} className="min-h-0 min-w-0">
            <WidgetFrame
              widget={widget}
              onHide={() => onHideWidget(column.widgetId)}
            />
          </div>
        );
      })}
    </div>
  );
}

function DesktopWorkspace({
  rows,
  onHideWidget,
}: {
  rows: DashboardWidgetRow[];
  onHideWidget: (widgetId: WidgetId) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-theme-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400">
        Select at least one widget to build the dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <DashboardRow key={row.id} row={row} onHideWidget={onHideWidget} />
      ))}
    </div>
  );
}

export default function DashboardWidgets() {
  const [initialWidgetState] = useState(readStoredWidgetState);
  const [widgetState, setWidgetState] =
    useState<DashboardWidgetState>(initialWidgetState);

  const { rows, visibleWidgetIds } = widgetState;

  const visibleWidgets = useMemo(
    () =>
      visibleWidgetIds
        .map((widgetId) => WIDGET_BY_ID.get(widgetId))
        .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget)),
    [visibleWidgetIds],
  );

  const visibleIdSet = useMemo(
    () => new Set<WidgetId>(visibleWidgets.map((widget) => widget.id)),
    [visibleWidgets],
  );

  useEffect(() => {
    window.localStorage.setItem(
      DASHBOARD_WIDGET_STORAGE_KEY,
      JSON.stringify(widgetState),
    );
  }, [widgetState]);

  function hideWidget(widgetId: WidgetId) {
    setWidgetState((currentState) => hideWidgetInState(currentState, widgetId));
  }

  function toggleWidget(widgetId: WidgetId) {
    setWidgetState((currentState) => showWidgetInState(currentState, widgetId));
  }

  function resetLayout() {
    setWidgetState(defaultWidgetState());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-[88px] lg:z-9999 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
            Dashboard Widgets
          </h2>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Toggle visible widgets and arrange them in the desktop workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DASHBOARD_WIDGETS.map((widget) => {
            const isVisible = visibleIdSet.has(widget.id);
            return (
              <button
                key={widget.id}
                type="button"
                onClick={() => toggleWidget(widget.id)}
                className={`rounded-lg border px-3 py-2 text-theme-xs font-medium transition ${
                  isVisible
                    ? "border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-300"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                }`}
                aria-pressed={isVisible}
              >
                {widget.title}
              </button>
            );
          })}
          <button
            type="button"
            onClick={resetLayout}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-xs font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Reset layout
          </button>
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {visibleWidgets.map((widget) => (
          <MobileWidget
            key={widget.id}
            widget={widget}
            onHide={() => hideWidget(widget.id)}
          />
        ))}
      </div>

      <div className="hidden lg:block">
        <DesktopWorkspace rows={rows} onHideWidget={hideWidget} />
      </div>
    </div>
  );
}
