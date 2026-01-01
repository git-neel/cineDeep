# CineDeep - Movie Insights & Analytics

## Overview

CineDeep is a movie discovery and analytics platform that provides deep insights, financial analytics, and hidden meanings for movies and TV shows. The application integrates with The Movie Database (TMDB) API for content data and OpenAI for generating AI-powered insights about films. Users can also participate in threaded discussions about movies after signing in with email.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- Added email-based authentication (magic link/OTP style, no passwords)
- Added threaded discussion system for each movie with upvoting
- Added "X users online" presence indicator
- Auto-refresh polling for discussions (every 5 seconds)
- User session management stored in localStorage

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **UI Components**: shadcn/ui component library (New York style) with Radix UI primitives
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with custom plugins for Replit integration
- **Authentication**: Custom auth context with session-based auth

The frontend follows a page-based architecture with three main routes:
- Home page with search functionality
- Search results page displaying movie/show cards
- Movie detail page with insights generation and discussions

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ESM modules
- **Development**: tsx for TypeScript execution
- **Production Build**: esbuild bundling with Vite for client assets
- **Authentication**: Session-based auth with token verification

The server handles:
- API proxy routes for TMDB integration
- AI insights generation via OpenAI
- User authentication (email OTP/magic link)
- Discussion system (topics, posts, votes)
- Static file serving in production
- Vite dev server middleware in development

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains table definitions
- **Database Tables**:
  - `users`: User accounts (id, email, displayName, phone, timestamps)
  - `auth_tokens`: Magic link/OTP tokens for authentication
  - `sessions`: User session management for presence tracking
  - `discussion_topics`: Discussion topics tied to TMDB IDs
  - `discussion_posts`: Threaded posts with parent references
  - `post_votes`: Upvotes on posts
  - `conversations`, `messages`: Chat/AI features (legacy)
- **Storage Interface**: `IStorage` interface in `server/storage.ts`

### Authentication Flow
1. User enters email and requests login
2. Server creates auth token (15 min expiry), returns token (dev mode shows in response)
3. User verifies token, server creates session
4. Session ID stored in localStorage, sent via `x-session-id` header
5. New users prompted to enter display name

### Discussion System
- Topics are tied to TMDB ID and media type
- Posts support threading with parent post references
- Depth limited to 3 levels for readability
- Upvoting with optimistic UI updates
- Auto-refresh via React Query polling (5s intervals)
- Presence indicator shows active users (based on session activity)

### External API Integration
- **TMDB API**: Movie and TV show data (search, details, credits)
- **OpenAI API**: AI-powered insights generation using Replit AI Integrations
- **Email**: Email integration dismissed by user - tokens shown in response for dev mode

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/  # UI components (shadcn/ui + custom)
│   │   │   ├── LoginModal.tsx    # Email auth modal
│   │   │   ├── Discussion.tsx    # Discussion UI components
│   │   │   └── ui/               # shadcn/ui components
│   │   ├── pages/       # Route pages
│   │   ├── hooks/       # Custom React hooks
│   │   │   └── useAuth.tsx       # Auth context and hook
│   │   └── lib/         # Utilities and API client
│   │       └── api.ts            # All API functions
├── server/           # Express backend
│   ├── routes.ts     # API route handlers (auth, topics, posts, votes)
│   ├── storage.ts    # Database storage implementation
│   ├── db.ts         # Drizzle database connection
│   └── replit_integrations/  # AI and batch processing utilities
├── shared/           # Shared code between client/server
│   └── schema.ts     # Drizzle database schema
└── migrations/       # Database migrations
```

### API Endpoints
**Authentication:**
- `POST /api/auth/request-login` - Request login token
- `POST /api/auth/verify` - Verify token, create session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Revoke session

**Discussions:**
- `GET /api/topics?tmdbId=X&mediaType=Y` - Get topics for a movie
- `POST /api/topics` - Create new topic (auth required)
- `GET /api/topics/:topicId` - Get topic with posts
- `POST /api/topics/:topicId/posts` - Create post (auth required)
- `POST /api/posts/:postId/vote` - Toggle vote (auth required)
- `GET /api/presence?tmdbId=X` - Get active user count

### Build System
- Development: Vite dev server with HMR, proxied through Express
- Production: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Path aliases: `@/` for client source, `@shared/` for shared modules

## External Dependencies

### APIs and Services
- **TMDB API** (`TMDB_API_KEY`): Movie database for search and content details
- **OpenAI via Replit AI Integrations** (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`): AI-powered content analysis and insights
- **PostgreSQL** (`DATABASE_URL`): Primary database for persistent storage

### Key NPM Dependencies
- `drizzle-orm` + `drizzle-kit`: Database ORM and migrations
- `@tanstack/react-query`: Data fetching and caching
- `framer-motion`: Animation library
- `wouter`: Client-side routing
- `date-fns`: Date formatting for discussions
- Radix UI primitives: Accessible UI components
- `openai`: OpenAI API client
