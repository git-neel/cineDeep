import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - email-based auth
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSeen: timestamp("last_seen").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastSeen: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Auth tokens for magic link / OTP
export const authTokens = pgTable("auth_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  tokenType: text("token_type").notNull(), // 'magic_link' or 'otp'
  destinationEmail: text("destination_email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Sessions for logged-in users
export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastActive: timestamp("last_active").default(sql`CURRENT_TIMESTAMP`).notNull(),
  revokedAt: timestamp("revoked_at"),
});

// Discussion topics tied to movies
export const discussionTopics = pgTable("discussion_topics", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: text("media_type").notNull(), // 'movie' or 'tv'
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastActivityAt: timestamp("last_activity_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTopicSchema = createInsertSchema(discussionTopics).omit({
  id: true,
  createdAt: true,
  lastActivityAt: true,
});

export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type DiscussionTopic = typeof discussionTopics.$inferSelect;

// Discussion posts (threaded)
export const discussionPosts = pgTable("discussion_posts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id", { length: 36 }).notNull().references(() => discussionTopics.id, { onDelete: "cascade" }),
  parentPostId: varchar("parent_post_id", { length: 36 }),
  authorId: varchar("author_id", { length: 36 }).notNull().references(() => users.id),
  body: text("body").notNull(),
  depth: integer("depth").default(0).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  editedAt: timestamp("edited_at"),
});

export const insertPostSchema = createInsertSchema(discussionPosts).omit({
  id: true,
  createdAt: true,
  editedAt: true,
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type DiscussionPost = typeof discussionPosts.$inferSelect;

// Post votes (upvotes)
export const postVotes = pgTable("post_votes", {
  postId: varchar("post_id", { length: 36 }).notNull().references(() => discussionPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").default(1).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.userId] }),
}));

// Chat models for OpenAI integration (existing)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Cache for TMDB API responses
export const tmdbCache = pgTable("tmdb_cache", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: text("media_type").notNull(), // 'movie' or 'tv'
  data: text("data").notNull(), // JSON stringified TMDB data
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from creation
}, (table) => ({
  tmdbIdTypeIdx: { unique: true, on: [table.tmdbId, table.mediaType] },
}));

// Cache for AI-generated insights
export const insightsCache = pgTable("insights_cache", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: text("media_type").notNull(), // 'movie' or 'tv'
  title: text("title").notNull(),
  synopsis: text("synopsis"),
  insights: text("insights").notNull(), // JSON stringified insights array
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 90 days from creation
}, (table) => ({
  tmdbIdTypeIdx: { unique: true, on: [table.tmdbId, table.mediaType] },
}));

// Rate limiting for AI insights generation
export const userInsightQuota = pgTable("user_insight_quota", {
  userId: varchar("user_id", { length: 36 }).primaryKey().references(() => users.id, { onDelete: "cascade" }),
  insightsGeneratedToday: integer("insights_generated_today").default(0).notNull(),
  lastResetAt: timestamp("last_reset_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  dailyLimit: integer("daily_limit").default(5).notNull(), // Free tier: 5/day
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type TMDBCache = typeof tmdbCache.$inferSelect;
export type InsightsCache = typeof insightsCache.$inferSelect;
export type UserInsightQuota = typeof userInsightQuota.$inferSelect;
