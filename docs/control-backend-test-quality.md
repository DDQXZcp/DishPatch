# Control Backend — Test Quality Report

This document is evidence for a single claim: **the control-backend test suite would
notice if the code broke.** Test count and line coverage cannot support that claim, so
they are not what is reported here.

> **Scope:** `control-backend` only. Measurements were taken on JDK 17 at commit
> `16d6590`, from a clean build of a fresh export with no `control-backend/.env` — the
> conditions CI runs under. Section 10 explains why both conditions change the figures.
> Code quality (static analysis, style checking) is out of scope for this document.

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

**163 tests, green in ~7 seconds**, across three levels.

| Rung | Scope | Files | Tests |
|:--|:--|--:|--:|
| 1 — Unit | One class, collaborators mocked | 10 | 111 |
| 2 — Integration | Real Spring context, out-of-process beans mocked | 2 | 13 |
| 3 — Component / API | Real HTTP through Spring's dispatcher | 6 | 39 |

One test was added since the previous measurement:
`DispatchAssignmentTest.keepsDispatchingWhenAServedOrderIsNoLongerPreparing`, with the fix
for a regression that stopped all dispatch (section 7, experiment 5). Order cancellation
arrived in the same period and added none — section 7, experiment 6, shows what that leaves
undetected.

`DropPointServiceTest` sits at rung 2 because it is annotated `@SpringBootTest` and boots a
real context. Rung 3 does not claim "services mocked": `UserControllerTest` drives a real
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
357 mutations generated
224 killed                  62.7%  mutation score
 78 with no test coverage
                            80.3%  test strength
```

**Two numbers, because they answer different questions.** *Mutation score* is kills over
all mutants, including those in code no test reaches. *Test strength* is kills over only
the mutants the tests actually reach — it measures the quality of the tests we have,
separately from the question of what is untested.

Runtime: 46 seconds.

**Since the previous measurement** (`0abe1e3`: 353 mutants, 63.2% score, 80.2% strength)
four mutants appeared, all in order cancellation. Three are in the code that takes a
cancelled delivery off its robot — the two conditions of its check and the call that does
it; one is in the repository's new branch that tells a missing order from one that has
moved on. One of the four is killed, and only by accident: negating the check abandons
*every* delivery, which existing tests notice. The other three are never reached — two
because no test cancels an order, one because the repository has no tests at all.

The fix for the dispatch stall (section 7, experiment 5) added no mutants at all: PIT skips
logging calls by default, and a `try`/`catch` has no condition to mutate.

That is a whole feature arriving untested and moving the score by half a point. Three
unreached mutants in 357 barely register in an aggregate, which is why the per-class and
per-method breakdowns are reported below rather than the headline alone.

### Scope of this measurement

PIT re-runs the covering tests once per mutant, so anything that boots a Spring context
is prohibitively slow. `ApplicationContextTest` and all five `@WebMvcTest` classes are
excluded from the run, and the controller classes they cover are excluded from the
target set as well — leaving them targeted while their only tests are excluded would
report them at 0% and understate the suite rather than measure it.

**This score therefore covers the service and domain layer, not the controllers.** The
controllers are covered by the rung-3 tests reported in section 2.

`com.dishpatch.user` is in the target set; it was absent before September 2026, which left
`UserService` — the email-uniqueness guard and the login validation — outside the score
while this section claimed to cover the service layer. `UserControllerTest` stays *in* the
run despite driving MockMvc, because it boots no Spring context and is the only test
reaching `UserService`; only `UserController` itself is excluded from the target set.

The same exclusion means `OrderController` is outside the score, and with it the line that
passes a cancellation on to dispatch. Section 7, experiment 6, tests that line by hand.

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
| `DispatchService` | 131 | 79 | 27 | 60% |
| `RobotService` | 68 | 39 | 14 | 57% |
| `UserRepository` | 12 | 0 | 12 | **0%** |
| `OrderRepository` | 11 | 0 | 11 | **0%** |

The five classes at 100% are the ones covered by pure unit tests written against a known
contract. Only two rows changed since the previous measurement: `DispatchService` gained
three mutants from the cancellation check and `OrderRepository` one, as described above.

Both repositories sit at 0%, and for the same reason: their condition expressions and
pagination loops cannot be tested with mocks and need DynamoDB Local. Between them they
account for 23 of the 78 uncovered mutants (section 9). The repository's new condition —
only a `Preparing` order may change status — is therefore untested where it lives. It is
the condition behind section 7, experiment 5.

### What the run found that we did not know

The most useful output was not the score. Grouping surviving mutants by operator:

| Mutation operator | Not killed | Generated | |
|:--|--:|--:|--:|
| `ConditionalsBoundaryMutator` | 10 | 13 | **77%** |
| `BooleanTrueReturnValsMutator` | 16 | 30 | 53% |
| `MathMutator` | 9 | 20 | 45% |
| `VoidMethodCallMutator` | 26 | 72 | 36% |
| `NegateConditionalsMutator` | 38 | 135 | 28% |

"Not killed" counts survivors and uncovered mutants together, since both mean the same
thing from the suite's point of view: the fault was injected and nothing failed.

**Boundary mutations are not killed at 77%, unchanged across the last three measurements.**
This codebase is built on thresholds — a grace window, an attempt cap, an arrival radius, a
20-second freshness window — so this is the weakest point in the suite and the clearest
direction for the next round of work. The two gaps named below have been reported at every
measurement since August, and both are still open.

- **`RosBridgeService.publishGoal:529-530`** — `Math.sin(yaw / 2.0)` and
  `Math.cos(yaw / 2.0)`, the outgoing quaternion conversion. PIT replaced division with
  multiplication and **no test noticed**, because no test runs those lines at all: the
  dispatch tests stub `publishGoal`, and nothing calls the real one. Every navigation goal
  would be published with a wrong heading. The suite tests the *inverse* conversion
  (`RobotServiceTest.recoversHeadingFromTheQuaternion`, quaternion → yaw on incoming
  telemetry) but never yaw → quaternion on outgoing goals.
- **`DispatchService.hasArrived:601`** — `distance <= ARRIVAL_RADIUS_M`. Nothing
  exercises a robot at exactly the arrival radius, so the boundary is unpinned.

The two gaps fail differently, and neither was caught by code review. The arrival radius is
invisible to coverage: the line is fully covered and both outcomes of the comparison are
taken, so only a test at the exact boundary could expose it. The quaternion lines do show
in coverage — they have never been run — but as two uncovered lines among 276, nothing marks
them as the lines that set every robot's heading. An earlier edition of this report said
neither gap was visible in coverage; for the quaternion that was wrong. Mutation testing is
what singled out both, and that is the argument for it, made on our own code.

---

## 4. Branch coverage

Measured with JaCoCo, produced on every CI run and uploaded as a build artifact.

| Counter | Covered | Total | % |
|:--|--:|--:|--:|
| **Branch** | 221 | 341 | **64.8%** |
| Line | 781 | 1057 | 73.9% |
| Instruction | 3519 | 4626 | 76.1% |

**Branch coverage is the figure quoted**, not line coverage. A line counts as covered
when a test merely executes it; a branch requires both outcomes of a decision to be
taken. Quoting 73.9% when 64.8% is the better-founded number would overstate the result.

| Package | Branch | Line |
|:--|--:|--:|
| `controller` | 100% | 100% |
| `map` | 100% | 100% |
| `dispatch` | 75.4% | 87.0% |
| `order` | 68.0% | 64.5% |
| `service` | 63.4% | 81.3% |
| `user` | 40.9% | 29.9% |
| `config` | 38.9% | 72.7% |
| `utils` | — | 0% |

**Since the previous measurement, branch coverage went from 65.5% to 64.8%.** Cancellation
added eight branches and three of them are covered. In `dispatch`, the check that takes a
cancelled delivery off its robot has four branches, and only the "not cancelled" side is ever
taken. In `order`, the controller's `CANCELLED` check is covered on both sides — its
cancelling side only by a test about letter case, as section 7, experiment 6, shows — and
the repository's new branch is not covered at all.

`user` is the weakest package by line coverage. By branch, `config` is lower still: it
chooses AWS credentials, and in CI no credentials are set, so only one path through it is
ever taken. `utils` (`SSLUtils`) has no tests. `order` is depressed by `OrderRepository`, the
same gap as in section 3.

### Correction to the previous measurement

The previous edition of this report gave **66.1%** branch coverage at `0abe1e3`. A clean
build of that commit, under CI's conditions, gives **65.5%** — the baseline used above.

The branch difference is entirely the environment it was measured in. That run was made in
a checkout whose `control-backend/.env` set AWS credentials, which sends `DynamoDbConfig` down
its static-credentials branches; CI never sets them. Re-running a clean build of `0abe1e3`
with placeholder credentials reproduces the published branch figure exactly — 220 of 333 —
and `config` at 50.0% instead of 38.9%. One line of the published line coverage, in `user`,
is still unaccounted for; it is consistent with the stale execution data that section 10
also guards against. The mutation figures were unaffected and reproduce exactly, because
`config` is outside PIT's target set.

The fix is in section 10: measure from a clean build, without a local `.env`.

**Coverage is reported as a supporting metric, not as evidence of test quality.** Section
7 documents a case in this repository where a test had full line coverage of the method
it guarded and detected nothing.

---

## 5. Determinism

The suite was run **30 consecutive times**: **30 passed, 0 failed** — some of them while a
second full build ran alongside and loaded the machine.

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
in about 7 seconds.

Rerun-on-failure (`-Dsurefire.rerunFailingTestsCount`) is deliberately **not** configured.
It hides flakiness rather than measuring it.

---

## 6. Test smell audit

Audited manually against the test-smell catalogue (van Deursen et al., 2001). A manual
audit is used in preference to a tool because the interesting result is the reasoning
about an accepted smell, not a count.

| Smell | Present | Evidence / decision |
|:--|:--|:--|
| Assertion-free test | No | 163 `@Test` methods scanned, 0 without an assertion. This is a per-test property: a test can assert something and still leave the effect that matters unchecked — section 7, experiment 6 |
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

### Experiments 5 and 6 — order cancellation, October 2026

Two more, both arising from the order-cancellation work. The first was found rather than
planted.

| # | Fault | Result |
|:--|:--|:--|
| 5 | *Found in review, not planted.* The dispatch tests' stand-in for `OrderService.updateStatus` accepted every write; the real repository refuses one for an order no longer `Preparing` | A regression that stopped all dispatch until a restart passed **all 162 tests** |
| 6 | Deleted the line in `OrderController` that passes a cancellation on to dispatch | **All 11 `OrderControllerTest` tests stayed green** |

### Experiment 5 — a stand-in for a repository that no longer existed

Since commits `88201dd` and `a909ccb`, the order repository changes an order's status only
while it is still `Preparing`, and throws `OrderNotPreparingException` for a row that has
moved on. Dispatch completes every delivery through that call. When something else had
already moved the order — an unauthenticated `PUT`, a POS write, an edit in the DynamoDB
console — the exception escaped before the robot's assignment advanced. The tick caught it
at the top, skipping assignment, and every later tick did the same. One stale row stopped
the fleet until a restart.

All 162 tests passed, because the dispatch tests never touch the repository. `DispatchFixture`
stubs the service in front of it, and the stub accepted every write: it still described the
repository as it had been before those commits. The bug was found by reading the change while
documenting the API, not by any measurement in this report, and none of them could have
found it:

- **PIT** mutates production code and asks whether the tests notice. The tests' picture of the
  repository comes from the stub, and a stub that describes the wrong repository is not
  production code PIT can mutate.
- **Coverage** was unaffected. The path that broke was executed — just never with an order in
  the state that made it throw.

The order of the fix mattered. The stub was changed first, to mirror the real condition, and
with that change alone **no existing test failed**: none had ever completed a delivery whose
order had left `Preparing`. A new test, `keepsDispatchingWhenAServedOrderIsNoLongerPreparing`,
then failed against the unfixed code for the right reason — `expected RETURNING but was
AT_TABLE`, the stranded robot — and passed once `completeAndSendBack` caught the exception.

This is experiment 1's seam again. Every dispatch test runs against stand-ins for its
collaborators, so each one encodes a belief about them, and nothing forces that belief to
change when the collaborator does.

### Experiment 6 — covered, and unasserted

`PUT /api/orders/{id}` with `Cancelled` also calls `dispatchService.cancelOrder(id)`, which is
what takes the robot off the delivery. Deleting that call leaves all 11 `OrderControllerTest`
tests green.

Coverage reports the line as covered, and both branches of the `if` around it. Its cancelling
side is executed by `acceptsALowercaseStatus` — a test written to prove that status parsing
ignores letter case, which happens to send `"cancelled"` and asserts only the `200`. Nothing
anywhere asserts that a cancellation reaches dispatch, and on the dispatch side the code that
acts on it is never reached at all (section 3).

`OrderController` is outside PIT's target set, so this fault had to be planted by hand.
**Unlike experiments 1–4, it is not fixed** — this round added documentation, not tests. It is
listed in section 9.

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
  and domain layer — and so misses the one line that passes a cancellation to dispatch.
- **Order cancellation is untested.** No test asserts that a cancellation reaches dispatch
  (experiment 6), the dispatch code that acts on one is never reached, and the `409` handler
  for an order that is no longer `Preparing` has no coverage.
- **Neither repository is tested** — `OrderRepository` and `UserRepository` are both at
  0% mutation score, and are the main drag on `order` and `user` package coverage. Their
  condition expressions and scan pagination cannot be tested with mocks; this needs
  DynamoDB Local or Testcontainers, which is planned work. That includes the
  `Preparing`-only condition that experiment 5 turned on.
- **Test doubles are outside what these measurements check.** Mutation score, coverage and
  determinism all measure the tests against the stand-ins they use. A stand-in that
  describes a collaborator wrongly is invisible to all three, as experiment 5 shows.
- **`user` has the lowest line coverage of any tested package**, at 29.9%, and 40.9% branch.
  It is also the package that handles authentication, which is worth stating plainly rather
  than leaving to be inferred from the table.
- **`SSLUtils` has no tests** — 0% line coverage.
- **Boundary conditions are the weakest area**: 77% of boundary mutants are not killed.
  Two specific gaps are named in section 3.
- **No end-to-end tests exist.** Nothing exercises the full chain from order to delivered
  meal; the highest level reached is a single deployable driven over HTTP.
- **Coverage figures include only `control-backend`.**

---

## 10. Reproduction

**JDK 17 is required** — Mockito cannot instrument classes on much newer JVMs, and the
resulting error names Mockito rather than the JDK.

Two further conditions decide whether the numbers mean anything, and both have been
learned the hard way.

**A clean build.** Maven keeps a class file that is newer than its source, whoever compiled
it. On 2026-10-05 a working copy's `target/` held classes built by something other than this
build — the same source, compiled to different bytecode. Measured without cleaning, it
reported 1174 lines and 369 mutants; a clean build of the same commit gives 1057 and 357.
JaCoCo also appends to `target/jacoco.exec` across runs by default, so a stale run's data
can be merged into a new one.

**No local credentials.** A `control-backend/.env` that sets AWS credentials changes which
branches of `DynamoDbConfig` run, and with them the coverage figures. Section 4 records the
measurement this affected.

Measuring a fresh export of the commit satisfies both at once, and leaves the working copy
alone. From the repository root:

```bash
rm -rf /tmp/dishpatch-measure && mkdir /tmp/dishpatch-measure && git archive HEAD | tar -x -C /tmp/dishpatch-measure
```

```bash
# Stage the generated map assets (gitignored, see section 6)
cd /tmp/dishpatch-measure && ./map-source/stage-map-assets.sh
```

```bash
# Suite + branch coverage -> target/site/jacoco/index.html
cd /tmp/dishpatch-measure/control-backend && JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn --batch-mode clean test
```

```bash
# Mutation score -> target/pit-reports/index.html  (~46s)
cd /tmp/dishpatch-measure/control-backend && JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn --batch-mode test-compile org.pitest:pitest-maven:mutationCoverage
```

```bash
# Determinism: 30 consecutive runs, expect 30/30
cd /tmp/dishpatch-measure/control-backend && for i in $(seq 1 30); do JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn -q --batch-mode -Djacoco.skip=true test || echo "FAILED run $i"; done
```

Coverage is produced on every CI run and uploaded as the `jacoco-coverage` artifact by
[`.github/workflows/test-control-backend.yml`](../.github/workflows/test-control-backend.yml).
CI starts from a fresh checkout with no `.env` and sets no AWS credentials, so its coverage
figures match these. PIT is run on demand — at roughly 46 seconds it is too slow to gate a
pull request.
