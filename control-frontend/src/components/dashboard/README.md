# Row Widget Dashboard

This dashboard uses a snapped row-and-column layout instead of a free-floating window model. It is designed for operational widgets that should stay tidy, resize predictably, and keep the normal page scroll when the workspace grows taller than the viewport.

## Main Files

- `DashboardWidgets.tsx`: renders the toolbar, desktop row workspace, mobile stacked layout, drag/drop targets, resize handles, and localStorage persistence.
- `dashboardLayout.ts`: owns the v2 layout state model, default layout, sanitizers, and pure layout mutations.
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
      height: 620,
      columns: [
        { widgetId: "robot-map", width: 66 },
        { widgetId: "robot-list", width: 34 },
      ],
    },
  ],
  visibleWidgetIds: ["robot-map", "robot-list"],
}
```

Rows own their own pixel `height`. Columns inside one row share that row height and use relative `width` values that are normalized back to 100. There is no fixed total canvas height; the workspace height is the sum of all row heights plus gaps, so the page can scroll naturally.

The important invariants are:

- every visible widget appears exactly once in `rows`
- hidden widgets do not appear in `rows`
- unknown widget ids are rejected
- duplicate widget ids are dropped
- empty rows are removed
- row ids are unique after sanitizing
- row heights never go below `MIN_ROW_HEIGHT`
- column widths are finite positive values normalized to 100 per row

`sanitizeWidgetState` is the guardrail for these invariants. Any new layout mutation should return data that can pass through that sanitizer.

## Persistence

The v2 localStorage key is:

```txt
dishpatch.control.dashboard.widgets.v2
```

The reader ignores incompatible data and resets to the default layout if parsing or validation fails. This intentionally does not migrate the old Mosaic v1 key because the split-tree model does not map cleanly to free-height rows.

Storage writes are guarded. If the browser blocks storage or quota is exceeded, the current in-memory layout should keep working for the session.

## Desktop Interactions

Desktop and tablet layouts are enabled at `lg` and above, currently `min-width: 1024px`.

Drag starts from the widget header. The widget body is left alone so maps, tables, dropdowns, and scroll areas remain usable.

Drop zones are snapped:

- left/right drop zones insert the dragged widget into the target row
- top/bottom drop zones create a new row above or below the target row
- the bottom workspace drop zone creates a new final row

Removing the last widget in a row removes that row. Showing a hidden widget appends it as a new row at the bottom.

Row resize handles change only that row's pixel height. Rows below keep their own heights, and the total workspace grows or shrinks. Column resize handles only adjust the adjacent column pair in the same row. Resize cleanup listens for pointer up, pointer cancel, window blur, Escape, viewport mode changes, and unmount.

## Mobile Behavior

Below `lg`, the same visible widgets render as stacked cards. Drag/drop and resize controls are not mounted. This avoids hidden desktop widgets keeping imperative resources alive while mobile widgets are active.

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
5. Run `npx tsc --noEmit` and `npm run build` from `control-frontend`.
6. Manually test hide/show, drag/drop, resize, reset, refresh persistence, and mobile stacked mode.

## Map Widget Caveats

`RestaurantMap` uses Leaflet directly because React-Leaflet map containers do not tolerate being remounted or relocated by the widget system. The widget must create the Leaflet map only after the DOM container and image bounds are ready, and it must remove the map, clear marker layers, cancel animation frames, and disconnect resize observers on unmount.

The map listens to container resize with `ResizeObserver`, then invalidates size and fits the floorplan bounds on the next animation frame. If future map behavior needs user-controlled pan/zoom persistence, do not blindly call `fitBounds` on every resize; store that as explicit map state.

## Manual QA Checklist

- Reset layout from the toolbar.
- Hide and show every widget from the toolbar.
- Drag each widget left and right into an existing row.
- Drag each widget above and below another widget to create rows.
- Drag a widget to the bottom workspace drop zone.
- Resize a row taller and confirm rows below keep their heights.
- Resize adjacent columns and confirm widths stay stable after refresh.
- Repeatedly relocate the map widget and confirm the console stays clean.
- Check that robot list dropdowns and filters still work inside widgets.
- Refresh and confirm the saved layout is restored.
- Put invalid data in the v2 localStorage key and confirm the default layout returns.
- Test below `lg` and confirm widgets stack with no drag or resize controls.
