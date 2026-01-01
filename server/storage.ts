import { 
  type User, type InsertUser,
  type DiscussionTopic, type InsertTopic,
  type DiscussionPost, type InsertPost,
  users, authTokens, sessions, discussionTopics, discussionPosts, postVotes
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gt, isNull } from "drizzle-orm";
import { randomUUID, createHash } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastSeen(userId: string): Promise<void>;
  
  // Auth tokens
  createAuthToken(email: string, userId: string | null): Promise<{ token: string; expiresAt: Date }>;
  verifyAuthToken(token: string, consume?: boolean): Promise<{ email: string; userId: string | null; tokenId: string } | null>;
  consumeAuthToken(tokenId: string): Promise<void>;
  
  // Sessions
  createSession(userId: string): Promise<string>;
  getSession(sessionId: string): Promise<{ userId: string } | null>;
  updateSessionActivity(sessionId: string): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
  getActiveUserCount(tmdbId: number): Promise<number>;
  
  // Topics
  getTopicsForMovie(tmdbId: number, mediaType: string): Promise<DiscussionTopic[]>;
  getTopic(topicId: string): Promise<DiscussionTopic | undefined>;
  createTopic(topic: InsertTopic): Promise<DiscussionTopic>;
  updateTopicActivity(topicId: string): Promise<void>;
  
  // Posts
  getPostsForTopic(topicId: string): Promise<(DiscussionPost & { authorName: string; voteCount: number })[]>;
  getPostById(postId: string): Promise<DiscussionPost | undefined>;
  createPost(post: InsertPost): Promise<DiscussionPost>;
  
  // Votes
  toggleVote(postId: string, userId: string): Promise<{ voted: boolean; newCount: number }>;
  getUserVotes(userId: string, postIds: string[]): Promise<Set<string>>;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
    }).returning();
    return user;
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    await db.update(users).set({ lastSeen: new Date() }).where(eq(users.id, userId));
  }

  // Auth tokens
  async createAuthToken(email: string, userId: string | null): Promise<{ token: string; expiresAt: Date }> {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await db.insert(authTokens).values({
      tokenHash: hashToken(token),
      tokenType: 'magic_link',
      destinationEmail: email.toLowerCase(),
      userId,
      expiresAt,
    });
    
    return { token, expiresAt };
  }

  async verifyAuthToken(token: string, consume: boolean = true): Promise<{ email: string; userId: string | null; tokenId: string } | null> {
    const tokenHash = hashToken(token);
    const [authToken] = await db.select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          isNull(authTokens.consumedAt),
          gt(authTokens.expiresAt, new Date())
        )
      );
    
    if (!authToken) return null;
    
    // Only consume token if requested
    if (consume) {
      await db.update(authTokens)
        .set({ consumedAt: new Date() })
        .where(eq(authTokens.id, authToken.id));
    }
    
    return { email: authToken.destinationEmail, userId: authToken.userId, tokenId: authToken.id };
  }

  async consumeAuthToken(tokenId: string): Promise<void> {
    await db.update(authTokens)
      .set({ consumedAt: new Date() })
      .where(eq(authTokens.id, tokenId));
  }

  // Sessions
  async createSession(userId: string): Promise<string> {
    const sessionId = randomUUID();
    await db.insert(sessions).values({
      id: sessionId,
      userId,
    });
    return sessionId;
  }

  async getSession(sessionId: string): Promise<{ userId: string } | null> {
    const [session] = await db.select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          isNull(sessions.revokedAt)
        )
      );
    return session ? { userId: session.userId } : null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await db.update(sessions)
      .set({ lastActive: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async revokeSession(sessionId: string): Promise<void> {
    await db.update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async getActiveUserCount(tmdbId: number): Promise<number> {
    // Count users active in last 60 seconds
    const cutoff = new Date(Date.now() - 60 * 1000);
    const result = await db.select({ count: sql<number>`count(distinct ${sessions.userId})` })
      .from(sessions)
      .where(
        and(
          gt(sessions.lastActive, cutoff),
          isNull(sessions.revokedAt)
        )
      );
    return result[0]?.count || 0;
  }

  // Topics
  async getTopicsForMovie(tmdbId: number, mediaType: string): Promise<DiscussionTopic[]> {
    return db.select()
      .from(discussionTopics)
      .where(
        and(
          eq(discussionTopics.tmdbId, tmdbId),
          eq(discussionTopics.mediaType, mediaType)
        )
      )
      .orderBy(desc(discussionTopics.lastActivityAt));
  }

  async getTopic(topicId: string): Promise<DiscussionTopic | undefined> {
    const [topic] = await db.select().from(discussionTopics).where(eq(discussionTopics.id, topicId));
    return topic;
  }

  async createTopic(topic: InsertTopic): Promise<DiscussionTopic> {
    const [created] = await db.insert(discussionTopics).values(topic).returning();
    return created;
  }

  async updateTopicActivity(topicId: string): Promise<void> {
    await db.update(discussionTopics)
      .set({ lastActivityAt: new Date() })
      .where(eq(discussionTopics.id, topicId));
  }

  // Posts
  async getPostsForTopic(topicId: string): Promise<(DiscussionPost & { authorName: string; voteCount: number })[]> {
    const posts = await db.select({
      id: discussionPosts.id,
      topicId: discussionPosts.topicId,
      parentPostId: discussionPosts.parentPostId,
      authorId: discussionPosts.authorId,
      body: discussionPosts.body,
      depth: discussionPosts.depth,
      createdAt: discussionPosts.createdAt,
      editedAt: discussionPosts.editedAt,
      authorName: users.displayName,
      voteCount: sql<number>`coalesce(sum(${postVotes.value}), 0)::int`,
    })
      .from(discussionPosts)
      .leftJoin(users, eq(discussionPosts.authorId, users.id))
      .leftJoin(postVotes, eq(discussionPosts.id, postVotes.postId))
      .where(eq(discussionPosts.topicId, topicId))
      .groupBy(discussionPosts.id, users.displayName)
      .orderBy(discussionPosts.createdAt);
    
    return posts.map(p => ({
      ...p,
      authorName: p.authorName || 'Unknown',
    }));
  }

  async getPostById(postId: string): Promise<DiscussionPost | undefined> {
    const [post] = await db.select().from(discussionPosts).where(eq(discussionPosts.id, postId));
    return post;
  }

  async createPost(post: InsertPost): Promise<DiscussionPost> {
    const [created] = await db.insert(discussionPosts).values(post).returning();
    // Update topic activity
    await this.updateTopicActivity(post.topicId);
    return created;
  }

  // Votes
  async toggleVote(postId: string, userId: string): Promise<{ voted: boolean; newCount: number }> {
    // Check if vote exists
    const [existing] = await db.select()
      .from(postVotes)
      .where(and(eq(postVotes.postId, postId), eq(postVotes.userId, userId)));
    
    if (existing) {
      // Remove vote
      await db.delete(postVotes)
        .where(and(eq(postVotes.postId, postId), eq(postVotes.userId, userId)));
    } else {
      // Add vote
      await db.insert(postVotes).values({ postId, userId, value: 1 });
    }
    
    // Get new count
    const [result] = await db.select({ count: sql<number>`coalesce(sum(${postVotes.value}), 0)::int` })
      .from(postVotes)
      .where(eq(postVotes.postId, postId));
    
    return { voted: !existing, newCount: result?.count || 0 };
  }

  async getUserVotes(userId: string, postIds: string[]): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    
    const votes = await db.select({ postId: postVotes.postId })
      .from(postVotes)
      .where(
        and(
          eq(postVotes.userId, userId),
          sql`${postVotes.postId} = ANY(${postIds})`
        )
      );
    
    return new Set(votes.map(v => v.postId));
  }
}

export const storage = new DatabaseStorage();
