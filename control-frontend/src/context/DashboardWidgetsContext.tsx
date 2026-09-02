import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  DASHBOARD_RESET_VIEW_EVENT,
  DASHBOARD_WIDGET_STORAGE_KEY,
  defaultWidgetState,
  readStoredWidgetState,
  showWidgetInState,
  type DashboardWidgetState,
} from "../components/dashboard/dashboardLayout";
import { WIDGET_BY_ID } from "../components/dashboard/widgetRegistry";
import type { DashboardWidgetDefinition, WidgetId } from "../components/dashboard/types";

interface DashboardWidgetsContextValue {
  widgetState: DashboardWidgetState;
  setWidgetState: Dispatch<SetStateAction<DashboardWidgetState>>;
  visibleWidgets: DashboardWidgetDefinition[];
  visibleIdSet: Set<WidgetId>;
  toggleWidget: (widgetId: WidgetId) => void;
  resetLayout: () => void;
}

const DashboardWidgetsContext =
  createContext<DashboardWidgetsContextValue | null>(null);

export function DashboardWidgetsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [widgetState, setWidgetState] =
    useState<DashboardWidgetState>(readStoredWidgetState);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DASHBOARD_WIDGET_STORAGE_KEY,
        JSON.stringify(widgetState),
      );
    } catch (error) {
      console.warn("Unable to persist dashboard widget layout", error);
    }
  }, [widgetState]);

  const visibleWidgets = useMemo(
    () =>
      widgetState.visibleWidgetIds
        .map((widgetId) => WIDGET_BY_ID.get(widgetId))
        .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget)),
    [widgetState.visibleWidgetIds],
  );

  const visibleIdSet = useMemo(
    () => new Set<WidgetId>(visibleWidgets.map((widget) => widget.id)),
    [visibleWidgets],
  );

  function toggleWidget(widgetId: WidgetId) {
    setWidgetState((currentState) => showWidgetInState(currentState, widgetId));
  }

  function resetLayout() {
    setWidgetState(defaultWidgetState());
    window.dispatchEvent(new Event(DASHBOARD_RESET_VIEW_EVENT));
  }

  const value: DashboardWidgetsContextValue = {
    widgetState,
    setWidgetState,
    visibleWidgets,
    visibleIdSet,
    toggleWidget,
    resetLayout,
  };

  return (
    <DashboardWidgetsContext.Provider value={value}>
      {children}
    </DashboardWidgetsContext.Provider>
  );
}

export function useDashboardWidgets() {
  const context = useContext(DashboardWidgetsContext);

  if (!context) {
    throw new Error(
      "useDashboardWidgets must be used within a DashboardWidgetsProvider",
    );
  }

  return context;
}
