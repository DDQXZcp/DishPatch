# Control Backend

The Spring Boot service between the POS and the robots. It reads orders from the DynamoDB
table the POS writes to, assigns each one to a robot and sends that robot a navigation goal
over rosbridge, and streams the fleet and the order list to the operator dashboard.

| Read next | For |
|:--|:--|
| [Dispatch pipeline](./src/main/java/com/dishpatch/dispatch/README.md) | How an order becomes a delivery — the state machine, recovery, cancellation. The core of this service, documented in depth. |
| [docs/api.md](../docs/api.md) | Every HTTP route and STOMP topic this service exposes |
| [Test quality report](../docs/control-backend-test-quality.md) | Mutation score, branch coverage, determinism and test smells |

## Running it locally

### Prerequisites

**JDK 17.** The pom targets 17 and CI builds on 17. On a much newer JDK the build still runs,
but Mockito cannot instrument classes and every test that mocks fails — with an error that
names Mockito rather than the JDK. Pin it explicitly rather than relying on the default:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)   # macOS
```

**Staged map assets.** `src/main/resources/drop-points.json` is generated from `map-source/`
and gitignored. Stage it once from the repository root:

```bash
./map-source/stage-map-assets.sh
```

Without it the service does not start: `DropPointService` loads the file in a
`@PostConstruct`, and a missing file fails the application context. That is deliberate —
better than starting up unable to route a single order.

**AWS access to the DynamoDB tables** below, from a local `.env` or your usual credential chain.

### Configuration

`application.properties` imports `control-backend/.env` if it exists, so local values can live
there; in production the file is absent and the service runs on environment variables and
the EC2 instance role.

| Variable | Default | Read by |
|:--|:--|:--|
| `AWS_REGION` | `ap-southeast-2` | the DynamoDB client |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | empty | the DynamoDB client — static credentials when set, otherwise the default provider chain, which is the instance role on EC2 |
| `ORDERS_TABLE` | `dishpatch-pos-backend-Orders` | orders and dispatch. **The table the POS writes to** — the two components must agree. |
| `CONTROL_BACKEND_USERS_TABLE` | `Users` | operator accounts (`/api/users`), with an `EmailIndex` on `email` |
| `USERS_TABLE` | `dishpatch-pos-backend-Users` | **nothing.** Mapped to a property no code reads. |

Three settings live in `application.properties` itself rather than in the environment:

| Property | Value | Meaning |
|:--|:--|:--|
| `rosbridge.url` | `ws://15.135.131.146:9090` | The fleet's rosbridge. Hardcoded — see [Talking to the fleet](#talking-to-the-fleet). |
| `dispatch.enabled` | `true` | Set `false` to stop dispatching robots without taking the service down. `GET /api/dispatch` keeps reporting. |
| `nav.test-endpoint.enabled` | `false` | The unauthenticated manual-goal endpoint, `/api/nav`. Leave it off; see [docs/api.md](../docs/api.md#navigation-test-endpoint--apinav-disabled). |

### Run

```bash
mvn spring-boot:run
```

It listens on `http://localhost:8080`, which is where the dashboard looks when
`VITE_BACKEND_URL` is unset. `yarn start` in this folder runs the same command — the
`package.json` here is only a set of script aliases for Maven.

## Package map

Everything is under `src/main/java/com/dishpatch/`.

| Package | Contents |
|:--|:--|
| `dispatch` | The delivery pipeline: `DispatchService` and its one-second tick, the assignment record and state enum, and `GET /api/dispatch`. Has [its own README](./src/main/java/com/dishpatch/dispatch/README.md). |
| `order` | `/api/orders`, the DynamoDB repository, `OrderStatus` — the three-value contract with the POS — and `DynamoDbValueMapper`, which turns DynamoDB attribute values into plain Java values. |
| `service` | `RosBridgeService`, the WebSocket client to rosbridge; `RobotService`, the in-memory fleet and its broadcast to the dashboard. |
| `user` | `/api/users` — operator signup and login, with bcrypt hashes. |
| `map` | `DropPointService`: the named destinations (`T1`–`T18`, `R1`–`R7`, `counter`) loaded from `drop-points.json`. |
| `controller` | `/api/dynamodb/health`, and the disabled `/api/nav` test endpoint. |
| `config` | CORS, the STOMP endpoint, and the DynamoDB client. |
| `model` | `Robot`, the shape sent to the dashboard. |
| `utils` | `SSLUtils`, which nothing references. |

## Talking to the fleet

`RosBridgeService` opens a WebSocket to rosbridge at startup and retries every five seconds
until it connects. It does not need to be told how many robots exist: every ten seconds it
asks rosbridge for the topic list and follows every `/robot{id}/status` it finds. For each
robot it subscribes to telemetry and to Nav2's goal status, and advertises the `goal_pose`
topic it publishes goals on. The topics themselves are described in
[robot-fleet/README.md](../robot-fleet/README.md#backend-interface).

`rosbridge.url` is a **plain `ws://` URL to the fleet EC2's raw IP**. Browsers reach rosbridge
through TLS at `wss://rosbridge.dish-patch.com`; this service does not. Its link to the fleet
is unencrypted, and the address has to be edited by hand if that instance's IP changes.

## What runs on its own

Four scheduled jobs. None has a thread pool of its own: enabling the STOMP broker provides a
`TaskScheduler`, `@EnableScheduling` binds to it, and so dispatch shares a pool with the
messages that keep the dashboard live. A job that blocked would stall both.

| Job | Every | Does |
|:--|:--|:--|
| `DispatchService.tick` | 1 s | Advances deliveries, homes idle robots, assigns pending orders |
| `RobotService.broadcastRobots` | 100 ms | Pushes `/topic/robot-locations` and `/topic/robot-stats` |
| `OrderService.broadcastOrders` | 4 s | Scans the Orders table and pushes `/topic/orders` |
| `RosBridgeService.discoverRobots` | 10 s | Looks for robots that have appeared |

`DispatchService.tick` and `OrderService.broadcastOrders` both scan the Orders table, on their
own schedules, so the table is read about 1.25 times a second.

## Testing

```bash
mvn test
```

163 tests, about nine seconds, with JaCoCo's branch-coverage report written to
`target/site/jacoco/index.html`. Mutation testing is run on demand rather than on every build:

```bash
mvn test-compile org.pitest:pitest-maven:mutationCoverage
```

Both need JDK 17 and the staged map assets — several tests read the real
`drop-points.json` on purpose, so that distances are the restaurant's real geometry. The
[test quality report](../docs/control-backend-test-quality.md) explains how the suite was
measured and what it does and does not prove.

CI runs the suite on every pull request that touches this folder or `map-source/`, and again
before every deployment.

## Deployment

The service runs in Docker on a hand-provisioned EC2 instance, behind the nginx container in
[`control-nginx/`](../control-nginx). Both join a shared Docker network; the backend's alias on
it is `dishpatch-backend`, on port `8081`, which is the upstream nginx proxies to. The port is
never published to the host.

| File | Use |
|:--|:--|
| `Dockerfile` | The image: a JAR built beforehand, on a Java 17 JRE, running as a non-root user. It does not compile anything, so run `mvn package` before `docker build`. |
| `compose.production.yaml` | The production container |
| `compose.test.yaml` | A second copy for testing on the same host, published only on `127.0.0.1:18081` |

[`deploy-control-backend.yml`](../.github/workflows/deploy-control-backend.yml) builds and
tests the JAR, copies it and the nginx configuration to the instance over SSH, deploys nginx
first and the backend second, then checks the public route. It runs on pushes to `main` that
touch this folder, `control-nginx/` or `map-source/` — so a documentation-only change here
redeploys the service too.

## Things that look important and are not

These are in the folder or the build, and do nothing. Each one is worth knowing about before
assuming otherwise.

- **JPA and H2.** `spring-boot-starter-data-jpa` and `h2` are on the classpath with no entity
  and no repository. Spring Boot still sees them and configures a datasource, so every start
  boots Hibernate, a connection pool and an empty in-memory H2 database. Persistence is
  entirely DynamoDB.
- **Other unused dependencies.** The Paho MQTT client, `dotenv-java` and `dynamodb-enhanced`
  are declared and never imported. `.env` loading is Spring's own `spring.config.import`.
- **`USERS_TABLE`**, covered above.
- **`deployment-scripts/`** installs the backend and the simulator as systemd services, with
  MQTT credentials. It predates the move to Docker and nothing calls it.
- **`virtual-robots/virtual-robots.py`** is a bench simulator that pushes random robots into
  `/app/robot-data`. The deployed fleet does not use it — real telemetry comes from rosbridge.
  Running it against a live backend will put fake robots on the dashboard.
- **`utils/SSLUtils`**, covered above.
