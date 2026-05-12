# Event-Driven Architecture Documentation Reference

---

## 1. Event-Driven-Specific Documentation Concerns

An event-driven architecture (EDA) routes data between components using events: immutable records of something that happened. The event catalog is the primary architecture artifact — it is the equivalent of an API specification for synchronous systems.

**Core questions your documentation must answer:**

- What events exist? What schema does each use? Who publishes, who consumes?
- What ordering guarantees exist (or don't)?
- Can events be replayed? From when? For how long?
- How are consumer failures handled (retries, dead-letter queues)?
- What idempotency guarantees do consumers provide?
- How does the system maintain consistency when events are processed out of order or more than once?

---

## 2. Event Catalog

Include in `04-data-architecture.md` as the primary section for event-driven systems. Every event type gets an entry:

| Event | Topic / Queue | Schema | Publisher | Consumer(s) | Ordering | Retention | DLQ |
|---|---|---|---|---|---|---|---|
| `<EventName>` | `<topic-name>` | `<schema-ref or inline>` | `<service>` | `<service-list>` | `<key or none>` | `<duration>` | `<dlq-name or none>` |

**Ordering column values:**
- `Partitioned by <key>` — events with the same key are ordered; different keys are not
- `None` — no ordering guarantees (SQS standard, SNS without FIFO)
- `FIFO` — strictly ordered (SQS FIFO, Kafka single-partition)

**Schema column:**
- Reference the schema file if it exists: `schemas/order-created.avro`
- Reference a schema registry if used: `Schema Registry: <registry-name>, subject: <subject-name>`
- Inline a minimal example if the schema is not formally defined

---

## 3. Event Schema Standards

Include in `06-cross-cutting-concerns.md`:

Document the schema standard in use:

```
Event schema format: JSON / Avro / Protobuf / CloudEvents

CloudEvents compliance: YES / NO
  If YES — envelope fields: id, source, type, time, datacontenttype, subject
  Reference: https://cloudevents.io

Schema evolution policy:
  Additive changes only (new optional fields): safe to deploy without coordination
  Breaking changes (rename, remove, type change): requires consumer migration plan
  
Schema registry: <REGISTRY_NAME or NONE>
  If present: all schemas registered before first publish; compatibility mode: <BACKWARD / FORWARD / FULL>
```

---

## 4. Consumer Patterns

Include in `02-container-architecture.md`:

**Competing consumers (work queue):**
Multiple instances of the same consumer type each process a different message. Used for: load distribution, parallel processing.
```
Pattern: Competing consumers
  Queue: <queue-name>
  Consumer: <service-name>
  Concurrency: <N> instances
  Use case: <why competing consumers, not pub/sub>
```

**Fan-out (pub/sub):**
A single event is delivered to all subscribers independently. Used for: notifying multiple services of a domain event.
```
Pattern: Pub/sub fan-out
  Topic: <topic-name>
  Publisher: <service>
  Subscribers: [<service-1>, <service-2>, ...]
  Independence: subscriber failures are isolated — one failure does not block others
```

---

## 5. Idempotency Requirements

Include in `06-cross-cutting-concerns.md`:

Every event consumer that performs a non-idempotent operation (writes to a database, calls an external API, sends an email) must document its idempotency strategy.

```
Idempotency strategy:
  Consumer: <service / function>
  Operation: <what it does>
  Idempotency key: <event field used as deduplication key>
  Storage: <where duplicate keys are tracked: DB table, Redis, etc.>
  TTL: <how long deduplication window is maintained>
```

**Why this matters:** At-least-once delivery guarantees mean every consumer will receive the same message more than once at some point. Without idempotency, this causes duplicate writes, duplicate charges, duplicate emails.

**Exactly-once semantics:**
Document if exactly-once semantics are required and how they are achieved:
- Kafka transactions (Kafka only, producer and consumer in same cluster)
- Outbox pattern (database write + event publish in same transaction)
- Idempotency at the consumer level (deduplication key)

---

## 6. Event Replay

Include in `05-deployment.md` (operational concerns):

```
Event replay:
  Supported: YES / NO
  Platform: <Kafka (offset reset) / EventBridge Archive / SQS replay from S3 / Custom>
  Retention window: <duration — how far back can you replay>
  Replay trigger: <manual / automated / on-deployment>
  
  Replay safety:
    Consumers designed to be idempotent: YES / NO
    External side effects suppressed during replay: YES / NO (e.g., no emails sent)
    Risk: <what could go wrong if replay is triggered in production>
```

---

## 7. Outbox Pattern

If the codebase shows signals of transactional event publishing (common in event-driven microservices), document the pattern:

Include in `06-cross-cutting-concerns.md`:

```
Outbox pattern: PRESENT / NOT PRESENT

If PRESENT:
  Purpose: Ensures a database write and an event publish are atomic — prevents
           the "wrote to DB but failed to publish event" split-brain scenario
  
  Implementation:
    - <service-name> writes domain events to an outbox table in the same DB transaction
    - A relay process (CDC / polling) reads the outbox and publishes to <topic>
    - Relay: <CDC tool (Debezium) / polling worker / Kafka Connect>
  
  Outbox table: <table-name> in <database>
```

---

## 8. Event Sourcing

If the codebase shows event sourcing signals (EventStore, event sourcing libraries, append-only event log):

Include as a sub-section of `04-data-architecture.md`:

```
Event sourcing: PRESENT / NOT PRESENT

If PRESENT:
  Aggregates: <list of domain aggregates using event sourcing>
  Event store: <EventStoreDB / custom append-only table / Kafka as source of truth>
  
  Projection strategy:
    Read models: <list of projections / read models maintained>
    Projection rebuild: <how projections are rebuilt from the event log>
    Projection lag: <acceptable lag between event and projection update>
  
  Snapshot strategy:
    Snapshots used: YES / NO
    Frequency: every <N> events or every <duration>
```

---

## 9. Common Event-Driven Risks to Pre-Populate in `09-risks-and-debt.md`

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Event ordering loss — consumers process events out of order | High | Medium–High | Use partition key for ordering-sensitive events; design consumers to be order-independent where possible |
| Consumer lag and back-pressure — consumers cannot keep up with producer rate | Medium | High | Consumer concurrency limits; lag alerting; back-pressure signalling |
| Poison pill messages — malformed events cause consumer to fail repeatedly | Medium | High | Dead-letter queue with alert; schema validation before processing |
| Schema evolution breaks consumers — producer changes schema without coordination | Medium | High | Schema registry with backward-compatibility enforcement; additive-only policy |
| No idempotency — at-least-once delivery causes duplicate processing | Medium | High | Idempotency keys with deduplication storage per consumer |
| Silent consumer failure — consumer throws, DLQ fills, no alert | Medium | High | Alert on DLQ depth > 0 for all critical queues |
| Debugging difficulty — no correlation IDs across events | Medium | Medium | Propagate correlation ID / trace ID as event header field |
| Event replay causes unintended side effects | Low | High | Test replay in staging; suppress external side effects (email, payment) during replay |
