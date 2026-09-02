# Row Widget Dashboard

This dashboard uses a snapped row-and-column layout instead of a free-floating window model. It is designed for operational widgets that should stay tidy, resize predictably, and keep the normal page scroll when the workspace grows taller than the viewport.

## Main Files

- `DashboardWidgets.tsx`: renders the toolbar, desktop row workspace, mobile stacked layout, resize handles, and localStorage persistence.
- `dashboardLayout.ts`: owns the layout state model, default layout, sanitizers, and pure layout mutations.
- `types.ts`: declares the supported widget ids and widget definition shape.
- `widgetRegistry.tsx`: maps widget ids to titles, descriptions, and render functions.
- `PlaceholderWidget.tsx`: shared empty-state content for future widgets.

## Layout Model

The persisted state is `DashboardWidgetState`:

```ts
{
  rows: [
    {
      id: "row-main",
      height: 480,
      columns: [
        { widgetIds: ["robot-map"], width: 61.5 },
        { widgetIds: ["robot-list", "pos-orders"], width: 38.5, heights: [35, 65] },
      ],
    },
  ],
  visibleWidgetIds: ["robot-map", "robot-list", "pos-orders"],
}
```

Rows own their own pixel `height`. Columns inside one row share that row height and use relative `width` values that are normalized back to 100. A column holds an ordered `widgetIds` list: a single id renders as one widget filling the column, while 2+ ids render as a vertical stack. Stack panes are sized by the column's optional `heights` array — percentages summing to 100, index-aligned with `widgetIds`, adjustable by dragging the handle between panes. A column saved before stack heights existed simply omits the field and falls back to an even split. There is no fixed total canvas height; the workspace height is the sum of all row heights plus gaps, so the page can scroll naturally.

The important invariants are:

- every visible widget appears exactly once across all `widgetIds` in `rows`
- hidden widgets do not appear in `rows`
- unknown widget ids are rejected
- duplicate widget ids are dropped
- columns with an empty `widgetIds` list are removed
- empty rows are removed
- row ids are unique after sanitizing
- row heights never go below `MIN_ROW_HEIGHT`
- column widths are finite positive values normalized to 100 per row
- stack `heights` either match `widgetIds.length` or are discarded for an even split

`sanitizeWidgetState` is the guardrail for these invariants. Any new layout mutation should return data that can pass through that sanitizer.

## Adding A Widget

1. Add the id to `WIDGET_IDS` in `types.ts`.
2. Add the widget definition to `DASHBOARD_WIDGETS` in `widgetRegistry.tsx`.
3. If the widget should be visible by default, add it to `DEFAULT_ROWS` in `dashboardLayout.ts`.
4. Keep the widget render function frame-safe:
    - fill the available width and height from the widget frame
    - put long content inside an internal scroll region
    - avoid fixed viewport-sized containers inside the widget
    - avoid global DOM ids that could collide if the widget is remounted
    - clean up timers, sockets, observers, map instances, and direct DOM libraries on unmount
5. Run `npx tsc -p tsconfig.app.json --noEmit`. It should report zero errors; `npm run build` does not typecheck and `npm run lint` does not run.
6. Manually test resize, reset, refresh persistence, and mobile stacked mode.

## Persistence

The current localStorage key is:

```txt
dishpatch.control.dashboard.widgets.v5
```

Bump the version suffix in `DASHBOARD_WIDGET_STORAGE_KEY` whenever a change to the shape would make older saved layouts wrong rather than merely incomplete. The reader ignores incompatible data and resets to the default layout if parsing or validation fails, so old keys are abandoned rather than migrated.

Storage writes are guarded. If the browser blocks storage or quota is exceeded, the current in-memory layout should keep working for the session.

## Desktop Interactions

Desktop and tablet layouts are enabled at `lg` and above, currently `min-width: 1024px`.

Widgets render at a fixed position in the layout; there is no drag-to-reorder. Showing a hidden widget appends it as a new row at the bottom.

Row resize handles change only that row's pixel height. Rows below keep their own heights, and the total workspace grows or shrinks. Column resize handles only adjust the adjacent column pair in the same row, and stack handles only the adjacent pane pair within one column. Resize cleanup listens for pointer up, pointer cancel, window blur, Escape, viewport mode changes, and unmount.

## Cross-Widget Selection

The map, the robot list and the POS order table are three views of the same fleet, so they share one selection, held by `DashboardSelectionProvider` (`src/context/DashboardSelectionContext.tsx`, mounted in `AppLayout`). Clicking a robot row, a map marker, or an order row selects that entity; clicking it again, clicking bare floorplan, or pressing Escape clears it.

Selection is stored as *what was clicked* — a robot id or an order id — and never as a pair. The partner is derived on every render by `useDashboardHighlight()` from live telemetry, because `robot.orderId` is only set while a robot is `Serving`; the dispatcher passes null on every Returning and Waiting transition. A stored pair would outlive the delivery it describes, whereas deriving means the order highlight falls away by itself the moment the meal is handed over. An order nobody is carrying — not yet dispatched, or already finished — resolves to no robot and simply highlights itself.

Selection is intentionally **not** persisted; it is not part of the saved layout.

Two things to preserve when touching this:

- The provider must not consume `RobotContext`. That context hands out a fresh object on every websocket frame, and subscribing there would re-render the dashboard at the push rate to maintain a value that only changes on a click.
- Each table keeps a single ref pointed at whichever row is currently lit and scrolls it into view with `block: "nearest"`. Do not put an effect on every row — the POS table is unvirtualised and routinely holds four figures of orders.

Status filters are left alone by selection. If the partner order is filtered out of the POS table, nothing highlights there.

## Mobile Behavior

Below `lg`, the same visible widgets render as stacked cards. Resize controls are not mounted. This avoids hidden desktop widgets keeping imperative resources alive while mobile widgets are active.

## Map Widget Caveats

`RestaurantMap` uses Leaflet directly because React-Leaflet map containers do not tolerate being remounted or relocated by the widget system. The widget must create the Leaflet map only after the DOM container and image bounds are ready, and it must remove the map, clear marker layers, cancel animation frames, and disconnect resize observers on unmount.

The map listens to container resize with `ResizeObserver`, then invalidates size and fits the floorplan bounds on the next animation frame. If future map behavior needs user-controlled pan/zoom persistence, do not blindly call `fitBounds` on every resize; store that as explicit map state.

Marker popups belong to the selection, not to the cursor — there is no hover-to-open. Because a selected robot's popup stays open while telemetry streams in at roughly 10 Hz, popup content is rebuilt only when `getPopupContentKey` changes, never on pose. Markers are created once and afterwards only mutated, so their click handlers read the selection callbacks through refs rather than closing over a particular render's copy. The selection halo in `getRobotIcon` is static for the same reason the popup is gated: the icon element is rebuilt on every tick to move the heading arrow, so a CSS animation there would restart continuously.
