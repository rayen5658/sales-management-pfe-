# TODO (refactor plan)

## Backend
- [ ] Create domain controllers under `backend/controllers/` (products, categories, clients, orders, users+dashboard/auth)
- [ ] Move shared helpers (validation/errors/auditLog/TVA_RATE) into `backend/controllers/shared.js` (or inline per file)
- [ ] Add `backend/controllers/index.js` re-exporting all controller functions expected by `backend/routes.js`
- [ ] Turn `backend/controllers.js` into a thin re-export/delegator (to avoid breaking existing imports)

## Migrations
- [ ] Rename duplicate migration files in `backend/migrations/` to unique ordering numbers
- [ ] Add a migration runner config (node-pg-migrate) + npm scripts in `backend/package.json`
- [ ] Verify migration runner works with existing SQL (idempotency / seeding conflicts)

## Chatbot / dependencies
- [ ] Activate Gemini route by uncommenting in `backend/routes.js`
- [ ] Keep `@google/generative-ai` dependency (already installed)
- [ ] Optionally remove `openai` if unused after code check

