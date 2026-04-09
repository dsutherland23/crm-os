# CRM OS — Composable Modular Business Platform

A production-ready, AI-native CRM + ERP + POS platform with a LEGO-style modular architecture.
Every business feature is a toggleable module.

## Architecture

```
CORE SYSTEM
│
├── CRM MODULE          (customer profiles, loyalty, CLV)
├── POS MODULE          (offline-first, idempotent sync)
├── INVENTORY MODULE    (real-time, multi-location)
├── PRODUCTS MODULE     (variants, barcodes, categories)
├── FINANCE MODULE      (double-entry accounting, invoices)
├── OPERATIONS MODULE   (transfers, returns, approvals)
├── PRICING MODULE      (dynamic rules, tiers, promos)
├── ANALYTICS MODULE    (dashboards, KPIs, top products)
├── BRANDING MODULE     (white-label, custom templates)
│
├── AI LAYER            (agents: sales, finance, inventory)
├── EVENT BUS           (pub/sub + transactional outbox)
├── FEATURE TOGGLES     (tenant / role / user level)
│
└── API GATEWAY         (JWT + RBAC + ABAC guards)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS (Fastify) + TypeScript |
| Frontend | Next.js 14 App Router + Tailwind CSS |
| Database | PostgreSQL (Supabase) + Drizzle ORM |
| Auth | JWT (RS256) + Supabase Auth |
| Queue | BullMQ (Redis) |
| AI | OpenAI GPT-4o / Anthropic Claude |
| Payments | Stripe |
| Deployment | Vercel (web) + Render (API) + Supabase (DB) |

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Fill in your Supabase, JWT, Stripe, Redis credentials

# Start development
pnpm dev

# API: http://localhost:3001
# Web: http://localhost:3000
# Swagger: http://localhost:3001/api/docs
```

## Module Feature Flags

Each module can be toggled per tenant, role, or user:

```json
{
  "module": "finance",
  "enabled": true,
  "enabledForRoles": ["admin", "accountant"],
  "dependencies": ["core"]
}
```

## Security

- JWT (RS256) with 15-minute access tokens + rotating refresh tokens
- Row-Level Security (RLS) on all PostgreSQL tables
- RBAC + ABAC enforced at guard level (never only on frontend)
- GDPR compliance: right to access (`GET /gdpr/export/:id`) + right to erasure (`DELETE /gdpr/erase/:id`)
- Immutable audit logs (DB-level append-only enforcement)
- Double-entry accounting enforced at service layer + DB trigger
- PII encrypted at application layer (AES-256-GCM)
- Webhook signatures verified (HMAC-SHA256 + replay protection)

## Module Status

| Module | Status |
|--------|--------|
| Core Engine | Ready |
| Products | Ready |
| Inventory | Ready |
| CRM | Ready |
| Finance | Ready |
| POS (offline-first) | Ready |
| Pricing Engine | Ready |
| Analytics | Ready |
| Operations | Stub (returns/transfers) |
| Branding | Ready |
| AI Layer | Scaffold ready |
| Billing (Stripe) | Stub — wire Stripe SDK |
| Notifications | Stub — wire SMTP + WhatsApp |
| GDPR | Ready |
