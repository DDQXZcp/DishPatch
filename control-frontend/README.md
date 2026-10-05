# Control Frontend

The operator dashboard at [control.dish-patch.com](https://control.dish-patch.com/): a live map of
the fleet over the restaurant's floor plan, a table of robots, and the order list, all fed by
the [control backend](../control-backend/README.md) over STOMP.

React 19, TypeScript, Vite 6, Tailwind CSS 4 and Leaflet.

## Running it locally

From the repository root, stage the map assets once:

```bash
./map-source/stage-map-assets.sh
```

This writes `public/maps/map-manifest.json` and `public/maps/map-floorplan.webp`, both
gitignored. **If you skip it the map fails silently** — the manifest fetch only logs a
`console.warn`, and the map widget renders an empty grey pane with no error on screen.

Then, from this folder:

```bash
yarn install
yarn dev
```

Vite serves on `http://localhost:5173`, which is one of the origins the backend allows.

### Configuration

| Variable | Default | Meaning |
|:--|:--|:--|
| `VITE_BACKEND_URL` | `http://localhost:8080` | The control backend. Used for every HTTP call and for the WebSocket at `${VITE_BACKEND_URL}/ws`. |

Vite reads it at build time, not at run time. CI builds the deployed site with
`https://controlapi.dish-patch.com`; locally, set it in a `.env.local` to point a dev server
at the live backend instead of a local one. The fallback is repeated in each file that makes a
request rather than defined once, so a different default means changing several files.

`VITE_API_URL` also appears in the source. Ignore it — only the leftover course-planner
components read it, and nothing sets it (see [Not part of the product](#not-part-of-the-product)).

### Checking a change

**Neither `yarn build` nor `yarn lint` checks what its name suggests.**

- `yarn build` is a bare `vite build`. It does not typecheck: a type error builds and ships.
- `yarn lint` runs ESLint 9, which needs an `eslint.config.js`, and there is none. It fails
  before linting anything.

The check that works is the TypeScript compiler on its own:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

It currently reports **zero** errors, so treat any error as one you introduced. There are no
tests, and CI's deploy runs none of these — it installs, stages the map and builds.

## How it fits together

### Live data

All live data comes through one STOMP connection, opened by `src/hooks/useWebSocketRobots.ts`
over SockJS. It subscribes to three topics:

| Topic | Becomes |
|:--|:--|
| `/topic/robot-locations` | `robots` — replaced whole on each message, ten times a second |
| `/topic/robot-stats` | `stats` — renamed from the wire's `serving` to the UI's `servingCount`, and so on |
| `/topic/orders` | `orders` — every four seconds |

`RobotWebSocketProvider` calls that hook once, above the router, so the socket opens at start-up
and survives navigation. Components read from it with **`useRobotContext()`**.

Two consequences:

- **Never call `useWebSocketRobots()` in a component.** It opens a second socket.
- **Anything that reads the context re-renders ten times a second.** That is why
  `ConnectionStatus` is its own small component, and why `DashboardSelectionProvider`
  deliberately does not read the context.

Reconnection is the STOMP client's: five seconds between attempts, four-second heartbeats both
ways. The hook only reports the state — `connecting` before the first connection,
`connected`, or `disconnected`. It listens for a clean close as well as an error, because a
backend restart or an nginx reload closes the socket without one, and the dashboard would
otherwise go on showing stale data as live.

### The map

`src/components/maps/RestaurantMap.tsx` draws the floor plan with plain Leaflet, not
`react-leaflet` — although that is a dependency — because react-leaflet's containers do not
survive being moved or remounted by the widget layout.

The floor plan is an image overlay in Leaflet's `CRS.Simple`, which works in pixels.
`map-manifest.json` supplies the image size, the metres-per-pixel `resolution` and the map
`origin`, and each robot's position, in metres in the ROS map frame, is converted with
`(x − origin) / resolution`. The manifest, the backend's drop points and the fleet's Nav2 map are
all generated from the same sources in `map-source/`, which is what keeps the three in agreement
— see [map-source/README.md](../map-source/README.md).

Robot colours come from one function, `getRobotStatusColor`, shared by the markers, their trails
and the legend. `Serving`, `Returning` and `Waiting` have colours of their own; **any other
status is drawn red**, the colour for `Maintenance`.

### The dashboard layout

The home page is a grid of resizable widgets — the map, the robot table and the order list —
with its layout saved in `localStorage`. It has
[its own README](./src/components/dashboard/README.md).

### Signing in

**Nothing is behind sign-in.** Without signing in, the dashboard runs as a built-in guest user
(`GUEST_USER` in `src/context/AuthContext.tsx`). Signing in stores the returned `userId` in
`localStorage`, and that only decides which user record the header and the profile page load.
`isGuest` is exported but nothing reads it.

The backend does not authenticate requests either; [docs/api.md](../docs/api.md#authentication)
sets out what that means.

## Finding your way around

The app was built on the [TailAdmin](https://tailadmin.com/) React template, and **the package is
still named `tailadmin-react`**. A good part of `src/` is template that was never removed, so
location and naming are not reliable guides.

| Route | What it is |
|:--|:--|
| `/` | **The product** — the widget dashboard |
| `/profile` | The signed-in user's record |
| `/contributors` | The project team |
| `/signin`, `/signup` | Operator accounts |
| `/calendar` | Not DishPatch — see below |
| `/blank`, `/form-elements`, `/basic-tables`, `/alerts`, `/avatars`, `/badge`, `/buttons`, `/images`, `/videos`, `/line-chart`, `/bar-chart` | TailAdmin demo pages |

Only `/` is linked from the header menu; the user dropdown adds `/profile`, `/contributors` and
sign-in. Every other route is reachable only by typing its URL.

Names that mislead:

- **`components/ecommerce/` is not e-commerce.** `RobotStatus.tsx` is the robot table and
  `Orders.tsx` the order list. `DemographicCard.tsx` is a thin wrapper around `RestaurantMap`,
  and it is what the widget registry registers as the map. The other five files in the folder are
  template that nothing imports.
- **`components/ui/` is shared.** Product components use its dropdown and table — the header,
  the robot table and the order list all depend on it — so it is not template that can go.
  `components/form/` is used by the demo forms page and by `UserAddressCard` on the profile
  page; `components/charts/` only by the two chart demo pages.
- **There is no `tailwind.config.js`.** Tailwind 4 is configured in CSS, in the `@theme` block
  of `src/index.css`.
- **`vite.config.ts` polyfills Node's `global`, `buffer` and `process`** for dependency
  pre-bundling, because `sockjs-client` expects them.

### Not part of the product

`/calendar` renders `SemesterPlanner`, a university course planner from an unrelated project,
with its `GraduationRequirementTable` and `SemesterHeaderToolbar` in `components/tables/`. These
are the only readers of `VITE_API_URL`. The `/blank` and `/basic-tables` pages still carry that
project's page title.

## Deployment

[`deploy-control-frontend.yml`](../.github/workflows/deploy-control-frontend.yml) deploys the
CloudFormation stack in
[`infrastructure-control-frontend.yml`](../infrastructure/infrastructure-control-frontend.yml) — a
private S3 bucket behind CloudFront — then installs, stages the map, builds with
`VITE_BACKEND_URL=https://controlapi.dish-patch.com`, syncs `dist/` to the bucket and invalidates
the CloudFront cache. It runs on pushes to `main` that touch this folder or `map-source/`, so a
change to this README redeploys the site too.
