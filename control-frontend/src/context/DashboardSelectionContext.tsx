import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useRobotContext } from "./RobotWebSocketProvider";

export type DashboardSelection =
  | { type: "robot"; robotId: number }
  | { type: "order"; orderId: string }
  | null;

interface DashboardSelectionContextValue {
  selection: DashboardSelection;
  /** Selecting the already-selected robot clears the selection. */
  selectRobot: (robotId: number) => void;
  /** Selecting the already-selected order clears the selection. */
  selectOrder: (orderId: string) => void;
  clearSelection: () => void;
}

const DashboardSelectionContext =
  createContext<DashboardSelectionContextValue | null>(null);

/**
 * Holds the one entity the operator has clicked, so the map, the robot list and
 * the POS table can all light up the same delivery.
 *
 * This provider deliberately does not consume {@link useRobotContext}: that
 * context hands out a fresh object on every websocket frame, and subscribing
 * here would re-render the whole dashboard at the push rate just to keep a
 * value that only changes on a click. The robot/order pairing is resolved
 * separately by {@link useDashboardHighlight}.
 */
export function DashboardSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<DashboardSelection>(null);

  const selectRobot = useCallback((robotId: number) => {
    setSelection((current) =>
      current?.type === "robot" && current.robotId === robotId
        ? null
        : { type: "robot", robotId },
    );
  }, []);

  const selectOrder = useCallback((orderId: string) => {
    setSelection((current) =>
      current?.type === "order" && current.orderId === orderId
        ? null
        : { type: "order", orderId },
    );
  }, []);

  const clearSelection = useCallback(() => setSelection(null), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelection(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const value = useMemo(
    () => ({ selection, selectRobot, selectOrder, clearSelection }),
    [selection, selectRobot, selectOrder, clearSelection],
  );

  return (
    <DashboardSelectionContext.Provider value={value}>
      {children}
    </DashboardSelectionContext.Provider>
  );
}

export function useDashboardSelection() {
  const context = useContext(DashboardSelectionContext);

  if (!context) {
    throw new Error(
      "useDashboardSelection must be used within a DashboardSelectionProvider",
    );
  }

  return context;
}

interface DashboardHighlight {
  highlightedRobotId: number | null;
  highlightedOrderId: string | null;
}

/**
 * Resolves the selection into the pair of entities that should light up.
 *
 * The partner is derived from live telemetry on every call rather than captured
 * at click time. `robot.orderId` is only ever set while a robot is Serving — the
 * dispatcher passes null on every Returning and Waiting transition — so a stored
 * pair would outlive the delivery it describes. Deriving means the order
 * highlight drops away on its own the moment the robot hands the meal over.
 *
 * An order nobody is carrying (not yet dispatched, or already finished) simply
 * resolves to no robot, which is exactly the "highlight itself only" case.
 */
export function useDashboardHighlight(): DashboardHighlight {
  const { selection } = useDashboardSelection();
  const { robots } = useRobotContext();

  return useMemo(() => {
    if (!selection) {
      return { highlightedRobotId: null, highlightedOrderId: null };
    }

    if (selection.type === "robot") {
      // Looked up rather than passed straight through, so a robot that has
      // dropped out of the fleet highlights nothing. The selection itself is
      // left alone on purpose: a robot that goes quiet for a tick and comes
      // back should light up again rather than silently lose the selection.
      const robot = robots.find((candidate) => candidate.id === selection.robotId);

      return {
        highlightedRobotId: robot?.id ?? null,
        highlightedOrderId: robot?.orderId ?? null,
      };
    }

    const robot = robots.find(
      (candidate) => candidate.orderId === selection.orderId,
    );

    return {
      highlightedRobotId: robot?.id ?? null,
      highlightedOrderId: selection.orderId,
    };
  }, [selection, robots]);
}
