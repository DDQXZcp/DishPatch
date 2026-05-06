import { useMemo, useState } from "react";
import {
  Mosaic,
  MosaicWindow,
  type MosaicNode,
  type MosaicPath,
} from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";

import { CloseIcon, GridIcon } from "../../icons";
import { DASHBOARD_WIDGETS, WIDGET_BY_ID } from "./widgetRegistry";
import type { DashboardWidgetDefinition, WidgetId } from "./types";

const DEFAULT_LAYOUT: MosaicNode<WidgetId> = {
  direction: "column",
  splitPercentage: 70,
  first: {
    direction: "row",
    splitPercentage: 66,
    first: "robot-map",
    second: "robot-list",
  },
  second: {
    direction: "row",
    splitPercentage: 50,
    first: "pos-orders",
    second: "table-status",
  },
};

const DEFAULT_VISIBLE_WIDGETS = DASHBOARD_WIDGETS.map((widget) => widget.id);

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

function renderToolbar(
  widget: DashboardWidgetDefinition,
  onHide: () => void,
) {
  return () => (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden text-gray-400 dark:text-gray-500 sm:block">
          <GridIcon className="size-4" />
        </span>
        <ToolbarTitle widget={widget} />
      </div>
      <HideButton onClick={onHide} />
    </div>
  );
}

function WidgetBody({ widget }: { widget: DashboardWidgetDefinition }) {
  return (
    <div className="h-full overflow-auto p-4 sm:p-5">{widget.render()}</div>
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
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5">
        <ToolbarTitle widget={widget} />
        <HideButton onClick={onHide} />
      </div>
      <WidgetBody widget={widget} />
    </div>
  );
}

function isWidgetId(id: string): id is WidgetId {
  return WIDGET_BY_ID.has(id as WidgetId);
}

function isLeaf(node: MosaicNode<WidgetId>): node is WidgetId {
  return typeof node === "string";
}

function pruneLayout(
  node: MosaicNode<WidgetId> | null,
  visibleIds: Set<WidgetId>,
): MosaicNode<WidgetId> | null {
  if (!node) {
    return null;
  }

  if (isLeaf(node)) {
    return visibleIds.has(node) ? node : null;
  }

  const first = pruneLayout(node.first, visibleIds);
  const second = pruneLayout(node.second, visibleIds);

  if (first && second) {
    return { ...node, first, second };
  }

  return first ?? second;
}

function appendWidget(
  layout: MosaicNode<WidgetId> | null,
  widgetId: WidgetId,
): MosaicNode<WidgetId> {
  if (!layout) {
    return widgetId;
  }

  return {
    direction: "row",
    splitPercentage: 72,
    first: layout,
    second: widgetId,
  };
}

export default function DashboardWidgets() {
  const [layout, setLayout] = useState<MosaicNode<WidgetId> | null>(
    DEFAULT_LAYOUT,
  );
  const [visibleWidgetIds, setVisibleWidgetIds] = useState<WidgetId[]>(
    DEFAULT_VISIBLE_WIDGETS,
  );

  const visibleWidgets = useMemo(
    () =>
      visibleWidgetIds
        .filter(isWidgetId)
        .map((widgetId) => WIDGET_BY_ID.get(widgetId))
        .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget)),
    [visibleWidgetIds],
  );

  const visibleIdSet = useMemo(
    () => new Set<WidgetId>(visibleWidgets.map((widget) => widget.id)),
    [visibleWidgets],
  );

  const visibleLayout = useMemo(
    () => pruneLayout(layout, visibleIdSet),
    [layout, visibleIdSet],
  );

  function hideWidget(widgetId: WidgetId) {
    setVisibleWidgetIds((currentIds) => {
      const nextIds = currentIds.filter((id) => id !== widgetId);
      const nextIdSet = new Set(nextIds);
      setLayout((currentLayout) => pruneLayout(currentLayout, nextIdSet));
      return nextIds;
    });
  }

  function toggleWidget(widgetId: WidgetId) {
    setVisibleWidgetIds((currentIds) => {
      if (currentIds.includes(widgetId)) {
        const nextIds = currentIds.filter((id) => id !== widgetId);
        const nextIdSet = new Set(nextIds);
        setLayout((currentLayout) => pruneLayout(currentLayout, nextIdSet));
        return nextIds;
      }

      setLayout((currentLayout) => appendWidget(currentLayout, widgetId));
      return [...currentIds, widgetId];
    });
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    setVisibleWidgetIds(DEFAULT_VISIBLE_WIDGETS);
  }

  function renderTile(widgetId: WidgetId, path: MosaicPath) {
    const widget = WIDGET_BY_ID.get(widgetId);
    if (!widget) {
      return null;
    }

    return (
      <MosaicWindow<WidgetId>
        path={path}
        title={widget.title}
        toolbarControls={<HideButton onClick={() => hideWidget(widget.id)} />}
        renderToolbar={renderToolbar(widget, () => hideWidget(widget.id))}
      >
        <WidgetBody widget={widget} />
      </MosaicWindow>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03] lg:flex-row lg:items-center lg:justify-between">
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

      <div className="hidden h-[calc(100vh-220px)] min-h-[760px] lg:block">
        {visibleLayout ? (
          <Mosaic<WidgetId>
            className="dishpatch-widget-mosaic"
            value={visibleLayout}
            onChange={setLayout}
            renderTile={renderTile}
            resize={{ minimumPaneSizePercentage: 18 }}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-theme-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400">
            Select at least one widget to build the dashboard.
          </div>
        )}
      </div>
    </div>
  );
}
