# AI Agent Instructions

## Project Knowledge

This project maintains a private knowledge base in:

`./brain/`

The `brain/` directory is intentionally **NOT** committed to Git.

Before significant implementation work, inspect the relevant files in `./brain/`.

## Knowledge Priority

Use this priority:

1. Current approved requirements
2. Current architecture
3. Accepted architectural decisions
4. Technical specifications
5. Current development plan
6. Research
7. Conversation history
8. AI assumptions

Never treat an old conversation as a current requirement without verification.

## Selective Context Reading

Do not read the entire `brain/` directory on every task. Instead, selectively read only the relevant brain documents:

### Implementing webhook / queue
- `01_product/prd.md`
- `02_requirements/functional-requirements.md`
- `03_architecture/architecture.md`
- `04_technical/technical-spec.md`
- `05_data/webhook-contract.md`
- `06_security/security.md`
- `09_development/implementation-plan.md`
- `10_decisions/decision-log.md`

### Working on VPS / Deployment / Operations
- `00_context/constraints.md`
- `00_context/operator-standards.md`
- `03_architecture/architecture.md`
- `06_security/security.md`
- `07_operations/reliability.md`
- `07_operations/deployment.md`
- `09_development/implementation-plan.md`

### Debugging WhatsApp connection / Session
- `00_context/project-context.md`
- `03_architecture/architecture.md`
- `07_operations/reliability.md`
- `12_research/whatsapp/*`
- `11_conversations/troubleshooting/*`

## Development Philosophy

Keep the system simple.

Initial deployment is a native Node.js application running directly on a VPS.

Docker is **NOT** part of the initial deployment.

Do not introduce Docker unless explicitly requested.

Do not introduce PostgreSQL, Redis, Kubernetes, or other infrastructure unless there is a documented requirement for it.

## Current Architecture

WhatsApp
→ Collector (Node.js/TypeScript)
→ SQLite durable queue
→ Webhook Worker
→ Client Webhook (HTTPS)

## Reliability

A captured message must be persisted locally in SQLite before it is considered safely accepted.

Webhook failures must not cause silent message loss (retry mechanism with backoff).

Temporary connection failures should recover automatically when possible.

Authentication/security challenges must require legitimate manual authentication rather than bypass mechanisms.

## Scope Boundaries

The collector does **NOT**:
- parse prices
- perform AI analysis
- manage products
- manage inventory
- own the client's database
- send WhatsApp messages
- provide SaaS functionality

## Coding Standards

Prefer:
- TypeScript (strict mode)
- Small, focused modules
- Clear, explicit interfaces
- Minimal external dependencies
- Testable code
- Explicit error handling

Avoid premature abstraction.

## Before Significant Changes

1. Inspect relevant brain documents.
2. Check existing architecture.
3. Check decision log (`10_decisions/decision-log.md`).
4. Check current implementation plan.
5. Identify conflicts.
6. Implement the smallest appropriate change.
7. Test it.
8. Update brain documentation if the project decision changed.

Never silently change architecture.
