import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import { CloseIcon } from "../../icons";
import {
  DASHBOARD_WIDGET_STORAGE_KEY,
  defaultWidgetState,
  hideWidgetInState,
  isWidgetId,
  moveWidgetNearTarget,
  moveWidgetToBottom,
  readStoredWidgetState,
  showWidgetInState,
  type DropPosition,
  type DashboardWidgetRow,
  type DashboardWidgetState,
} from "./dashboardLayout";
import { DASHBOARD_WIDGETS, WIDGET_BY_ID } from "./widgetRegistry";
import type { DashboardWidgetDefinition, WidgetId } from "./types";

type ActiveDropTarget =
  | {
      type: "widget";
      targetWidgetId: WidgetId;
      position: DropPosition;
    }
  | { type: "bottom" };

interface DragHandleProps {
  draggable: true;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
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
      onDragStart={(event) => event.preventDefault()}
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
  dragHandleProps,
}: {
  widget: DashboardWidgetDefinition;
  onHide: () => void;
  dragHandleProps?: DragHandleProps;
}) {
  return (
    <div
      {...dragHandleProps}
      className={`flex min-h-[74px] items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5 ${
        dragHandleProps
          ? "select-none cursor-grab active:cursor-grabbing"
          : ""
      }`}
    >
      <ToolbarTitle widget={widget} />
      <HideButton onClick={onHide} />
    </div>
  );
}

function WidgetFrame({
  widget,
  onHide,
  children,
  dragHandleProps,
  isDragging = false,
}: {
  widget: DashboardWidgetDefinition;
  onHide: () => void;
  children?: ReactNode;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs transition dark:border-gray-800 dark:bg-white/[0.03] ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <WidgetHeader
        widget={widget}
        onHide={onHide}
        dragHandleProps={dragHandleProps}
      />
      <WidgetBody widget={widget} />
      {children}
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

function isSameDropTarget(
  activeDropTarget: ActiveDropTarget | null,
  nextDropTarget: ActiveDropTarget,
) {
  if (!activeDropTarget || activeDropTarget.type !== nextDropTarget.type) {
    return false;
  }

  if (activeDropTarget.type === "bottom" && nextDropTarget.type === "bottom") {
    return true;
  }

  if (activeDropTarget.type === "widget" && nextDropTarget.type === "widget") {
    return (
      activeDropTarget.targetWidgetId === nextDropTarget.targetWidgetId &&
      activeDropTarget.position === nextDropTarget.position
    );
  }

  return false;
}

function getDropZoneClassName(position: DropPosition, isActive: boolean) {
  const activeClassName = isActive
    ? "bg-brand-500/10"
    : "bg-transparent hover:bg-brand-500/5";

  const positionClassNames: Record<DropPosition, string> = {
    top: `inset-x-0 top-0 h-1/3 ${
      isActive ? "border-t-4 border-brand-500" : ""
    }`,
    right: `right-0 top-1/3 bottom-1/3 w-1/2 ${
      isActive ? "border-r-4 border-brand-500" : ""
    }`,
    bottom: `inset-x-0 bottom-0 h-1/3 ${
      isActive ? "border-b-4 border-brand-500" : ""
    }`,
    left: `left-0 top-1/3 bottom-1/3 w-1/2 ${
      isActive ? "border-l-4 border-brand-500" : ""
    }`,
  };

  return `absolute z-20 ${positionClassNames[position]} ${activeClassName}`;
}

function WidgetDropZone({
  position,
  isActive,
  onActivate,
  onClear,
  onDrop,
}: {
  position: DropPosition;
  isActive: boolean;
  onActivate: () => void;
  onClear: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-hidden="true"
      className={getDropZoneClassName(position, isActive)}
      onDragLeave={onClear}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onActivate();
      }}
      onDrop={onDrop}
    />
  );
}

function BottomDropZone({
  isActive,
  onActivate,
  onClear,
  onDrop,
}: {
  isActive: boolean;
  onActivate: () => void;
  onClear: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`flex h-20 items-center justify-center rounded-2xl border border-dashed text-theme-sm transition ${
        isActive
          ? "border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-300"
          : "border-gray-300 bg-white text-gray-500 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400"
      }`}
      onDragLeave={onClear}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onActivate();
      }}
      onDrop={onDrop}
    >
      Drop here to snap widget to the bottom
    </div>
  );
}

function WidgetTile({
  widget,
  draggedWidgetId,
  activeDropTarget,
  onDragStart,
  onDragEnd,
  onDropOnWidget,
  onHide,
  onSetActiveDropTarget,
}: {
  widget: DashboardWidgetDefinition;
  draggedWidgetId: WidgetId | null;
  activeDropTarget: ActiveDropTarget | null;
  onDragStart: (widgetId: WidgetId, event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDropOnWidget: (
    targetWidgetId: WidgetId,
    position: DropPosition,
    event: DragEvent<HTMLDivElement>,
  ) => void;
  onHide: () => void;
  onSetActiveDropTarget: (dropTarget: ActiveDropTarget | null) => void;
}) {
  const isDragging = draggedWidgetId === widget.id;
  const canDropOnWidget = Boolean(draggedWidgetId && !isDragging);
  const dragHandleProps: DragHandleProps = {
    draggable: true,
    onDragStart: (event) => onDragStart(widget.id, event),
    onDragEnd,
  };

  return (
    <WidgetFrame
      widget={widget}
      onHide={onHide}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    >
      {canDropOnWidget &&
        (["top", "right", "bottom", "left"] as const).map((position) => {
          const dropTarget: ActiveDropTarget = {
            type: "widget",
            targetWidgetId: widget.id,
            position,
          };

          return (
            <WidgetDropZone
              key={position}
              position={position}
              isActive={isSameDropTarget(activeDropTarget, dropTarget)}
              onActivate={() => onSetActiveDropTarget(dropTarget)}
              onClear={() => {
                if (isSameDropTarget(activeDropTarget, dropTarget)) {
                  onSetActiveDropTarget(null);
                }
              }}
              onDrop={(event) => onDropOnWidget(widget.id, position, event)}
            />
          );
        })}
    </WidgetFrame>
  );
}

function DashboardRow({
  row,
  activeDropTarget,
  draggedWidgetId,
  onDragEnd,
  onDragStart,
  onDropOnWidget,
  onHideWidget,
  onSetActiveDropTarget,
}: {
  row: DashboardWidgetRow;
  activeDropTarget: ActiveDropTarget | null;
  draggedWidgetId: WidgetId | null;
  onDragEnd: () => void;
  onDragStart: (widgetId: WidgetId, event: DragEvent<HTMLDivElement>) => void;
  onDropOnWidget: (
    targetWidgetId: WidgetId,
    position: DropPosition,
    event: DragEvent<HTMLDivElement>,
  ) => void;
  onHideWidget: (widgetId: WidgetId) => void;
  onSetActiveDropTarget: (dropTarget: ActiveDropTarget | null) => void;
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
            <WidgetTile
              widget={widget}
              activeDropTarget={activeDropTarget}
              draggedWidgetId={draggedWidgetId}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onDropOnWidget={onDropOnWidget}
              onHide={() => onHideWidget(column.widgetId)}
              onSetActiveDropTarget={onSetActiveDropTarget}
            />
          </div>
        );
      })}
    </div>
  );
}

function DesktopWorkspace({
  activeDropTarget,
  draggedWidgetId,
  onDragEnd,
  onDragStart,
  onDropOnBottom,
  onDropOnWidget,
  rows,
  onHideWidget,
  onSetActiveDropTarget,
}: {
  activeDropTarget: ActiveDropTarget | null;
  draggedWidgetId: WidgetId | null;
  onDragEnd: () => void;
  onDragStart: (widgetId: WidgetId, event: DragEvent<HTMLDivElement>) => void;
  onDropOnBottom: (event: DragEvent<HTMLDivElement>) => void;
  onDropOnWidget: (
    targetWidgetId: WidgetId,
    position: DropPosition,
    event: DragEvent<HTMLDivElement>,
  ) => void;
  rows: DashboardWidgetRow[];
  onHideWidget: (widgetId: WidgetId) => void;
  onSetActiveDropTarget: (dropTarget: ActiveDropTarget | null) => void;
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
        <DashboardRow
          key={row.id}
          row={row}
          activeDropTarget={activeDropTarget}
          draggedWidgetId={draggedWidgetId}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onDropOnWidget={onDropOnWidget}
          onHideWidget={onHideWidget}
          onSetActiveDropTarget={onSetActiveDropTarget}
        />
      ))}
      {draggedWidgetId && (
        <BottomDropZone
          isActive={isSameDropTarget(activeDropTarget, { type: "bottom" })}
          onActivate={() => onSetActiveDropTarget({ type: "bottom" })}
          onClear={() => {
            if (isSameDropTarget(activeDropTarget, { type: "bottom" })) {
              onSetActiveDropTarget(null);
            }
          }}
          onDrop={onDropOnBottom}
        />
      )}
    </div>
  );
}

export default function DashboardWidgets() {
  const [initialWidgetState] = useState(readStoredWidgetState);
  const [widgetState, setWidgetState] =
    useState<DashboardWidgetState>(initialWidgetState);
  const [draggedWidgetId, setDraggedWidgetId] = useState<WidgetId | null>(null);
  const [activeDropTarget, setActiveDropTarget] =
    useState<ActiveDropTarget | null>(null);

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

  function getDraggedWidgetId(event: DragEvent<HTMLDivElement>) {
    const widgetId = event.dataTransfer.getData("text/plain");

    if (isWidgetId(widgetId)) {
      return widgetId;
    }

    return draggedWidgetId;
  }

  function handleDragStart(
    widgetId: WidgetId,
    event: DragEvent<HTMLDivElement>,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", widgetId);
    setDraggedWidgetId(widgetId);
  }

  function handleDragEnd() {
    setDraggedWidgetId(null);
    setActiveDropTarget(null);
  }

  function handleDropOnWidget(
    targetWidgetId: WidgetId,
    position: DropPosition,
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const widgetId = getDraggedWidgetId(event);
    if (!widgetId) {
      handleDragEnd();
      return;
    }

    setWidgetState((currentState) => ({
      ...currentState,
      rows: moveWidgetNearTarget(
        currentState.rows,
        widgetId,
        targetWidgetId,
        position,
      ),
    }));
    handleDragEnd();
  }

  function handleDropOnBottom(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const widgetId = getDraggedWidgetId(event);
    if (!widgetId) {
      handleDragEnd();
      return;
    }

    setWidgetState((currentState) => ({
      ...currentState,
      rows: moveWidgetToBottom(currentState.rows, widgetId),
    }));
    handleDragEnd();
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
        <DesktopWorkspace
          activeDropTarget={activeDropTarget}
          draggedWidgetId={draggedWidgetId}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          onDropOnBottom={handleDropOnBottom}
          onDropOnWidget={handleDropOnWidget}
          onHideWidget={hideWidget}
          onSetActiveDropTarget={setActiveDropTarget}
          rows={rows}
        />
      </div>
    </div>
  );
}
