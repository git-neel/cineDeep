import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import OpenAI from "openai";
import { storage } from "./storage";
import { z } from "zod";
import {
  getTMDBFromCache,
  cacheTMDBData,
  getInsightsFromCache,
  cacheInsights,
  checkInsightQuota,
  incrementInsightCount,
} from "./cache";

// Support both Replit AI Integrations and standard OpenAI API
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

// Auth middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const session = await storage.getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: "Invalid session" });
  }
  
  req.userId = session.userId;
  req.sessionId = sessionId;
  
  // Update session activity
  await storage.updateSessionActivity(sessionId);
  await storage.updateUserLastSeen(session.userId);
  
  next();
}

// Optional auth middleware (doesn't fail, just attaches user if present)
async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId) {
    const session = await storage.getSession(sessionId);
    if (session) {
      req.userId = session.userId;
      req.sessionId = sessionId;
      await storage.updateSessionActivity(sessionId);
      await storage.updateUserLastSeen(session.userId);
    }
  }
  next();
}

// Validation schemas
const requestLoginSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(50).optional(),
});

const createTopicSchema = z.object({
  tmdbId: z.number(),
  mediaType: z.enum(['movie', 'tv']),
  title: z.string(),
  prompt: z.string().min(5).max(500),
});

const createPostSchema = z.object({
  body: z.string().min(1).max(5000),
  parentPostId: z.string().optional(),
});

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple in-memory cache for insights
const insightsCache = new Map<string, any[]>();

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
}

interface TMDBMovieDetails {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  budget?: number;
  revenue?: number;
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
    }>;
  };
}

interface TMDBPersonCredits {
  cast: Array<{
    id: number;
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    media_type: string;
  }>;
}

async function fetchActorProjects(actorId: number): Promise<string[]> {
  try {
    const credits: TMDBPersonCredits = await fetchFromTMDB(`/person/${actorId}/combined_credits`);
    const now = new Date();
    const recentProjects = credits.cast
      .filter((item) => {
        const dateStr = item.release_date || item.first_air_date;
        if (!dateStr) return true; // Include items without dates (upcoming)
        const date = new Date(dateStr);
        return date >= new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      })
      .sort((a, b) => {
        const dateA = new Date(a.release_date || a.first_air_date || '9999');
        const dateB = new Date(b.release_date || b.first_air_date || '9999');
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 3)
      .map((item) => item.title || item.name || 'Untitled');
    return recentProjects;
  } catch {
    return [];
  }
}

async function generateInsightsForTitle(title: string, synopsis: string): Promise<any[]> {
  const cacheKey = `${title}`.toLowerCase();
  if (insightsCache.has(cacheKey)) {
    return insightsCache.get(cacheKey)!;
  }

  try {
    const prompt = `You are a film critic and cultural analyst. Analyze "${title}" and provide deep insights.

Return a JSON object with an "insights" array containing 4 insights with this exact structure:
{
  "insights": [
    {
      "type": "dialogue",
      "title": "A memorable quote from the movie",
      "description": "2-3 sentences explaining its deeper meaning or significance"
    },
    {
      "type": "metaphor",
      "title": "A visual or thematic metaphor",
      "description": "2-3 sentences explaining the symbolic meaning"
    },
    {
      "type": "easter-egg",
      "title": "A hidden detail or Easter egg",
      "description": "2-3 sentences explaining this hidden element"
    },
    {
      "type": "metaphor",
      "title": "Another symbolic element",
      "description": "2-3 sentences about its cultural or philosophical significance"
    }
  ]
}

${synopsis ? `Synopsis: ${synopsis}` : ''}

Return ONLY valid JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const insights = (Array.isArray(parsed) ? parsed : parsed.insights || []).map((insight: any, idx: number) => ({
      id: `ai-${idx}`,
      type: insight.type || 'metaphor',
      title: insight.title || 'Insight',
      description: insight.description || '',
    }));

    insightsCache.set(cacheKey, insights);
    return insights;
  } catch (error) {
    console.error("AI insights error:", error);
    return [];
  }
}

async function fetchFromTMDB(endpoint: string) {
  // For specific movie/tv details, try cache first
  if (endpoint.includes('/movie/') || endpoint.includes('/tv/')) {
    const match = endpoint.match(/\/(movie|tv)\/(\d+)/);
    if (match) {
      const [, type, id] = match;
      const cached = await getTMDBFromCache(parseInt(id), type);
      if (cached) return cached;
    }
  }

  // Fetch from TMDB API
  const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`);
  }
  
  const data = await response.json();

  // Cache movie/tv details
  if (endpoint.includes('/movie/') || endpoint.includes('/tv/')) {
    const match = endpoint.match(/\/(movie|tv)\/(\d+)/);
    if (match) {
      const [, type, id] = match;
      await cacheTMDBData(parseInt(id), type, data);
    }
  }

  return data;
}

function getImageUrl(path: string | null, size: 'w500' | 'original' = 'w500'): string {
  if (!path) return 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1000&auto=format&fit=crop';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function determineVerdict(budget: number, revenue: number): string {
  if (budget === 0) return 'N/A';
  const ratio = revenue / budget;
  if (ratio >= 5) return 'Blockbuster';
  if (ratio >= 3) return 'Super Hit';
  if (ratio >= 2) return 'Hit';
  if (ratio >= 1.2) return 'Average';
  if (ratio >= 0.8) return 'Flop';
  if (ratio >= 0.5) return 'Super Flop';
  return 'Disaster';
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Search for movies/shows
  app.get("/api/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      const data = await fetchFromTMDB(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false`);
      
      const results = data.results
        .filter((item: TMDBSearchResult) => item.media_type === 'movie' || item.media_type === 'tv')
        .slice(0, 20)
        .map((item: TMDBSearchResult) => ({
          id: item.id,
          title: item.title || item.name,
          type: item.media_type === 'movie' ? 'Movie' : 'Show',
          year: (item.release_date || item.first_air_date || '').split('-')[0],
          synopsis: item.overview,
          posterUrl: getImageUrl(item.poster_path),
          backdropUrl: getImageUrl(item.backdrop_path, 'original'),
        }));

      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Failed to search movies" });
    }
  });

  // Get movie/show details with actor projects and AI insights
  app.get("/api/title/:type/:id", async (req: Request, res: Response) => {
    try {
      const { type, id } = req.params;
      const mediaType = type === 'movie' ? 'movie' : 'tv';
      
      const details: TMDBMovieDetails = await fetchFromTMDB(`/${mediaType}/${id}?append_to_response=credits`);
      
      const director = details.credits.crew.find((c) => c.job === 'Director') || 
                       details.credits.crew.find((c) => c.job === 'Executive Producer');
      
      const topCast = details.credits.cast.slice(0, 5);
      
      // Fetch actor projects in parallel
      const castWithProjects = await Promise.all(
        topCast.map(async (actor) => {
          const currentProjects = await fetchActorProjects(actor.id);
          return {
            id: actor.id.toString(),
            name: actor.name,
            role: actor.character,
            imageUrl: getImageUrl(actor.profile_path),
            fee: 'Undisclosed',
            currentProjects,
          };
        })
      );

      const budget = details.budget || 0;
      const revenue = details.revenue || 0;
      const titleName = details.title || details.name || '';
      
      // Check if insights are cached - don't auto-generate
      const cachedInsights = await getInsightsFromCache(details.id, mediaType);
      
      const result = {
        id: details.id.toString(),
        title: titleName,
        type: type === 'movie' ? 'Movie' : 'Show',
        year: (details.release_date || details.first_air_date || '').split('-')[0],
        synopsis: details.overview,
        posterUrl: getImageUrl(details.poster_path),
        backdropUrl: getImageUrl(details.backdrop_path, 'original'),
        director: {
          name: director?.name || 'Unknown',
          fee: 'Undisclosed',
        },
        cast: castWithProjects,
        budget: {
          production: budget > 0 ? `$${(budget / 1_000_000).toFixed(1)}M` : 'N/A',
          boxOffice: revenue > 0 ? `$${(revenue / 1_000_000).toFixed(1)}M` : 'N/A',
          verdict: determineVerdict(budget, revenue),
        },
        deepDive: cachedInsights || [], // Return cached or empty array
        insightsAvailable: !!cachedInsights, // Flag to indicate if insights exist
      };

      res.json(result);
    } catch (error) {
      console.error("Details error:", error);
      res.status(500).json({ error: "Failed to fetch movie details" });
    }
  });

  // Generate AI insights for a movie/show (on-demand, cached, rate-limited)
  app.post("/api/title/:type/:id/insights", optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { type, id } = req.params;
      const { title, synopsis } = req.body;
      const userId = req.userId;

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      const mediaType = type === 'movie' ? 'movie' : 'tv';
      const tmdbId = parseInt(id);

      // Check cache first
      const cachedInsights = await getInsightsFromCache(tmdbId, mediaType);
      if (cachedInsights) {
        console.log(`✅ Using cached insights for ${mediaType}/${id}`);
        return res.json(cachedInsights);
      }

      // Check rate limit if user is logged in
      if (userId) {
        const hasQuota = await checkInsightQuota(userId);
        if (!hasQuota) {
          return res.status(429).json({
            error: "Daily insight limit reached (5 per day). Try again tomorrow!",
          });
        }
      }

      // Optimized prompt to reduce tokens
      const prompt = `Analyze "${title}" and provide 4 insights. Return ONLY this JSON:
{
  "insights": [
    {
      "type": "dialogue",
      "title": "A memorable quote",
      "description": "Why it matters (2-3 sentences)"
    },
    {
      "type": "metaphor",
      "title": "A visual or thematic metaphor",
      "description": "Its symbolic meaning (2-3 sentences)"
    },
    {
      "type": "easter-egg",
      "title": "A hidden detail",
      "description": "Why it's significant (2-3 sentences)"
    },
    {
      "type": "metaphor",
      "title": "Another symbolic element",
      "description": "Its cultural significance (2-3 sentences)"
    }
  ]
}

${synopsis ? `Summary: ${synopsis.substring(0, 200)}` : ''}`;

      console.log(`🔄 Generating insights for ${mediaType}/${id}...`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 800, // Reduced from 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ error: "No response from AI" });
      }

      let insights;
      try {
        const parsed = JSON.parse(content);
        insights = Array.isArray(parsed) ? parsed : parsed.insights || [];
      } catch {
        insights = [];
      }

      // Add unique IDs
      const insightsWithIds = insights.map((insight: any, idx: number) => ({
        id: `ai-${idx}`,
        type: insight.type || 'metaphor',
        title: insight.title || 'Insight',
        description: insight.description || '',
      }));

      // Cache the insights
      await cacheInsights(tmdbId, mediaType, title, synopsis, insightsWithIds);

      // Increment user's insight count if logged in
      if (userId) {
        await incrementInsightCount(userId);
      }

      console.log(`✅ Generated and cached insights for ${mediaType}/${id}`);
      res.json(insightsWithIds);
    } catch (error) {
      console.error("Insights generation error:", error);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  // ==================== AUTH ROUTES ====================

  // Request login (send OTP via email - for now we'll show it in response for testing)
  app.post("/api/auth/request-login", async (req: Request, res: Response) => {
    try {
      const parsed = requestLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      const { email, displayName } = parsed.data;
      
      // Check if user exists
      let user = await storage.getUserByEmail(email);
      let userId: string | null = user?.id || null;
      
      // Create auth token
      const { token, expiresAt } = await storage.createAuthToken(email, userId);
      
      // In production, send email with token. For now, we return it for testing.
      // The token is a 6-digit OTP for easy entry
      const otp = generateOTP();
      
      // Store a mapping of OTP to token (in production, only store OTP hash)
      const otpToken = await storage.createAuthToken(email, userId);
      
      // Log for development
      console.log(`[AUTH] OTP for ${email}: ${otp} (use token: ${token})`);
      
      res.json({
        message: "Verification code sent",
        email,
        // Return token for development/testing - in production, send via email
        token: token,
        expiresAt,
        isNewUser: !user,
      });
    } catch (error) {
      console.error("Auth request error:", error);
      res.status(500).json({ error: "Failed to send verification" });
    }
  });

  // Verify token and create session
  app.post("/api/auth/verify", async (req: Request, res: Response) => {
    try {
      const { token, displayName } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }
      
      // First, validate the token without consuming it
      const result = await storage.verifyAuthToken(token, false);
      if (!result) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }
      
      // Find or create user
      let user = await storage.getUserByEmail(result.email);
      if (!user) {
        // Validate display name for new users
        if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
          // Don't consume token yet - user needs to provide display name
          return res.status(400).json({ 
            error: "Display name is required for new users", 
            needsDisplayName: true,
            email: result.email 
          });
        }
        const trimmedName = displayName.trim();
        if (trimmedName.length > 50) {
          return res.status(400).json({ error: "Display name must be 50 characters or less" });
        }
        user = await storage.createUser({
          email: result.email,
          displayName: trimmedName,
        });
      }
      
      // Now consume the token since login is successful
      await storage.consumeAuthToken(result.tokenId);
      
      // Create session
      const sessionId = await storage.createSession(user.id);
      
      res.json({
        sessionId,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
      });
    } catch (error) {
      console.error("Verify error:", error);
      res.status(500).json({ error: "Failed to verify" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Logout
  app.post("/api/auth/logout", authMiddleware, async (req: Request, res: Response) => {
    try {
      await storage.revokeSession(req.sessionId!);
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  // ==================== DISCUSSION ROUTES ====================

  // Get topics for a movie
  app.get("/api/topics", optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const tmdbId = parseInt(req.query.tmdbId as string);
      const mediaType = req.query.mediaType as string || 'movie';
      
      if (!tmdbId) {
        return res.status(400).json({ error: "tmdbId is required" });
      }
      
      const topics = await storage.getTopicsForMovie(tmdbId, mediaType);
      res.json(topics);
    } catch (error) {
      console.error("Get topics error:", error);
      res.status(500).json({ error: "Failed to get topics" });
    }
  });

  // Create a new topic
  app.post("/api/topics", authMiddleware, async (req: Request, res: Response) => {
    try {
      const parsed = createTopicSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid topic data", details: parsed.error.issues });
      }
      
      const topic = await storage.createTopic({
        ...parsed.data,
        createdBy: req.userId!,
      });
      
      res.json(topic);
    } catch (error) {
      console.error("Create topic error:", error);
      res.status(500).json({ error: "Failed to create topic" });
    }
  });

  // Get a single topic with posts
  app.get("/api/topics/:topicId", optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      
      const posts = await storage.getPostsForTopic(topicId);
      
      // Get user votes if authenticated
      let userVotes = new Set<string>();
      if (req.userId) {
        const postIds = posts.map(p => p.id);
        userVotes = await storage.getUserVotes(req.userId, postIds);
      }
      
      // Add voted flag to each post
      const postsWithVoteStatus = posts.map(post => ({
        ...post,
        userVoted: userVotes.has(post.id),
      }));
      
      res.json({
        topic,
        posts: postsWithVoteStatus,
      });
    } catch (error) {
      console.error("Get topic error:", error);
      res.status(500).json({ error: "Failed to get topic" });
    }
  });

  // Create a post (or reply)
  app.post("/api/topics/:topicId/posts", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      const parsed = createPostSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid post data" });
      }
      
      // Verify topic exists
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      
      // Calculate depth for threaded replies
      let depth = 0;
      if (parsed.data.parentPostId) {
        const posts = await storage.getPostsForTopic(topicId);
        const parentPost = posts.find(p => p.id === parsed.data.parentPostId);
        if (parentPost) {
          depth = parentPost.depth + 1;
        }
      }
      
      const post = await storage.createPost({
        topicId,
        authorId: req.userId!,
        body: parsed.data.body,
        parentPostId: parsed.data.parentPostId || null,
        depth,
      });
      
      // Get author name for response
      const user = await storage.getUser(req.userId!);
      
      res.json({
        ...post,
        authorName: user?.displayName || 'Unknown',
        voteCount: 0,
        userVoted: false,
      });
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Toggle vote on a post
  app.post("/api/posts/:postId/vote", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      
      // Verify post exists
      const postExists = await storage.getPostById(postId);
      if (!postExists) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      const result = await storage.toggleVote(postId, req.userId!);
      res.json(result);
    } catch (error) {
      console.error("Vote error:", error);
      res.status(500).json({ error: "Failed to vote" });
    }
  });

  // Get active user count (presence)
  app.get("/api/presence", async (req: Request, res: Response) => {
    try {
      const tmdbId = parseInt(req.query.tmdbId as string) || 0;
      const count = await storage.getActiveUserCount(tmdbId);
      res.json({ count });
    } catch (error) {
      console.error("Presence error:", error);
      res.status(500).json({ error: "Failed to get presence" });
    }
  });

  return httpServer;
}
