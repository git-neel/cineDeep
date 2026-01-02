# Cine-Seeker: Development Quick Start Guide

## Project Overview

**Cine-Seeker** is a full-stack web application for discovering and discussing movies/TV shows with AI-powered insights and a Reddit-style discussion platform.

**Tech Stack:**
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Express.js + Node.js + PostgreSQL
- **ORM:** Drizzle
- **APIs:** TMDB (movies), OpenAI (insights)
- **Styling:** Tailwind CSS

**Current Status:** 
- ✅ Core movie search/discovery working
- ✅ API caching system (80-90% cost savings)
- ✅ AI insights generation with rate limiting
- ⏳ Discussion platform (designed, ready to implement)
- ⏳ Email verification & subscriptions (planned)

---

## Getting Started

### Prerequisites

- Node.js 20.10.0+
- PostgreSQL 14+
- npm or yarn

### Setup Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/git-neel/cineDeep.git
   cd cineDeep
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   
   # Edit .env.local with:
   # - TMDB_API_KEY: Get from themoviedb.org
   # - OPENAI_API_KEY: Get from openai.com
   # - DATABASE_URL: postgresql://user:password@localhost/cine-seeker
   ```

4. **Create database:**
   ```bash
   createdb cine-seeker
   ```

5. **Run migrations:**
   ```bash
   DATABASE_URL="postgresql://localhost/cine-seeker" npm run db:push
   ```

6. **Start the development server:**
   ```bash
   npm run start
   ```

   Server runs on `http://localhost:3000`

---

## Project Structure

```
cine-seeker/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/            # Page components (Home, MovieDetail, etc)
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/              # Utilities (api client, queries, etc)
│   └── index.html
│
├── server/                    # Express backend
│   ├── index.ts              # Main server entry point
│   ├── routes.ts             # API route definitions
│   ├── db.ts                 # Database connection
│   ├── cache.ts              # Caching utilities
│   ├── storage.ts            # File storage logic
│   └── routes/               # Route handlers (discussions, etc)
│
├── shared/                    # Shared code
│   └── schema.ts             # Drizzle database schema
│
├── script/
│   └── build.ts              # Build script
│
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
└── DISCUSSION_DESIGN.md       # Discussion platform design docs
```

---

## Key Files & Their Purpose

| File | Purpose |
|------|---------|
| `server/routes.ts` | Main API endpoints (search, detail, insights) |
| `server/cache.ts` | Caching layer for TMDB & OpenAI responses |
| `shared/schema.ts` | Database schema definitions |
| `client/src/pages/MovieDetail.tsx` | Movie detail page with insights |
| `client/src/lib/api.ts` | Frontend API client |
| `client/src/hooks/useAuth.tsx` | Authentication hook |

---

## Common Development Tasks

### Running the Application

```bash
# Development mode (hot reload)
npm run start

# Build for production
npm run build

# Preview production build
npm run preview
```

### Working with the Database

```bash
# Generate migration after schema changes
npm run db:generate

# Apply migrations
npm run db:push

# View database
psql cine-seeker

# Drop and recreate (⚠️ loses all data)
dropdb cine-seeker
createdb cine-seeker
npm run db:push
```

### Testing API Endpoints

```bash
# Test movie search
curl 'http://localhost:3000/api/search?query=Inception'

# Test movie detail with insights
curl 'http://localhost:3000/api/title/movie/550'

# Generate insights (POST request)
curl -X POST 'http://localhost:3000/api/title/movie/550/insights' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Fight Club","synopsis":"..."}'

# Check cache hit
curl 'http://localhost:3000/api/title/movie/550'
# Watch server logs for "[CACHE HIT]" message
```

---

## Architecture Overview

### API Flow

```
User Request
    ↓
Frontend (React)
    ↓
Express Server
    ├─→ Check database cache
    │    ├─→ Found: Return cached data ✅
    │    └─→ Not found: Fetch from TMDB
    ├─→ Cache in database (30-day TTL)
    └─→ Return to frontend

Insights Generation
    ↓
User clicks "Generate Insights"
    ├─→ Check rate limit (5/day per user)
    ├─→ Check insights cache (90-day TTL)
    ├─→ Call OpenAI API if needed
    ├─→ Cache result
    └─→ Return to frontend
```

### Database Schema

**Main Tables:**
- `users` - User accounts & authentication
- `tmdb_cache` - TMDB API responses (30-day TTL)
- `insights_cache` - OpenAI insights (90-day TTL)
- `user_insight_quota` - Daily insight limit tracking

**Future Tables (Discussion Platform):**
- `discussion_topics` - Discussion categories
- `movie_discussions` - Links movies to discussions
- `discussion_posts` - User posts
- `discussion_replies` - Comments (max 2 levels)
- `reply_votes` - Like/dislike system

---

## Cost Optimization Features

### Caching Strategy
- **TMDB API**: Cache all responses for 30 days
- **OpenAI API**: Cache insights for 90 days
- **Result**: 80-90% cost savings after first 24 hours

### Rate Limiting
- **Free users**: 5 AI insights/day
- **Premium users** (future): Unlimited (via Stripe subscription)

### Implementation
See [COST_SAVINGS_SUMMARY.md](COST_SAVINGS_SUMMARY.md) for detailed metrics.

---

## Authentication

Currently using session-based auth via cookies.

**Future (Planned):**
- Email verification required before posting
- OAuth integration (GitHub, Google)
- User profiles with comment history

---

## AI Insights Generation

**How it works:**
1. User clicks "Generate Insights" on movie detail page
2. Frontend calls `POST /api/title/:type/:id/insights`
3. Backend checks:
   - User's daily quota (5 remaining?)
   - If insights already cached (90-day TTL)
4. If not cached:
   - Calls OpenAI API with optimized prompt
   - Caches result with movie metadata
   - Decrements user's daily quota
5. Returns insights to frontend

**Cost:** ~$0.001 per request with OpenAI's gpt-3.5-turbo

---

## Debugging Tips

### Check if caching is working
```bash
# First request (should be slow, ~8 seconds)
curl 'http://localhost:3000/api/title/movie/550' > /dev/null

# Second request (should be fast, <1 second)
curl 'http://localhost:3000/api/title/movie/550' > /dev/null

# Watch server logs for:
# ✓ "[CACHE HIT]" on second request
# ✓ "Fetching from TMDB" on first request
```

### Check database connections
```bash
psql cine-seeker
# Should connect successfully

# View all tables:
\dt

# View cache tables:
SELECT * FROM tmdb_cache LIMIT 1;
SELECT * FROM insights_cache LIMIT 1;
```

### View API response times
```bash
# Using curl with timing
curl -w '\nTime: %{time_total}s\n' 'http://localhost:3000/api/title/movie/550'
```

---

## Contributing Guidelines

### Making Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and test:**
   ```bash
   npm run start    # Test locally
   npm run build    # Check for build errors
   ```

3. **Commit with clear messages:**
   ```bash
   git commit -m "feat: add new feature description"
   ```

4. **Push and create PR:**
   ```bash
   git push origin feature/my-feature
   ```

### Commit Message Convention

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `perf:` - Performance improvement

---

## Next Steps / Implementation Phases

**Phase 1 (Next - 2-3 hours):**
- Set up discussion platform database schema
- Run migrations

**Phase 2 (6-8 hours):**
- Implement discussion API endpoints
- Handle automatic reply flattening

**Phase 3 (8-10 hours):**
- Create React components for discussions
- Integrate with movie detail page

**Phase 4 (4-6 hours):**
- Add styling
- Test and deploy

See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for detailed steps.

---

## Deployment

### Environment Variables for Production

```env
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://...  # Production PostgreSQL (e.g., Railway, Neon)
TMDB_API_KEY=...
OPENAI_API_KEY=...
```

### Deploy to Production

```bash
# Build optimized bundle
npm run build

# Deploy compiled server and client
# Option 1: Railway (recommended)
railway deploy

# Option 2: Heroku
git push heroku main
```

See detailed guides:
- Railway: https://railway.app/docs
- Heroku: https://devcenter.heroku.com/articles/nodejs

---

## Helpful Resources

- **TMDB API:** https://developer.themoviedb.org/
- **OpenAI API:** https://platform.openai.com/docs/
- **Drizzle ORM:** https://orm.drizzle.team/
- **React Docs:** https://react.dev/
- **TypeScript:** https://www.typescriptlang.org/docs/

---

## Questions or Issues?

Check these resources in order:
1. **Documentation:** README.md, DISCUSSION_DESIGN.md, IMPLEMENTATION_GUIDE.md
2. **Code comments:** Look at similar functions
3. **Server logs:** Check terminal output for errors
4. **Database logs:** Check PostgreSQL logs
5. **API testing:** Use curl or Postman to isolate issues

---

## Quick Ref: Most Used Commands

```bash
# Start development server
npm run start

# Build for production
npm run build

# Run database migration
npm run db:push

# View database
psql cine-seeker

# Run all tests (future)
npm test

# Format code
npm run format

# Type check
npm run type-check
```

---

**Last Updated:** January 2025
**Maintainers:** git-neel

Happy coding! 🚀 🎬
