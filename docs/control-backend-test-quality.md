# Control Backend — Test Quality Report

This document is evidence for a single claim: **the control-backend test suite would
notice if the code broke.** Test count and line coverage cannot support that claim, so
they are not what is reported here.

> **Scope:** `control-backend` only. Measurements were taken on JDK 17 at commit
> `0abe1e3`. Code quality (static analysis, style checking) is out of scope for this
> document.

---

## 1. Method

Five independent measurements, because each proves something different and none is
sufficient alone:

| Measurement | What it proves | What it cannot prove |
|:--|:--|:--|
| Mutation score | Tests detect injected faults | Anything about code the tests never reach |
| Branch coverage | Decision paths are exercised | That anything was *asserted* |
| Determinism | Results are trustworthy | That the assertions are meaningful |
| Smell audit | Known anti-patterns are absent | That the tests are correct |
| Traceability | Tests answer real defects | That coverage is complete |

Sections 7 and 8 are the substantive ones. A number can be produced by any project;
what distinguishes this suite is that it was attacked deliberately, and the results of
those attacks — including the ones that exposed our own bad tests — are reported.

---

## 2. Suite overview

**162 tests, green in ~9 seconds**, across three levels.

| Rung | Scope | Files | Tests |
|:--|:--|--:|--:|
| 1 — Unit | One class, collaborators mocked | 10 | 110 |
| 2 — Integration | Real Spring context, out-of-process beans mocked | 2 | 13 |
| 3 — Component / API | Real HTTP through Spring's dispatcher | 6 | 39 |

Two changes since the previous measurement. `UserControllerTest` was added at rung 3 with
the signup and login work. And `DropPointServiceTest` moved from rung 1 to rung 2 — it is
annotated `@SpringBootTest` and boots a real context, so it was previously filed one rung
too low. Rung 3 no longer claims "services mocked": `UserControllerTest` drives a real
`UserService` over a mocked `UserRepository`, because the behaviour worth pinning — a
status code decided by the controller from a guard living in the service — spans both.

The distribution is deliberately pyramid-shaped: the slowest and most brittle level is
the smallest. Total runtime matters as a quality property in its own right — a suite
that takes minutes stops being run before every change.

Full file-level breakdown is in the project's PR description; the ladder is summarised
here to establish that the levels were chosen rather than accumulated.

---

## 3. Mutation score (primary evidence)

Measured with PIT. It injects faults into the source — inverting conditionals, altering
boundaries, removing calls — then re-runs the suite and reports how many the tests
caught.

```
353 mutations generated
223 killed                    63%  mutation score
 75 with no test coverage
                              80%  test strength
```

**Two numbers, because they answer different questions.** *Mutation score* (63%) is
kills over all mutants, including those in code no test reaches. *Test strength* (80%)
is kills over only the mutants the tests actually reach — it measures the quality of the
tests we have, separately from the question of what is untested.

Runtime: 51 seconds.

**The two numbers moved in opposite directions**, and that is the useful part. At the
previous measurement the score was 64% and strength 79%. The tests that exist got
*better* — strength rose — while the overall score fell, because the signup/login work
added `UserRepository`, 12 mutants of which none are covered. An untested new class
drags the score down without saying anything about the tests already written. Reporting
only the score would have hidden both halves of that.

### Scope of this measurement

PIT re-runs the covering tests once per mutant, so anything that boots a Spring context
is prohibitively slow. `ApplicationContextTest` and all five `@WebMvcTest` classes are
excluded from the run, and the controller classes they cover are excluded from the
target set as well — leaving them targeted while their only tests are excluded would
report them at 0% and understate the suite rather than measure it.

**This score therefore covers the service and domain layer, not the controllers.** The
controllers are covered by the rung-3 tests reported in section 2.

`com.dishpatch.user` was added to the target set for this measurement. It had been
absent, which would have left `UserService` — the email-uniqueness guard and the login
validation that the new tests were written for — outside the score entirely while this
section claimed to cover the service layer. `UserControllerTest` stays *in* the run
despite driving MockMvc, because it boots no Spring context and is the only test
reaching `UserService`; only `UserController` itself is excluded from the target set.

### By class

| Class | Mutants | Killed | No coverage | Score |
|:--|--:|--:|--:|--:|
| `DynamoDbValueMapper` | 21 | 21 | 0 | **100%** |
| `OrderStatus` | 8 | 8 | 0 | **100%** |
| `OrderService` | 8 | 8 | 0 | **100%** |
| `DropPointService` | 4 | 4 | 0 | **100%** |
| `DispatchAssignment` | 3 | 3 | 0 | **100%** |
| `UserService` | 23 | 16 | 6 | 70% |
| `RosBridgeService` | 68 | 46 | 8 | 68% |
| `DispatchService` | 128 | 78 | 25 | 61% |
| `RobotService` | 68 | 39 | 14 | 57% |
| `UserRepository` | 12 | 0 | 12 | **0%** |
| `OrderRepository` | 10 | 0 | 10 | **0%** |

The five classes at 100% are the ones covered by pure unit tests written against a known
contract. `RosBridgeService` improved from 61% to 68% on the back of the nav-status
tests added since the last run.

Both repositories sit at 0%, and for the same reason: their condition expressions and
pagination loops cannot be tested with mocks and need DynamoDB Local. That was already
the known gap for `OrderRepository`; `UserRepository` has now joined it, and between
them they account for 22 of the 75 uncovered mutants (section 9).

### What the run found that we did not know

The most useful output was not the score. Grouping surviving mutants by operator:

| Mutation operator | Not killed | Generated | |
|:--|--:|--:|--:|
| `ConditionalsBoundaryMutator` | 10 | 13 | **77%** |
| `BooleanTrueReturnValsMutator` | 16 | 30 | 53% |
| `MathMutator` | 9 | 20 | 45% |
| `VoidMethodCallMutator` | 25 | 71 | 35% |
| `NegateConditionalsMutator` | 36 | 132 | 27% |

"Not killed" counts survivors and uncovered mutants together, since both mean the same
thing from the suite's point of view: the fault was injected and nothing failed.

**Boundary mutations are not killed at 77%, unchanged from the previous run.** This
codebase is built on thresholds — a grace window, an attempt cap, an arrival radius, a
20-second freshness window — so this is the weakest point in the suite and the clearest
direction for the next round of work. It is also the one category that did not improve:
the two gaps named below were reported last time and both are still open.

- **`RosBridgeService.publishGoal:529-530`** — `Math.sin(yaw / 2.0)` and
  `Math.cos(yaw / 2.0)`, the outgoing quaternion conversion. PIT replaced division with
  multiplication and **no test noticed**. Every navigation goal would be published with
  a wrong heading. The suite tests the *inverse* conversion
  (`RobotServiceTest.recoversHeadingFromTheQuaternion`, quaternion → yaw on incoming
  telemetry) but never yaw → quaternion on outgoing goals.
- **`DispatchService.hasArrived:578`** — `distance <= ARRIVAL_RADIUS_M`. Nothing
  exercises a robot at exactly the arrival radius, so the boundary is unpinned.

Neither gap was visible in coverage, and neither was caught by code review. This is the
argument for mutation testing, made on our own code.

---

## 4. Branch coverage

Measured with JaCoCo, produced on every CI run and uploaded as a build artifact.

| Counter | Covered | Total | % |
|:--|--:|--:|--:|
| **Branch** | 220 | 333 | **66.1%** |
| Line | 772 | 1036 | 74.5% |
| Instruction | 3499 | 4546 | 77.0% |

**Branch coverage is the figure quoted**, not line coverage. A line counts as covered
when a test merely executes it; a branch requires both outcomes of a decision to be
taken. Quoting 74.5% when 66.1% is the better-founded number would overstate the result.

| Package | Branch | Line |
|:--|--:|--:|
| `controller` | 100% | 100% |
| `map` | 100% | 100% |
| `dispatch` | 77.1% | 87.8% |
| `order` | 69.6% | 65.4% |
| `service` | 63.4% | 81.3% |
| `config` | 50.0% | 78.8% |
| `user` | 40.9% | 30.6% |
| `utils` | — | 0% |

**Branch coverage fell from 69.9% to 66.1%, and this is a real regression, not noise.**
44 new branches arrived with the `user` package and only 18 of them are covered. Every
other package is unchanged to the decimal. `user` is now the weakest area in the
codebase by both measures, below even `config`.

`utils` (`SSLUtils`) still has no tests at all. `order` is depressed by
`OrderRepository`, the same gap as in section 3.

**Coverage is reported as a supporting metric, not as evidence of test quality.** Section
7 documents a case in this repository where a test had full line coverage of the method
it guarded and detected nothing.

---

## 5. Determinism

The suite was run **30 consecutive times**: **30 passed, 0 failed.**

Flake-inducing constructs, verified by search across the whole test tree:

| Construct | Count |
|:--|--:|
| `Thread.sleep` | **0** |
| `@Disabled` / `@Ignore` | **0** |
| Empty `catch` blocks | **0** |

`Thread.sleep` was previously present in two rosbridge retry tests. Both were rewritten
to wait on a `CountDownLatch`, so a slow CI runner makes them slower rather than red.
`DispatchService`'s time-dependent behaviour is tested through an injected `Clock`, which
is why a suite covering 20-second timeouts and multi-minute recovery sequences completes
in 9 seconds.

Rerun-on-failure (`-Dsurefire.rerunFailingTestsCount`) is deliberately **not** configured.
It hides flakiness rather than measuring it.

---

## 6. Test smell audit

Audited manually against the test-smell catalogue (van Deursen et al., 2001). A manual
audit is used in preference to a tool because the interesting result is the reasoning
about an accepted smell, not a count.

| Smell | Present | Evidence / decision |
|:--|:--|:--|
| Assertion-free test | No | 162 `@Test` methods scanned, 0 without an assertion |
| Sleepy Test | No | 0 occurrences of `Thread.sleep`; both former cases converted to latches |
| Mystery Guest | **Yes — accepted** | See below |
| Eager Test | Marginal | Median 2 assertions per test (min 1, max 10); the max is a deliberate field-by-field JSON contract check |
| Assertion Roulette | No | Assertions carry explanatory messages throughout |
| Conditional Test Logic | No | The only loops are a one-hot matrix and fixture helpers, not branching assertions |
| Ignored Test | No | 0 `@Disabled` |

### The accepted smell

`DropPointServiceTest` and `DispatchFixture` read `drop-points.json` from the classpath —
a real file generated by `map-source/stage-map-assets.sh`. This is textbook **Mystery
Guest**: the tests depend on external state, and fail if the staging step has not run.

It is kept deliberately. Guarding that staging pipeline is one of the test's purposes —
the file is gitignored and generated, so a broken staging step should fail the build
loudly rather than surface as a robot driving to the wrong table. Using invented
coordinates instead would make the distance assertions in `DispatchRecoveryTest`
meaningless, since they compare real drop points against a real floor plan.

The cost is a documented prerequisite, stated in the reproduction steps in section 10.

---

## 7. Targeted mutation experiments

Four faults were introduced by hand and the suite observed. These predate the automated
PIT run and were the reason for commissioning it.

| # | Fault introduced | Result |
|:--|:--|:--|
| 1 | Removed `GOAL_ABORTED` from `RosBridgeService.lastGoalFailed` | All 26 dispatch tests stayed green. Caught only by `RosBridgeNavStatusTest` (4 failures) |
| 2 | `new StandardWebSocketClient()` — reinstating the #68 8 KB buffer | **All 8 rosbridge tests stayed green** |
| 3 | Hardcoded a wrong table name in `DynamoDbController.health()` | **All 3 tests stayed green** |
| 4 | Transposed `robotStale` / `goalFailed` in `DispatchController` | **All 7 tests stayed green** |

### Experiment 1 — the case for the test

The dispatch package stubs `isNavigating()` and `lastGoalFailed()` in every one of its 26
tests, so all of them encode our *belief* about Nav2's semantics rather than the parser's
behaviour. Inverting that parser leaves the entire dispatch suite green.
`RosBridgeNavStatusTest` was written specifically to close that seam, and it is the only
thing that catches the fault. This is the seam the 2026-08-11 outage came through.

### Experiments 2–4 — the case against our own tests

The remaining three exposed defects **in the tests**, not the code. Experiment 2 is the
most instructive: the #68 guard asserted on a `WebSocketContainer` it constructed itself
rather than the one the service dials with. Because `ContainerProvider` returns a fresh
container per call, the test measured 1 MB and passed while the service ran on the 8 KB
default that caused the original incident.

**That test had full line coverage of the method it guarded and a fault-detection rate of
zero.** It is the clearest available demonstration that coverage and test quality are
different properties.

All four faults are now detected. Each fix was verified by re-planting the fault and
confirming a red suite before reverting.

---

## 8. Adversarial review of the test suite

The suite was reviewed by three independent agents with distinct remits — CI
configuration, test rigour, and production-code safety — instructed to find tests that
could not fail.

**Seven findings, five confirmed real, three verified by mutation.** Two were tests that
provably could not fail (experiments 3 and 4 above). All five were fixed before merge.

The review also rejected several plausible-sounding concerns after verification — the
`System.currentTimeMillis()` bracketing in `RobotServiceTest` was checked and found sound
in both directions, and the `ThreadLocal` log capture in `DispatchFixture` was confirmed
correct. Reporting what the review *cleared* matters as much as what it caught.

---

## 9. Limitations

Stated so the figures above are not read as broader than they are.

- **The mutation score excludes the controllers** (section 3). It measures the service
  and domain layer.
- **Neither repository is tested** — `OrderRepository` and `UserRepository` are both at
  0% mutation score, and are the main drag on `order` and `user` package coverage. Their
  condition expressions and scan pagination cannot be tested with mocks; this needs
  DynamoDB Local or Testcontainers, which is planned work.
- **`user` is the weakest package** at 40.9% branch and 30.6% line coverage, and it is
  the reason overall branch coverage fell from 69.9% to 66.1% (section 4). It is also
  the newest, and it handles authentication — the combination is worth stating plainly
  rather than leaving to be inferred from the table.
- **`SSLUtils` has no tests** — 0% line coverage.
- **Boundary conditions are the weakest area**, at 77% mutant survival for boundary
  mutations. Two specific gaps are named in section 3.
- **No end-to-end tests exist.** Nothing exercises the full chain from order to delivered
  meal; the highest level reached is a single deployable driven over HTTP.
- **Coverage figures include only `control-backend`.**

---

## 10. Reproduction

All figures in this document are reproducible from a clean checkout. **JDK 17 is
required** — Mockito cannot instrument classes on much newer JVMs, and the resulting
error names Mockito rather than the JDK.

```bash
# Prerequisite: stage the generated map assets (gitignored, see section 6)
./map-source/stage-map-assets.sh
```

```bash
# Suite + branch coverage -> control-backend/target/site/jacoco/index.html
cd control-backend && JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn --batch-mode test
```

```bash
# Mutation score -> control-backend/target/pit-reports/index.html  (~51s)
cd control-backend && JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn --batch-mode test-compile org.pitest:pitest-maven:mutationCoverage
```

```bash
# Determinism: 30 consecutive runs, expect 30/30
cd control-backend && for i in $(seq 1 30); do JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn -q --batch-mode -Djacoco.skip=true test || echo "FAILED run $i"; done
```

Coverage is produced on every CI run and uploaded as the `jacoco-coverage` artifact by
[`.github/workflows/test-control-backend.yml`](../.github/workflows/test-control-backend.yml).
PIT is run on demand — at roughly 51 seconds it is too slow to gate a pull request.
