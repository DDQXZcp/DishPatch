import { useEffect, useMemo, useState } from "react";
import {
  Mosaic,
  MosaicWindow,
  type MosaicNode,
  type MosaicPath,
} from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";

import { CloseIcon } from "../../icons";
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
const STORAGE_KEY = "dishpatch.control.dashboard.widgets.v1";

interface DashboardWidgetState {
  layout: MosaicNode<WidgetId> | null;
  visibleWidgetIds: WidgetId[];
}

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
    <div className="flex min-w-0 flex-1 items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <ToolbarTitle widget={widget} />
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

function removeWidgetFromLayout(
  node: MosaicNode<WidgetId> | null,
  widgetId: WidgetId,
): MosaicNode<WidgetId> | null {
  if (!node) {
    return null;
  }

  if (isLeaf(node)) {
    return node === widgetId ? null : node;
  }

  const first = removeWidgetFromLayout(node.first, widgetId);
  const second = removeWidgetFromLayout(node.second, widgetId);

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

function isValidLayoutNode(value: unknown): value is MosaicNode<WidgetId> {
  if (typeof value === "string") {
    return isWidgetId(value);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const node = value as {
    direction?: unknown;
    first?: unknown;
    second?: unknown;
    splitPercentage?: unknown;
  };

  const hasValidDirection =
    node.direction === "row" || node.direction === "column";
  const hasValidSplit =
    node.splitPercentage === undefined ||
    typeof node.splitPercentage === "number";

  return (
    hasValidDirection &&
    hasValidSplit &&
    isValidLayoutNode(node.first) &&
    isValidLayoutNode(node.second)
  );
}

function collectLayoutWidgetIds(
  node: MosaicNode<WidgetId> | null,
  ids = new Set<WidgetId>(),
) {
  if (!node) {
    return ids;
  }

  if (isLeaf(node)) {
    ids.add(node);
    return ids;
  }

  collectLayoutWidgetIds(node.first, ids);
  collectLayoutWidgetIds(node.second, ids);
  return ids;
}

function dedupeLayout(
  node: MosaicNode<WidgetId> | null,
  seenIds = new Set<WidgetId>(),
): MosaicNode<WidgetId> | null {
  if (!node) {
    return null;
  }

  if (isLeaf(node)) {
    if (seenIds.has(node)) {
      return null;
    }

    seenIds.add(node);
    return node;
  }

  const first = dedupeLayout(node.first, seenIds);
  const second = dedupeLayout(node.second, seenIds);

  if (first && second) {
    return { ...node, first, second };
  }

  return first ?? second;
}

function uniqueWidgetIds(widgetIds: WidgetId[]) {
  return widgetIds.filter(
    (widgetId, index) => widgetIds.indexOf(widgetId) === index,
  );
}

function sanitizeLayout(
  layout: MosaicNode<WidgetId> | null,
  visibleWidgetIds: WidgetId[],
) {
  const visibleIdSet = new Set(visibleWidgetIds);
  return pruneLayout(dedupeLayout(layout), visibleIdSet);
}

function ensureVisibleLayout(
  layout: MosaicNode<WidgetId> | null,
  visibleWidgetIds: WidgetId[],
) {
  let nextLayout = sanitizeLayout(layout, visibleWidgetIds);
  const layoutIds = collectLayoutWidgetIds(nextLayout);

  for (const widgetId of visibleWidgetIds) {
    if (!layoutIds.has(widgetId)) {
      nextLayout = appendWidget(nextLayout, widgetId);
      layoutIds.add(widgetId);
    }
  }

  return nextLayout;
}

function defaultWidgetState(): DashboardWidgetState {
  return {
    layout: DEFAULT_LAYOUT,
    visibleWidgetIds: [...DEFAULT_VISIBLE_WIDGETS],
  };
}

function readStoredWidgetState(): DashboardWidgetState {
  if (typeof window === "undefined") {
    return defaultWidgetState();
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return defaultWidgetState();
  }

  try {
    const parsed = JSON.parse(storedValue) as {
      layout?: unknown;
      visibleWidgetIds?: unknown;
    };

    if (
      !Array.isArray(parsed.visibleWidgetIds) ||
      !parsed.visibleWidgetIds.every((id): id is WidgetId => isWidgetId(id))
    ) {
      return defaultWidgetState();
    }

    if (parsed.layout !== null && !isValidLayoutNode(parsed.layout)) {
      return defaultWidgetState();
    }

    const visibleWidgetIds = uniqueWidgetIds(parsed.visibleWidgetIds);
    return {
      visibleWidgetIds,
      layout: ensureVisibleLayout(parsed.layout ?? null, visibleWidgetIds),
    };
  } catch {
    return defaultWidgetState();
  }
}

export default function DashboardWidgets() {
  const [initialWidgetState] = useState(readStoredWidgetState);
  const [widgetState, setWidgetState] =
    useState<DashboardWidgetState>(initialWidgetState);

  const { layout, visibleWidgetIds } = widgetState;

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
    () => sanitizeLayout(layout, visibleWidgets.map((widget) => widget.id)),
    [layout, visibleWidgets],
  );

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ layout: visibleLayout, visibleWidgetIds }),
    );
  }, [visibleLayout, visibleWidgetIds]);

  function hideWidget(widgetId: WidgetId) {
    setWidgetState((currentState) => {
      const visibleWidgetIds = currentState.visibleWidgetIds.filter(
        (id) => id !== widgetId,
      );

      return {
        visibleWidgetIds,
        layout: sanitizeLayout(currentState.layout, visibleWidgetIds),
      };
    });
  }

  function toggleWidget(widgetId: WidgetId) {
    setWidgetState((currentState) => {
      if (currentState.visibleWidgetIds.includes(widgetId)) {
        const visibleWidgetIds = currentState.visibleWidgetIds.filter(
          (id) => id !== widgetId,
        );

        return {
          visibleWidgetIds,
          layout: sanitizeLayout(currentState.layout, visibleWidgetIds),
        };
      }

      const visibleWidgetIds = [...currentState.visibleWidgetIds, widgetId];
      const currentVisibleLayout = ensureVisibleLayout(
        currentState.layout,
        currentState.visibleWidgetIds,
      );

      return {
        visibleWidgetIds,
        layout: appendWidget(
          removeWidgetFromLayout(currentVisibleLayout, widgetId),
          widgetId,
        ),
      };
    });
  }

  function resetLayout() {
    setWidgetState(defaultWidgetState());
  }

  function handleLayoutChange(nextLayout: MosaicNode<WidgetId> | null) {
    setWidgetState((currentState) => ({
      ...currentState,
      layout: sanitizeLayout(nextLayout, currentState.visibleWidgetIds),
    }));
  }

  function handleLayoutRelease(nextLayout: MosaicNode<WidgetId> | null) {
    setWidgetState((currentState) => ({
      ...currentState,
      layout: ensureVisibleLayout(nextLayout, currentState.visibleWidgetIds),
    }));
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

      <div className="hidden h-[1120px] min-h-[calc(100vh-220px)] lg:block">
        {visibleLayout ? (
          <Mosaic<WidgetId>
            className="dishpatch-widget-mosaic"
            value={visibleLayout}
            onChange={handleLayoutChange}
            onRelease={handleLayoutRelease}
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
