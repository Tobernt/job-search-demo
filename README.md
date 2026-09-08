# Job Search Demo

A Swedish job-search application built with Next.js, TypeScript and React. The repository contains four invented listings and starts locally without API keys or a database server.

Search by role or location, filter by work mode, save jobs and searches in the browser, and open individual job pages. The application also includes parameterized PostgreSQL data access, report validation and search-response caching.

## Run

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open localhost on port 3000. Demo listings have no real employer or application destination. Maps and advertising are disabled.

## Check

```sh
npm run test:search
npm run test:ads
npm run build
```

Tests cover search intent and advertising eligibility rules. The production build checks TypeScript and generates the application. CI runs the same checks and a credential scan.

## Code guide

- `src/components/JobSearchApp.tsx`: search UI and browser state.
- `src/app/api/search/route.ts`: filtering, pagination and response caching.
- `src/app/api/report/route.ts`: input validation, duplicate reports and rate limits.
- `src/lib/db.ts`: PostgreSQL pooling and parameterized statements.
- `src/lib/jobtech.ts`: optional import adapter and classification.
- `data/jobs.json`: invented demo fixtures.

## Configuration

No environment file is needed for the demo, and no environment files are tracked. Optional integrations read configuration from the runtime environment. `DATABASE_URL` enables PostgreSQL; `PUBLIC_SITE_URL` overrides the placeholder site origin. External import adapters require explicitly configured `JOBSEARCH_API_URL` and `JOBSTREAM_API_URL` values. Payment and webhook integrations remain unconfigured.

This standalone source snapshot has fresh Git history. Operational exports, original listings, sponsor configuration, analytics query data, production branding, account identifiers, deployment files and private configuration are excluded. Public dependency metadata, schema identifiers and geographic reference data remain. It is a Next.js/PostgreSQL example, not an ASP.NET or SQL Server application.
