# Bank API

**Author:** Avinoam Sebbah  
**Repository:** https://github.com/AvinoamSebbah/BankApi.git

A RESTful API for banking operations built with Node.js, TypeScript, Express.js, and PostgreSQL. This API provides comprehensive banking functionality including customer management, account operations, and money transfers with idempotency support.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/AvinoamSebbah/BankApi.git
cd BankApi

# Start with Docker (Recommended)
docker-compose up --build

# Access the API
# - API: http://localhost:3001
# - Swagger Docs: http://localhost:3001/docs
```

## 🏗️ Architecture

- **Backend Framework:** Express.js with TypeScript
- **Database:** PostgreSQL 15 with Prisma ORM
- **API Documentation:** Swagger/OpenAPI 3.0
- **Containerization:** Docker & Docker Compose
- **Validation:** Zod schemas
- **Logging:** Pino structured logging
- **Error Handling:** Custom HTTP error classes

## 🚀 Features

- **Customer Management:** Create and retrieve customer information
- **Account Operations:** Create accounts, check balances, retrieve account details
- **Money Transfers:** Transfer funds between accounts with idempotency support
- **API Documentation:** Interactive Swagger UI
- **Error Handling:** Proper HTTP status codes and error messages
- **Request Logging:** Structured logging with request/response tracking
- **Data Validation:** Schema-based request validation
- **Database Migrations:** Version-controlled database schema management

## 📋 Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15 (via Docker)

## 🔧 Development Setup (A to Z)

### 1. Clone the Repository

```bash
# Clone the project
git clone https://github.com/AvinoamSebbah/BankApi.git
cd BankApi

# Install dependencies
npm install
```

### 2. Environment Setup

The application uses the following environment configuration (defined in `src/config/env.ts`):

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/bank_db
```

### 3. Database Setup

```bash
# Start PostgreSQL database
docker-compose up -d db

# Wait for database to be ready (about 5-10 seconds)

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database with sample data
npx prisma db seed
```

### 4. Start Development Server

```bash
# Start the development server with hot reload
npm run dev

# Server will be available at:
# - API: http://localhost:3000
# - Swagger Docs: http://localhost:3000/docs
```

## 🐳 Docker Deployment

### Build and Run with Docker Compose

```bash
# Build and start all services (database + API)
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build

# The API will be available at:
# - API: http://localhost:3001
# - Swagger Docs: http://localhost:3001/docs
```

### Docker Services

- **Database Service:** PostgreSQL 15 container
- **API Service:** Node.js application container
- **Automatic Migration:** Database migrations run on container startup
- **Automatic Seeding:** Sample data populated on first run

### Docker Commands

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs api
docker-compose logs db

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose down
docker-compose up --build --no-cache
```

## 📚 Swagger Documentation

The API includes comprehensive Swagger/OpenAPI 3.0 documentation accessible at:

- **Development:** http://localhost:3000/docs
- **Docker:** http://localhost:3001/docs

### Swagger Features

- **Interactive API Testing:** Test all endpoints directly from the browser
- **Schema Documentation:** Complete request/response schemas
- **Authentication Support:** API key authentication ready
- **Examples:** Sample requests and responses for each endpoint
- **Error Responses:** Documented error codes and messages

### API Endpoints

The endpoint list below is **generated** from the `@openapi` annotations in the
source — see [`docs/api-reference.md`](./docs/api-reference.md) for the full
reference with parameters, request bodies, responses and examples, and
[`docs/openapi.json`](./docs/openapi.json) for the machine readable spec.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/healthz` | Health check |
| `POST` | `/customers` | Create a new customer |
| `POST` | `/accounts` | Create a new bank account |
| `GET` | `/accounts/{id}/balance` | Get account balance |
| `GET` | `/accounts/{id}/transactions` | Get paginated transfer history |
| `POST` | `/transfers` | Transfer money between accounts |

## 🔄 Automated Documentation Sync

The committed API documentation is generated from the source and verified in
CI, so it cannot silently drift away from the code.

```bash
# Regenerate docs/openapi.json and docs/api-reference.md
npm run docs:sync

# Verify without writing; exits non-zero when the docs are wrong
npm run docs:check

# The full CI gate: build + lint + test + docs:check
npm run verify
```

Never edit the files under `docs/` by hand — they are overwritten on the next
sync.

### What the check enforces

| Failure | Meaning | How to fix |
| --- | --- | --- |
| `DOCUMENTATION_DRIFT` | A route is registered with no `@openapi` annotation. | Add the annotation. Regenerating will not help. |
| `DOCUMENTATION_STALE` | Annotations changed but the artefacts were not regenerated. | Run `npm run docs:sync` and commit `docs/`. |
| `SOURCE_NOT_FOUND` | The routes directory could not be read. | Restore the path. |

It also reports *orphaned* operations — documentation left behind after a route
was deleted.

### Adding an endpoint

1. Register the route with an `@openapi` block above it, using the full path as
   the client sees it (`/accounts/{id}/balance`, not `/:id/balance`).
2. Run `npm run docs:sync`.
3. Commit the source change together with the regenerated `docs/` files.

### Optional pre-commit hook

Catch drift before it reaches CI:

```bash
git config core.hooksPath .githooks
```

## 🗄️ Prisma Database Management

### Prisma Overview

Prisma is our Object-Relational Mapping (ORM) tool that provides:

- **Type-Safe Database Access:** Auto-generated TypeScript types
- **Migration Management:** Version-controlled schema changes
- **Query Builder:** Intuitive database queries
- **Connection Pooling:** Efficient database connections

### Database Schema

```prisma
model Customer {
  id        Int       @id @default(autoincrement())
  firstName String
  lastName  String
  email     String    @unique
  createdAt DateTime  @default(now())
  accounts  Account[]
}

model Account {
  id         Int       @id @default(autoincrement())
  balance    Decimal   @default(0) @db.Decimal(10, 2)
  customerId Int
  customer   Customer  @relation(fields: [customerId], references: [id])
  createdAt  DateTime  @default(now())
  fromTransfers Transfer[] @relation("FromAccount")
  toTransfers   Transfer[] @relation("ToAccount")
}

model Transfer {
  id              String   @id @default(uuid())
  amount          Decimal  @db.Decimal(10, 2)
  fromAccountId   Int
  toAccountId     Int
  idempotencyKey  String   @unique
  createdAt       DateTime @default(now())
  fromAccount     Account  @relation("FromAccount", fields: [fromAccountId], references: [id])
  toAccount       Account  @relation("ToAccount", fields: [toAccountId], references: [id])
}
```

### Key Prisma Commands

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Seed database with sample data
npx prisma db seed

# Open Prisma Studio (GUI database browser)
npx prisma studio

# Reset database (development only)
npx prisma migrate reset
```

### Sample Data

The seed script creates:
- **8 Customers:** Alice Johnson, Bob Smith, Carol Williams, etc.
- **15 Accounts:** Various balances from $100 to $10,000
- **10 Transfers:** Sample transactions totaling $7,226.50

## 🔍 Key Technical Features

### Error Handling

Custom HTTP error classes for proper status codes:

```typescript
// 404 Not Found
throw notFound(`Account with id ${id} not found`);

// 400 Bad Request
throw badRequest('Insufficient funds for transfer');

// 500 Internal Server Error
throw internalServerError('Database connection failed');
```

### Request Validation

Zod schemas ensure data integrity:

```typescript
const createTransferSchema = z.object({
  amount: z.number().positive(),
  fromAccountId: z.number().int().positive(),
  toAccountId: z.number().int().positive(),
  idempotencyKey: z.string().uuid()
});
```

### Idempotency

Transfer operations support idempotency keys to prevent duplicate transactions:

```typescript
// Same idempotency key returns existing transfer
POST /transfers
{
  "amount": 100.00,
  "fromAccountId": 1,
  "toAccountId": 2,
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Structured Logging

Pino provides structured JSON logging:

```typescript
// Request/response logging
{"level":30,"time":1757021155796,"msg":"request completed","statusCode":200}

// Error logging
{"level":50,"err":{"type":"HttpError","message":"Account not found","status":404}}
```

## 🛠️ Development Workflow

1. **Code Changes:** Edit TypeScript files in `src/`
2. **Hot Reload:** `tsx watch` automatically restarts server
3. **Database Changes:** Update `prisma/schema.prisma` and run migrations
4. **API Testing:** Use Swagger UI or tools like Postman
5. **Documentation:** Run `npm run docs:sync` after changing any route, and commit the regenerated `docs/` files
6. **Error Checking:** Monitor logs for proper error handling
7. **Verification:** Run `npm run verify` before pushing — this is the same gate CI runs
8. **Docker Testing:** Test in containerized environment before deployment

## 📁 Project Structure

```
bank-api/
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── routes/          # API route definitions
│   ├── middlewares/     # Custom middleware
│   ├── schemas/         # Zod validation schemas
│   ├── config/          # Environment and logging config
│   ├── libs/            # Utility functions
│   ├── docs/            # Documentation sync pipeline
│   ├── scripts/         # docs:sync / docs:check CLI
│   └── swagger/         # Runtime Swagger UI mount
├── docs/                # GENERATED: openapi.json + api-reference.md
├── tests/               # Vitest unit and integration tests
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── seed.ts          # Sample data script
│   └── migrations/      # Database migration files
├── .github/             # CI workflow and Copilot customisations
├── .githooks/           # Optional pre-commit documentation check
├── scripts/             # Docker and deployment scripts
├── docker-compose.yml   # Multi-service container config
├── Dockerfile           # Application container definition
└── package.json         # Dependencies and scripts
```

This API provides a solid foundation for banking operations with proper error handling, documentation, and scalability considerations.
