import { useRobotContext } from "../../context/RobotWebSocketProvider";
import type { ConnectionState } from "../../hooks/useWebSocketRobots";
import { HEADER_DOT_SIZE, HEADER_TEXT_SIZE } from "./headerTypography";

const STATE_CONFIG: Record<
  ConnectionState,
  { label: string; dotClassName: string; textClassName: string }
> = {
  connecting: {
    label: "Connecting…",
    dotClassName: "bg-gray-400",
    textClassName: "text-slate-500",
  },
  connected: {
    label: "Connected",
    dotClassName: "bg-green-500",
    textClassName: "text-slate-600",
  },
  disconnected: {
    label: "Not connected",
    dotClassName: "bg-red-500",
    textClassName: "text-red-600",
  },
};

/**
 * Backend connection state for the header.
 *
 * Kept as its own component because it consumes RobotContext, which hands out a
 * fresh value on every websocket frame. Everything reading that context
 * re-renders at roughly the push rate; confining that to a dot and a label is
 * cheap, but letting it reach AppHeader would put both dropdowns in the same
 * loop for no reason.
 *
 * The wording matches what the widgets show, so the header explains the state
 * once and the widgets agree with it rather than each telling their own story.
 */
export default function ConnectionStatus() {
  const { connectionState, error } = useRobotContext();
  const { label, dotClassName, textClassName } = STATE_CONFIG[connectionState];

  return (
    <div
      className="flex items-center gap-2"
      // The underlying STOMP message stays reachable without putting it in the
      // chrome.
      title={error ?? label}
      role="status"
      aria-live="polite"
    >
      <span
        className={`${HEADER_DOT_SIZE} shrink-0 rounded-full ${dotClassName}`}
      />
      <span
        className={`whitespace-nowrap ${HEADER_TEXT_SIZE} font-medium ${textClassName}`}
      >
        {label}
      </span>
    </div>
  );
}
