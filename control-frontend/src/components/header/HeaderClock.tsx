import { useEffect, useState } from "react";

import { HEADER_TEXT_SIZE } from "./headerTypography";

/**
 * Wall clock for the header.
 *
 * Deliberately its own component: the ticking state lives here so the once-a-
 * second re-render does not reach AppHeader and drag the logo menu and user
 * dropdown along with it.
 */
export default function HeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <span
      className={`${HEADER_TEXT_SIZE} font-medium tabular-nums text-slate-600`}
    >
      {now.toLocaleTimeString(undefined, {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  );
}
