# CineDeep - Movie Insights & Analytics

## Overview

CineDeep is a movie discovery and analytics platform that provides deep insights, financial analytics, and hidden meanings for movies and TV shows. The application integrates with The Movie Database (TMDB) API for content data and OpenAI for generating AI-powered insights about films.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **UI Components**: shadcn/ui component library (New York style) with Radix UI primitives
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a page-based architecture with three main routes:
- Home page with search functionality
- Search results page displaying movie/show cards
- Movie detail page with insights generation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ESM modules
- **Development**: tsx for TypeScript execution
- **Production Build**: esbuild bundling with Vite for client assets

The server handles:
- API proxy routes for TMDB integration
- AI insights generation via OpenAI
- Static file serving in production
- Vite dev server middleware in development

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains table definitions
- **Current Tables**: Users, Conversations, Messages (for chat/AI features)
- **Storage Interface**: Abstracted via `IStorage` interface with in-memory implementation available

### External API Integration
- **TMDB API**: Movie and TV show data (search, details, credits)
- **OpenAI API**: AI-powered insights generation using Replit AI Integrations
- **Image Generation**: Optional gpt-image-1 model integration for AI images

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/  # UI components (shadcn/ui)
│   │   ├── pages/       # Route pages
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities and API client
├── server/           # Express backend
│   ├── routes.ts     # API route handlers
│   ├── storage.ts    # Data storage abstraction
│   └── replit_integrations/  # AI and batch processing utilities
├── shared/           # Shared code between client/server
│   └── schema.ts     # Drizzle database schema
└── migrations/       # Database migrations
```

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
- Radix UI primitives: Accessible UI components
- `openai`: OpenAI API client