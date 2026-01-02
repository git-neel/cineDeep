# Discussion Platform Implementation Guide

## Overview
This guide walks through implementing the **Option 2: Reddit-Style Flattening** discussion platform as designed in `DISCUSSION_DESIGN.md`.

Total estimated time: **~24-30 hours** across 4 phases.

---

## Phase 1: Database Schema Setup (2-3 hours)

### Step 1.1: Update Schema with Discussion Tables

Add to `shared/schema.ts`:

```typescript
import { text, timestamp, integer, boolean, uuid, pgTable, serial, index, unique } from 'drizzle-orm/pg-core';

// Discussion Topics (e.g., "Action Films", "Sci-Fi", "Director Spotlight")
export const discussionTopics = pgTable('discussion_topics', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  postCount: integer('post_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  nameIdx: index('idx_topic_name').on(table.name),
}));

// Movie Discussions - Links movie to discussion topics
export const movieDiscussions = pgTable('movie_discussions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tmdbId: integer('tmdb_id').notNull(),
  mediaType: text('media_type').notNull(), // 'movie' or 'tv'
  topicId: uuid('topic_id').references(() => discussionTopics.id),
  postCount: integer('post_count').default(0),
  lastPostAt: timestamp('last_post_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueMovie: unique('uniq_movie_discussion').on(table.tmdbId, table.mediaType, table.topicId),
  tmdbIdx: index('idx_movie_tmdb').on(table.tmdbId),
}));

// Discussion Posts - User posts on a movie discussion
export const discussionPosts = pgTable('discussion_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  discussionId: uuid('discussion_id').references(() => movieDiscussions.id),
  userId: text('user_id').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  voteCount: integer('vote_count').default(0),
  replyCount: integer('reply_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
}, (table) => ({
  discussionIdx: index('idx_post_discussion').on(table.discussionId),
  userIdx: index('idx_post_user').on(table.userId),
  createdIdx: index('idx_post_created').on(table.createdAt),
}));

// Discussion Replies - Comments on posts (max 2 levels: depth 0 and 1)
export const discussionReplies = pgTable('discussion_replies', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => discussionPosts.id),
  parentReplyId: uuid('parent_reply_id').references(() => discussionReplies.id),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  depth: integer('depth').notNull(), // 0 = direct reply to post, 1 = reply to a reply
  voteCount: integer('vote_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
}, (table) => ({
  // CHECK constraint: depth must be 0 OR (depth = 1 AND parent_reply_id IS NOT NULL)
  depthCheck: check('depth_check', sql`
    (depth = 0) OR (depth = 1 AND parent_reply_id IS NOT NULL)
  `),
  postIdx: index('idx_reply_post').on(table.postId),
  parentIdx: index('idx_reply_parent').on(table.parentReplyId),
  userIdx: index('idx_reply_user').on(table.userId),
  depthIdx: index('idx_reply_post_depth').on(table.postId, table.depth),
}));

// Votes on replies
export const replyVotes = pgTable('reply_votes', {
  id: serial('id').primaryKey(),
  replyId: uuid('reply_id').references(() => discussionReplies.id),
  userId: text('user_id').notNull(),
  vote: integer('vote').notNull(), // 1 for upvote, -1 for downvote
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueVote: unique('uniq_reply_vote').on(table.replyId, table.userId),
}));
```

### Step 1.2: Run Database Migration

```bash
# Generate migration
DATABASE_URL="postgresql://localhost/cine-seeker" npm run db:generate

# Apply migration
DATABASE_URL="postgresql://localhost/cine-seeker" npm run db:push
```

### Step 1.3: Verify Constraints

```sql
-- Check discussion_replies table
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'discussion_replies';

-- Should see: depth_check (CHECK constraint)
```

---

## Phase 2: Backend API Implementation (6-8 hours)

### Step 2.1: Create Discussion Router

Create `server/routes/discussions.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { discussionTopics, movieDiscussions, discussionPosts, discussionReplies, replyVotes } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

const router = Router();

// Create discussion topic
router.post('/topics', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const topic = await db.insert(discussionTopics)
      .values({ name, description })
      .returning();
    res.json(topic[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all discussion topics
router.get('/topics', async (req: Request, res: Response) => {
  try {
    const topics = await db.select().from(discussionTopics);
    res.json(topics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get movie discussion
router.get('/movie/:tmdbId/:mediaType', async (req: Request, res: Response) => {
  try {
    const { tmdbId, mediaType } = req.params;
    const discussion = await db.select().from(movieDiscussions)
      .where(and(
        eq(movieDiscussions.tmdbId, parseInt(tmdbId)),
        eq(movieDiscussions.mediaType, mediaType)
      ))
      .limit(1);
    
    if (!discussion.length) {
      return res.json(null);
    }
    
    res.json(discussion[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create post in discussion
router.post('/discussions/:discussionId/posts', async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const { userId, title, content } = req.body;
    
    const post = await db.insert(discussionPosts)
      .values({
        discussionId,
        userId,
        title,
        content,
      })
      .returning();
    
    // Increment post count
    await db.update(movieDiscussions)
      .set({ postCount: db.raw('post_count + 1') })
      .where(eq(movieDiscussions.id, discussionId));
    
    res.json(post[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get posts for discussion (paginated)
router.get('/discussions/:discussionId/posts', async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    const posts = await db.select().from(discussionPosts)
      .where(eq(discussionPosts.discussionId, discussionId))
      .orderBy(desc(discussionPosts.createdAt))
      .limit(limit)
      .offset(offset);
    
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get replies for post with children (Reddit-style)
router.get('/posts/:postId/replies', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    // Get level 0 replies (direct replies to post)
    const level0Replies = await db.select().from(discussionReplies)
      .where(and(
        eq(discussionReplies.postId, postId),
        eq(discussionReplies.depth, 0)
      ))
      .orderBy(desc(discussionReplies.createdAt))
      .limit(limit)
      .offset(offset);
    
    // For each level 0 reply, get its level 1 children
    const repliesWithChildren = await Promise.all(
      level0Replies.map(async (reply) => {
        const children = await db.select().from(discussionReplies)
          .where(and(
            eq(discussionReplies.parentReplyId, reply.id),
            eq(discussionReplies.depth, 1)
          ))
          .orderBy(discussionReplies.createdAt);
        
        return {
          ...reply,
          children,
        };
      })
    );
    
    res.json(repliesWithChildren);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create reply (with automatic flattening)
router.post('/posts/:postId/replies', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId, content, parentReplyId } = req.body;
    
    let actualParentReplyId = parentReplyId;
    let depthValue = 0;
    let notification = '';
    
    // Check if replying to a reply
    if (parentReplyId) {
      const parentReply = await db.select().from(discussionReplies)
        .where(eq(discussionReplies.id, parentReplyId))
        .limit(1);
      
      if (parentReply.length > 0) {
        const parent = parentReply[0];
        
        // If parent is already depth 1 (level 2), flatten to depth 0
        if (parent.depth === 1) {
          // THIS IS THE KEY DIFFERENCE FROM UNLIMITED NESTING
          // Get the parent's parent (the level 1 reply)
          actualParentReplyId = parent.parentReplyId;
          depthValue = 1;
          
          // Get parent author for notification
          const grandparent = await db.select().from(discussionReplies)
            .where(eq(discussionReplies.id, parent.parentReplyId))
            .limit(1);
          
          notification = grandparent.length > 0 
            ? `Your reply was added to ${grandparent[0].userId}'s thread` 
            : 'Your reply was added to the discussion thread';
        } else {
          // Parent is depth 0, so this is depth 1
          depthValue = 1;
          actualParentReplyId = parentReplyId;
        }
      }
    }
    
    const reply = await db.insert(discussionReplies)
      .values({
        postId,
        userId,
        content,
        parentReplyId: actualParentReplyId || null,
        depth: depthValue,
      })
      .returning();
    
    // Increment reply count on post
    await db.update(discussionPosts)
      .set({ replyCount: db.raw('reply_count + 1') })
      .where(eq(discussionPosts.id, postId));
    
    res.json({
      ...reply[0],
      notification,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vote on reply
router.post('/replies/:replyId/vote', async (req: Request, res: Response) => {
  try {
    const { replyId } = req.params;
    const { userId, voteValue } = req.body; // voteValue: 1 or -1
    
    // Check if user already voted
    const existingVote = await db.select().from(replyVotes)
      .where(and(
        eq(replyVotes.replyId, replyId),
        eq(replyVotes.userId, userId)
      ))
      .limit(1);
    
    if (existingVote.length > 0) {
      // Update vote
      await db.update(replyVotes)
        .set({ vote: voteValue })
        .where(eq(replyVotes.id, existingVote[0].id));
    } else {
      // Create vote
      await db.insert(replyVotes)
        .values({ replyId, userId, vote: voteValue });
    }
    
    // Recalculate vote count for reply
    const votes = await db.select().from(replyVotes)
      .where(eq(replyVotes.replyId, replyId));
    const voteCount = votes.reduce((sum, v) => sum + v.vote, 0);
    
    await db.update(discussionReplies)
      .set({ voteCount })
      .where(eq(discussionReplies.id, replyId));
    
    res.json({ voteCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit reply
router.put('/replies/:replyId', async (req: Request, res: Response) => {
  try {
    const { replyId } = req.params;
    const { content, userId } = req.body;
    
    // Verify ownership
    const reply = await db.select().from(discussionReplies)
      .where(eq(discussionReplies.id, replyId))
      .limit(1);
    
    if (!reply.length || reply[0].userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const updated = await db.update(discussionReplies)
      .set({ content, updatedAt: new Date() })
      .where(eq(discussionReplies.id, replyId))
      .returning();
    
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Soft delete reply
router.delete('/replies/:replyId', async (req: Request, res: Response) => {
  try {
    const { replyId } = req.params;
    const { userId } = req.body;
    
    // Verify ownership
    const reply = await db.select().from(discussionReplies)
      .where(eq(discussionReplies.id, replyId))
      .limit(1);
    
    if (!reply.length || reply[0].userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const deleted = await db.update(discussionReplies)
      .set({ deletedAt: new Date(), content: '[deleted]' })
      .where(eq(discussionReplies.id, replyId))
      .returning();
    
    res.json(deleted[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 2.2: Update Main Routes

In `server/routes.ts`, add:

```typescript
import discussionRouter from './routes/discussions';

// Add to main router
router.use('/api/discussions', discussionRouter);
```

---

## Phase 3: Frontend Components (8-10 hours)

### Step 3.1: Create ReplyCard Component

Create `client/src/components/discussions/ReplyCard.tsx`:

```typescript
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ThumbsUp } from 'lucide-react';

interface Reply {
  id: string;
  content: string;
  userId: string;
  depth: 0 | 1;
  voteCount: number;
  createdAt: string;
  deletedAt?: string;
}

interface ReplyCardProps {
  reply: Reply;
  onReply: (parentId: string) => void;
  onVote: (replyId: string, value: 1 | -1) => void;
  parentAuthor?: string;
}

export function ReplyCard({ reply, onReply, onVote, parentAuthor }: ReplyCardProps) {
  const [myVote, setMyVote] = useState<1 | -1 | 0>(0);
  
  if (reply.deletedAt) {
    return (
      <div className={`reply-card reply-level-${reply.depth}`}>
        <p className="text-gray-400 italic">[deleted]</p>
      </div>
    );
  }
  
  const canReplyFurther = reply.depth === 0;
  
  return (
    <div className={`reply-card reply-level-${reply.depth}`}>
      <div className="reply-header">
        <span className="author font-semibold">{reply.userId}</span>
        
        {reply.depth === 1 && parentAuthor && (
          <span className="reply-to text-gray-600 text-sm">
            ↳ replying to {parentAuthor}
          </span>
        )}
        
        <span className="timestamp text-gray-500 text-xs ml-auto">
          {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
        </span>
      </div>
      
      <div className="reply-content my-2 text-gray-700">
        {reply.content}
      </div>
      
      <div className="reply-actions flex items-center gap-3 text-sm">
        <button
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
          onClick={() => {
            if (myVote === 1) {
              setMyVote(0);
              onVote(reply.id, 0);
            } else {
              setMyVote(1);
              onVote(reply.id, 1);
            }
          }}
        >
          <ThumbsUp size={16} fill={myVote === 1 ? 'currentColor' : 'none'} />
          <span>{reply.voteCount}</span>
        </button>
        
        {canReplyFurther ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReply(reply.id)}
          >
            💬 Reply
          </Button>
        ) : (
          <span className="text-gray-500 italic">
            Reply to {parentAuthor} to continue
          </span>
        )}
      </div>
    </div>
  );
}
```

### Step 3.2: Create ReplyThread Component

Create `client/src/components/discussions/ReplyThread.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { ReplyCard } from './ReplyCard';
import { ReplyForm } from './ReplyForm';

interface Reply {
  id: string;
  content: string;
  userId: string;
  depth: 0 | 1;
  voteCount: number;
  createdAt: string;
  children?: Reply[];
}

interface ReplyThreadProps {
  postId: string;
  replies: Reply[];
  onReplySubmit: (content: string, parentId?: string) => Promise<void>;
  onVote: (replyId: string, value: 1 | -1) => Promise<void>;
  currentUserId: string;
}

export function ReplyThread({
  postId,
  replies,
  onReplySubmit,
  onVote,
  currentUserId,
}: ReplyThreadProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {replies.map((reply) => (
        <div key={reply.id}>
          <ReplyCard
            reply={reply}
            onReply={setReplyingTo}
            onVote={onVote}
          />
          
          {/* Level 2 Replies (children of Level 1) */}
          {reply.children?.map((child) => (
            <ReplyCard
              key={child.id}
              reply={child}
              onReply={setReplyingTo}
              onVote={onVote}
              parentAuthor={reply.userId}
            />
          ))}
          
          {/* Reply form for this reply */}
          {replyingTo === reply.id && reply.depth === 0 && (
            <ReplyForm
              onSubmit={async (content) => {
                await onReplySubmit(content, reply.id);
                setReplyingTo(null);
              }}
              onCancel={() => setReplyingTo(null)}
              replyingToUser={reply.userId}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

### Step 3.3: Create ReplyForm Component

Create `client/src/components/discussions/ReplyForm.tsx`:

```typescript
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ReplyFormProps {
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  replyingToUser?: string;
  isLoading?: boolean;
}

export function ReplyForm({
  onSubmit,
  onCancel,
  replyingToUser,
  isLoading = false,
}: ReplyFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      await onSubmit(content);
      setContent('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 ml-6 p-4 bg-gray-50 rounded">
      {replyingToUser && (
        <p className="text-sm text-gray-600">
          Replying to <strong>@{replyingToUser}</strong>
        </p>
      )}
      
      <Textarea
        placeholder="Write your reply..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isLoading}
        className="min-h-24"
      />
      
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading || !content.trim()}>
          {isLoading ? 'Posting...' : 'Reply'}
        </Button>
      </div>
    </form>
  );
}
```

---

## Phase 4: Integration & UI (4-6 hours)

### Step 4.1: Add Discussions to MovieDetail Page

Update `client/src/pages/MovieDetail.tsx`:

```typescript
// Add discussion section below insights
import { DiscussionThread } from '@/components/discussions/DiscussionThread';

// In the component JSX:
<section className="mt-8">
  <h2 className="text-2xl font-bold mb-4">💬 Scene Breakdown</h2>
  <DiscussionThread movieId={id} mediaType={type} />
</section>
```

### Step 4.2: Create DiscussionThread Component

Create `client/src/components/discussions/DiscussionThread.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ReplyThread } from './ReplyThread';
import { Button } from '@/components/ui/button';

interface DiscussionThreadProps {
  movieId: number;
  mediaType: 'movie' | 'tv';
}

export function DiscussionThread({ movieId, mediaType }: DiscussionThreadProps) {
  const { session } = useAuth();
  const [discussion, setDiscussion] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDiscussion();
  }, [movieId, mediaType]);

  const fetchDiscussion = async () => {
    try {
      const res = await fetch(
        `/api/discussions/movie/${movieId}/${mediaType}`
      );
      const data = await res.json();
      setDiscussion(data);
      
      if (data?.id) {
        const postsRes = await fetch(
          `/api/discussions/${data.id}/posts?page=1&limit=10`
        );
        setPosts(await postsRes.json());
      }
    } catch (error) {
      console.error('Error fetching discussion:', error);
    }
  };

  const handleReplySubmit = async (content: string, parentId?: string) => {
    if (!session?.user) return;
    
    setLoading(true);
    try {
      const res = await fetch(
        `/api/posts/${posts[0]?.id}/replies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            content,
            parentReplyId: parentId,
          }),
        }
      );
      
      if (res.ok) {
        fetchDiscussion(); // Refresh discussion
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!discussion) {
    return <p>No discussion yet. Be the first to discuss this film!</p>;
  }

  return (
    <div className="space-y-6">
      {posts.length > 0 && (
        <ReplyThread
          postId={posts[0].id}
          replies={posts[0].replies || []}
          onReplySubmit={handleReplySubmit}
          onVote={async (replyId, value) => {
            await fetch(`/api/replies/${replyId}/vote`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: session?.user?.id,
                voteValue: value,
              }),
            });
          }}
          currentUserId={session?.user?.id || ''}
        />
      )}
    </div>
  );
}
```

---

## Testing Checklist

### Manual Testing

- [ ] Create a discussion topic
- [ ] Create a post in the discussion
- [ ] Reply to the post (depth 0)
- [ ] Reply to a reply (depth 1) - should appear as child
- [ ] Try to reply to a depth 1 reply - should flatten to depth 0
- [ ] Vote on replies
- [ ] Edit your own reply
- [ ] Delete your own reply (should show [deleted])
- [ ] Load paginated replies
- [ ] Verify no Level 3 replies can be created

### Database Verification

```sql
-- Check no replies exist with depth > 1
SELECT * FROM discussion_replies WHERE depth > 1;
-- Should return empty

-- Check constraint is enforced
INSERT INTO discussion_replies (post_id, user_id, content, depth) 
VALUES ('test', 'user', 'test', 3);
-- Should error: violates check constraint "depth_check"

-- Check children aggregation
SELECT r1.id, COUNT(r2.id) as child_count
FROM discussion_replies r1
LEFT JOIN discussion_replies r2 ON r2.parent_reply_id = r1.id
GROUP BY r1.id;
```

---

## Troubleshooting

### Issue: "CHECK constraint violation"
**Solution**: Verify depth is 0 or 1, and if depth is 1, parent_reply_id must be set.

### Issue: Replies not appearing in correct order
**Solution**: Ensure Level 1 replies are ordered by createdAt ASC (earliest first), not DESC.

### Issue: Vote count not updating
**Solution**: Make sure to recalculate after each vote with SUM aggregate, not just increment.

---

## Next Steps After Phase 4

1. **Real-time Updates** - Add Socket.io for live reply notifications
2. **Moderation** - Implement report/hide features
3. **User Profiles** - Link replies to user profiles with comment history
4. **Email Notifications** - Notify users when someone replies to their thread
5. **Advanced Search** - Full-text search across discussions
6. **Analytics** - Track most discussed movies, trending topics

---

## Production Checklist

- [ ] Database backups configured
- [ ] Rate limiting on POST /api/posts/:id/replies
- [ ] Spam detection for repeated posts
- [ ] Email verification before posting
- [ ] Profanity filter for content
- [ ] User reputation system
- [ ] Moderation dashboard
- [ ] Analytics tracking

---

**Total Development Time: ~24-30 hours**

Ready to build! 🚀
