import type { Express, Request, Response } from "express";
import type { Server } from "http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

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
  const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`);
  }
  return response.json();
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
      
      // Generate AI insights in parallel
      const insightsPromise = generateInsightsForTitle(titleName, details.overview);

      const insights = await insightsPromise;

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
        deepDive: insights,
      };

      res.json(result);
    } catch (error) {
      console.error("Details error:", error);
      res.status(500).json({ error: "Failed to fetch movie details" });
    }
  });

  // Generate AI insights for a movie/show
  app.post("/api/title/:type/:id/insights", async (req: Request, res: Response) => {
    try {
      const { type, id } = req.params;
      const { title, synopsis } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      const prompt = `You are a film critic and cultural analyst. Analyze "${title}" and provide deep insights.

Return a JSON object with an "insights" array containing 3-5 insights with this exact structure:
{
  "insights": [
    {
      "type": "dialogue" | "metaphor" | "easter-egg",
      "title": "Brief title of the insight (e.g., a memorable quote or symbolic element)",
      "description": "2-3 sentences explaining the deeper meaning, symbolism, or hidden detail"
    }
  ]
}

Focus on:
- Memorable dialogues and their thematic significance
- Visual metaphors and symbolic elements
- Hidden meanings and Easter eggs
- Cultural or philosophical subtext

${synopsis ? `Synopsis: ${synopsis}` : ''}

Return ONLY valid JSON, no other text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
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

      res.json(insightsWithIds);
    } catch (error) {
      console.error("Insights generation error:", error);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  return httpServer;
}
