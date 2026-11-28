# Maintainable code and Spring API design

Apply this guide to the code being changed, with the existing module and platform
conventions. It is not authorization for a repository-wide rewrite, a new approval
gate, or automatic publication of a review. Correctness, security and compatibility
come before a shorter function or fewer lines. Follow the repository's existing
TDD/refactoring procedure and the user's verification instructions.

## Reveal the reason for each step

- Use names that describe domain intent and outcomes. Avoid generic helpers such
  as `processData` when the operation is actually selecting eligible activities.
- Keep orchestration at one level: a reader can select a period, load owned data,
  calculate metrics and assemble a response. Put the details behind names only
  when those names make the flow easier to understand.
- Separate responsibilities that change for different reasons. Prefer a meaningful
  private function first; extract a class when it owns a coherent policy, invariant
  or lifecycle. Do not turn every step into a bean or interface.
- Introduce a parameter/result type when it represents a real concept or prevents
  invalid state combinations. Do not add a generic context bag with unrelated data.
- Distinguish a boolean that selects an unrelated operation from a natural boolean
  fact or local execution state. Explicit operations/result variants can clarify
  ambiguous flags; replacing every boolean with an enum does not improve design.
- Remove duplicated policy, but keep independent concepts separate even when their
  code currently looks similar. Avoid speculative inheritance, strategy hierarchies,
  framework dependencies and universal utility classes.

For example, extracting `completionMetrics(activities, diaries, period)` can name
an independently testable calculation. Splitting that calculation into one-line
classes purely to reduce method length increases navigation without revealing intent.
There are no fixed function-length, parameter-count or class-count quotas.

## Make state, ownership and side effects explicit

- Read time at a deliberate boundary and pass it through calculations. Copy mutable
  or persistence-backed input into immutable values before pure calculation.
- Keep full source data distinct from limited presentation/transport samples. A
  cache hash based on full evidence must not silently become a hash of a top-K list.
- Keep errors, absent data and successful empty results distinct. Catch errors where
  there is a concrete recovery or translation policy; preserve causes and interruption
  where applicable. Never log credentials or private source text to aid debugging.
- Give mutable state a clear owner and lifetime. For concurrent work, specify atomic
  reservation, ownership of a task/future, publication and release. An old task must
  not release or republish over a replacement task.
- Comments should explain constraints, tradeoffs and invariants that the code cannot
  convey. Do not narrate obvious statements or replace implementation with long TODOs.
  Remove a refactoring TODO only after its responsibility and verification are done.

## Spring API application

- Preserve feature-oriented packages and existing mobile/API/worker boundaries.
  Controllers handle HTTP/authenticated identity and request validation, application
  services coordinate use cases, and persistence code owns queries. Do not expose
  JPA entities as API contracts. External DTOs belong in the feature's `dto` package;
  small internal value records can stay beside the code that uses them.
- Use constructor injection for required collaborators. Keep calculations ordinary
  Java code where Spring lifecycle/proxy behavior is unnecessary. An interface is
  justified by a real boundary or variation, not by one existing implementation.
- Keep business policy in its feature. Reuse common infrastructure configuration
  for HTTP clients, clocks and similar concerns rather than subclassing configuration
  or duplicating connection setup. Use typed configuration for cohesive configurable
  values when warranted; do not create configuration classes for every constant.
- Define transaction and lazy-loading boundaries explicitly. Read-only does not
  imply a point-in-time snapshot across separate queries. Copy required relations
  inside the existing transaction; pure calculation must not trigger extra queries.
- Private extraction inside a transactional public method retains that outer
  transaction. Adding `@Transactional` to a self-invoked helper does not create a
  new proxy-mediated transaction. If another boundary is required, use an actual
  collaborator or explicit transaction mechanism and verify it in integration tests.
- Keep slow HTTP calls/future waits outside DB transactions and synchronization
  monitors when the use case allows it. Do not move a durable outbox or a deliberately
  locked deletion job out of its transaction just to satisfy a blanket rule.
- Separate DB commit from effects that must happen only after success. Preserve
  `AFTER_COMMIT` event timing, durable retry requirements and rollback behavior.
  An after-commit listener must not assume new DB writes will be committed through
  the already completed transaction.
- Preserve owner filtering, SQL/FK guarantees, lock ordering, cache TTL/capacity,
  timeout and error contracts during structural changes. Refactoring is not an
  excuse to change OpenAPI or fixture expectations to match accidental behavior.

## Verification and handoff

Start a behavior-preserving refactoring from the relevant existing test results.
Add characterization tests for unprotected behavior before changing it; they may
pass immediately. Preserve observable output, deterministic order/hash, boundary
conditions and failure/concurrency behavior. Test responsibilities at their proper
unit/controller/repository/integration scope, not private method names or class shape.
Use a real PostgreSQL scope when the claim depends on JPA/FK/locking behavior.

Assess the final diff against the concrete responsibilities/invariants above. In the
handoff, briefly name what became easier to understand/change and which behavior
was preserved. Record changed behavior separately if a genuine defect is found;
follow the existing bug-fix/TDD rules instead of silently changing semantics.
Report environment failures and excluded checks rather than treating them as passing.
Do not add new tools, gates or tests that merely enforce personal formatting taste.

## References

These are principles to adapt to this codebase, not instructions to upgrade the
project to whichever version the documentation currently describes.

- [Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html)
- [Extract Function](https://refactoring.com/catalog/extractFunction.html)
- [Flag Argument](https://martinfowler.com/bliki/FlagArgument.html)
- [Simple design rules](https://martinfowler.com/bliki/BeckDesignRules.html)
- [Spring Boot code structure](https://docs.spring.io/spring-boot/reference/using/structuring-your-code.html)
- [Spring constructor injection](https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html)
- [Spring transaction proxies](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)
- [Spring transaction-bound events](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html)
