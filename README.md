# AEVO — Premium Computing E-commerce

A full-stack e-commerce website for computers and PC components, built with Node.js, Express.js, Next.js, and PostgreSQL.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (JavaScript) |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Express.js |
| Database | PostgreSQL + Prisma ORM |
| Realtime | Socket.IO |
| Cache | Redis |
| Container | Docker Compose |

## Project Structure

```
aevo/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Express.js backend
├── docker/           # Dockerfiles
├── docker-compose.yml
└── package.json
```

## Getting Started

### Option 1: Docker Compose (Recommended)

```bash
# Clone the project
cd aevo

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
```

### Option 2: Local Development

```bash
# Install dependencies
npm install
cd apps/web && npm install
cd ../api && npm install

# Set up database
cd apps/api
cp .env.example .env
# Edit .env with your database URL

npm run db:generate
npm run db:push

# Start development servers
npm run dev
```

## Features

### Customer Features
- Landing page with New Products, Best Sellers, and 3+ categories
- Product catalog with search, filter, sort, pagination
- Product details with variants and independent inventory
- Shopping cart (real-time updates without reload)
- Multi-step checkout with guest checkout
- Discount codes (5 chars, max 10 uses)
- Order tracking with status history
- Loyalty points system (10% of order = points)
- Social media authentication (Google, Facebook)
- Profile management with multiple addresses

### Admin Features
- Simple Dashboard (KPIs, best sellers)
- Advanced Dashboard (revenue, orders, profit by time period)
- Product management with variants
- User management (view, ban/unban)
- Order management (view, update status)
- Discount code management

## Environment Variables

### API (.env)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aevo
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=3001
CLIENT_URL=http://localhost:3000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Default Admin Account

- Email: admin@aevo.com
- Password: admin123

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| web | 3000 | Next.js frontend |
| api | 3001 | Express.js API |
| db | 5432 | PostgreSQL |
| redis | 6379 | Redis cache |

## Scripts

```bash
# Development
npm run dev          # Start all services
npm run dev:web      # Frontend only
npm run dev:api      # Backend only

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to DB
npm run db:seed      # Seed demo data

# Docker
npm run docker:up    # Start containers
npm run docker:down  # Stop containers
```

## Notes

- Only sells computers and PC components (no phones or other products)
- Uses JavaScript (not TypeScript) as per course requirements
- Admin panel limited to allowed features only
- Pagination always shown, even with single page

## License

MIT
