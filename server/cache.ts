import { db } from "./db";
import { tmdbCache, insightsCache, userInsightQuota } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * Get TMDB data from cache or return null if expired/not found
 */
export async function getTMDBFromCache(tmdbId: number, mediaType: string) {
  try {
    const cached = await db
      .select()
      .from(tmdbCache)
      .where(
        and(
          eq(tmdbCache.tmdbId, tmdbId),
          eq(tmdbCache.mediaType, mediaType),
          gt(tmdbCache.expiresAt, new Date())
        )
      )
      .limit(1);

    if (cached.length > 0) {
      console.log(`[CACHE HIT] TMDB ${mediaType}/${tmdbId}`);
      return JSON.parse(cached[0].data);
    }
  } catch (error) {
    console.error("Cache read error:", error);
  }
  return null;
}

/**
 * Store TMDB data in cache (30 days expiry)
 */
export async function cacheTMDBData(tmdbId: number, mediaType: string, data: any) {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db
      .insert(tmdbCache)
      .values({
        tmdbId,
        mediaType,
        data: JSON.stringify(data),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [tmdbCache.tmdbId, tmdbCache.mediaType],
        set: {
          data: JSON.stringify(data),
          expiresAt,
        },
      });

    console.log(`[CACHED] TMDB ${mediaType}/${tmdbId}`);
  } catch (error) {
    console.error("Cache write error:", error);
  }
}

/**
 * Get insights from cache or return null if expired/not found
 */
export async function getInsightsFromCache(tmdbId: number, mediaType: string) {
  try {
    const cached = await db
      .select()
      .from(insightsCache)
      .where(
        and(
          eq(insightsCache.tmdbId, tmdbId),
          eq(insightsCache.mediaType, mediaType),
          gt(insightsCache.expiresAt, new Date())
        )
      )
      .limit(1);

    if (cached.length > 0) {
      console.log(`[CACHE HIT] Insights ${mediaType}/${tmdbId}`);
      return JSON.parse(cached[0].insights);
    }
  } catch (error) {
    console.error("Cache read error:", error);
  }
  return null;
}

/**
 * Store insights in cache (90 days expiry)
 */
export async function cacheInsights(
  tmdbId: number,
  mediaType: string,
  title: string,
  synopsis: string | undefined,
  insights: any
) {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await db
      .insert(insightsCache)
      .values({
        tmdbId,
        mediaType,
        title,
        synopsis: synopsis || "",
        insights: JSON.stringify(insights),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [insightsCache.tmdbId, insightsCache.mediaType],
        set: {
          insights: JSON.stringify(insights),
          expiresAt,
        },
      });

    console.log(`[CACHED] Insights ${mediaType}/${tmdbId}`);
  } catch (error) {
    console.error("Cache write error:", error);
  }
}

/**
 * Check if user has exceeded daily insight quota
 */
export async function checkInsightQuota(userId: string): Promise<boolean> {
  try {
    const quota = await db
      .select()
      .from(userInsightQuota)
      .where(eq(userInsightQuota.userId, userId))
      .limit(1);

    if (quota.length === 0) {
      // First time user - create quota
      await db.insert(userInsightQuota).values({
        userId,
        insightsGeneratedToday: 0,
        dailyLimit: 5,
      });
      return true; // Allow
    }

    const { insightsGeneratedToday, dailyLimit, lastResetAt } = quota[0];

    // Reset quota if it's been a day
    const now = new Date();
    const daysSinceReset =
      (now.getTime() - lastResetAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceReset >= 1) {
      // Reset quota
      await db
        .update(userInsightQuota)
        .set({
          insightsGeneratedToday: 0,
          lastResetAt: now,
        })
        .where(eq(userInsightQuota.userId, userId));
      return true; // Allow
    }

    // Check if user has remaining quota
    return insightsGeneratedToday < dailyLimit;
  } catch (error) {
    console.error("Quota check error:", error);
    return true; // Allow on error (fail open)
  }
}

/**
 * Increment user's insight generation count
 */
export async function incrementInsightCount(userId: string) {
  try {
    await db
      .update(userInsightQuota)
      .set({
        insightsGeneratedToday: userInsightQuota.insightsGeneratedToday + 1,
      })
      .where(eq(userInsightQuota.userId, userId));
  } catch (error) {
    console.error("Error incrementing insight count:", error);
  }
}
