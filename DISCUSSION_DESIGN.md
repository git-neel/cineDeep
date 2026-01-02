# Discussion Platform - Detailed Design

## Reply Nesting Strategy

### Chosen Approach: Reddit-Style Flattening (FINAL DESIGN ✅)
**Max 2 levels of nesting - replies beyond Level 2 flatten back to Level 1:**
```
Post
├── Level 1: Direct Reply to Post
│   ├── Level 2: Reply to Reply (shown as child)
│   ├── Level 2: Reply to Reply (shown as child)
│   └── Level 2: Reply to Reply (shown as child)
│
├── Level 1: Direct Reply to Post
│   ├── Level 2: Reply to Reply (shown as child)
│   └── Level 2: Reply to Reply (shown as child)
│
└── Level 1: Direct Reply to Post
    └── Level 2: Reply to Reply (shown as child)
```

**Key Features:**
- Direct replies to post: Full threading (can reply to reply)
- Replies to replies: Shown as children but can't be replied to again
- Attempting to reply to Level 2: Shows "Reply to {Level 1 author} instead"
- Clean visual hierarchy without infinite nesting
- **Best of both worlds:** Threading + Simplicity

---

## Updated Database Schema

### discussion_replies Table (Option 2: Reddit-Style)
```sql
CREATE TABLE discussion_replies (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core relationships
  post_id VARCHAR(36) NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
  
  -- For threading: reply_to_reply_id OR reply_to_post_level1_id
  -- This determines who you're directly replying to
  -- If replying to another reply: show it as child
  -- If replying to a reply's reply: show as child of first reply (flattened)
  parent_reply_id VARCHAR(36) REFERENCES discussion_replies(id) ON DELETE CASCADE,
  
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Content
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP, -- Soft delete
  
  -- Important: depth only goes 0-1 (Level 1 or Level 2)
  -- Level 2 can't have replies
  depth INTEGER DEFAULT 0 CHECK (depth IN (0, 1)), -- 0 = direct reply to post, 1 = reply to reply
  
  -- Engagement metrics
  vote_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_reply_post_id ON discussion_replies(post_id);
CREATE INDEX idx_reply_parent_id ON discussion_replies(parent_reply_id);
CREATE INDEX idx_reply_user_id ON discussion_replies(user_id);
CREATE INDEX idx_reply_depth ON discussion_replies(depth);
CREATE INDEX idx_reply_created_at ON discussion_replies(created_at DESC);
CREATE INDEX idx_reply_post_depth ON discussion_replies(post_id, depth);

-- Constraint: Level 2 replies must have a parent
ALTER TABLE discussion_replies 
ADD CONSTRAINT level2_must_have_parent 
CHECK ((depth = 0) OR (depth = 1 AND parent_reply_id IS NOT NULL));
```

---

## API Design with Reddit-Style Flattening

### Fetch Replies (Option 2 Structure)
```typescript
// GET /api/posts/:postId/replies?limit=20&offset=0
// Returns ONLY Level 1 (direct) replies WITH Level 2 children included
{
  "replies": [
    {
      "id": "reply-1",
      "content": "Great movie!",
      "author": "user-1",
      "depth": 0,
      "parent_reply_id": null,
      "reply_count": 3,
      "children": [
        {
          "id": "reply-1-1",
          "content": "I agree!",
          "author": "user-2",
          "depth": 1,
          "parent_reply_id": "reply-1"
        }
      ]
    }
  ]
}
```

### Create Reply (Automatic Flattening)
```typescript
POST /api/posts/:postId/replies {
  "content": "Great analysis!",
  "parent_reply_id": "reply-1-2" // User replying to a Level 2 reply
}

// Backend logic - THIS IS THE KEY DIFFERENCE:
if (parent_reply_id) {
  parent = await getReply(parent_reply_id);
  
  if (parent.depth === 1) {
    // User tried to reply to a Level 2 reply
    // FLATTEN: Make it a child of the Level 1 reply instead
    actual_parent = parent.parent_reply_id; // Get the Level 1 reply
    depth = 1;
    notify_user("Your reply was added to {Level1Author}'s thread");
  } else if (parent.depth === 0) {
    // Normal: replying to Level 1 reply
    actual_parent = parent_reply_id;
    depth = 1;
  }
} else {
  // Direct reply to post
  actual_parent = null;
  depth = 0;
}

await insertReply({ 
  post_id, 
  parent_reply_id: actual_parent, 
  depth, 
  content 
});
```

---

## Frontend Display Strategy (Reddit-Style)

### Single Pass Rendering - No Recursion
```tsx
// ReplyThread.tsx - Simple, flat structure

interface Reply {
  id: string;
  content: string;
  author: string;
  depth: 0 | 1; // Only 2 values
  parent_reply_id?: string;
  children?: Reply[]; // Pre-fetched children from API
  vote_count: number;
  created_at: string;
}

export function ReplyThread({ replies }: { replies: Reply[] }) {
  return (
    <div className="reply-thread">
      {replies.map(reply => (
        <div key={reply.id}>
          {/* Level 1 Reply */}
          <ReplyCard reply={reply} depth={0} />
          
          {/* Level 2 Replies (flattened children) */}
          {reply.children?.map(child => (
            <ReplyCard 
              key={child.id} 
              reply={child} 
              depth={1}
              parentAuthor={reply.author}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface ReplyCardProps {
  reply: Reply;
  depth: 0 | 1;
  parentAuthor?: string;
}

function ReplyCard({ reply, depth, parentAuthor }: ReplyCardProps) {
  const canReplyFurther = depth === 0; // Only Level 1 can have replies
  
  return (
    <div className={`reply-card reply-level-${depth}`}>
      <div className="reply-header">
        <span className="author">{reply.author}</span>
        {depth === 1 && (
          <span className="reply-to"> replying to {parentAuthor}</span>
        )}
        <span className="timestamp">{formatDate(reply.created_at)}</span>
      </div>
      
      <div className="reply-content">
        {reply.content}
      </div>
      
      <div className="reply-actions">
        <VoteButtons replyId={reply.id} votes={reply.vote_count} />
        
        {canReplyFurther && (
          <ReplyButton 
            onClick={() => openReplyForm(reply.id)}
          />
        )}
        
        {depth === 1 && (
          <span className="info-text">
            💬 Reply to {parentAuthor} to continue thread
          </span>
        )}
      </div>
    </div>
  );
}
```

### CSS Styling (Reddit-Style Layout)

```css
/* Two-level reply display */

.reply-thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
}

.reply-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px 16px;
  background: #ffffff;
  transition: background 0.2s;
}

.reply-card:hover {
  background: #f9f9f9;
}

/* Level 1: Direct replies */
.reply-level-0 {
  margin-left: 0;
  border-left: 3px solid #2563eb;
}

/* Level 2: Replies to replies (indented slightly) */
.reply-level-1 {
  margin-left: 16px;
  border-left: 3px solid #9ca3af;
  opacity: 0.95;
}

.reply-level-1::before {
  content: '└─';
  color: #9ca3af;
  font-weight: bold;
  margin-right: 4px;
}

.reply-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.author {
  font-weight: 600;
  color: #1f2937;
}

.reply-to {
  color: #6b7280;
  font-size: 12px;
}

.reply-to::before {
  content: '↳ ';
  color: #9ca3af;
}

.timestamp {
  color: #9ca3af;
  font-size: 12px;
  margin-left: auto;
}

.reply-content {
  margin-bottom: 8px;
  line-height: 1.5;
  color: #374151;
}

.reply-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.info-text {
  color: #6b7280;
  font-style: italic;
  margin-left: auto;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .reply-level-1 {
    margin-left: 8px;
  }
  
  .reply-card {
    padding: 10px 12px;
  }
  
  .reply-header {
    flex-wrap: wrap;
  }
  
  .timestamp {
    width: 100%;
    margin-left: 0;
    margin-top: 4px;
  }
}
```

---

---

## Performance Optimizations

### Simple Two-Level Display
```typescript
// No recursive component = simpler, faster rendering

// Single page load: fetch all Level 1 replies with their Level 2 children
// API returns: replies[].children = array of Level 2 replies

// Benefits:
// ✅ Single API call per discussion
// ✅ No infinite recursion concerns
// ✅ Easier to paginate (just page Level 1 replies)
// ✅ Better mobile performance
// ✅ Simpler state management

// Level 2 replies pre-fetch optimization:
// GET /api/discussions/:id/posts
// Returns:
// {
//   id: "post-123",
//   content: "...",
//   depth: 0,
//   children: [
//     { id: "post-456", content: "...", depth: 1, parent_reply_id: "post-123" },
//     { id: "post-789", content: "...", depth: 1, parent_reply_id: "post-123" }
//   ]
// }
```

### Pagination Strategy

```typescript
// Only paginate Level 1 (direct replies to post)
// Level 2 replies always fully loaded with their parent

const [currentPage, setCurrentPage] = useState(1);
const REPLIES_PER_PAGE = 10;

// API: GET /api/posts/:id/replies?page=1&limit=10
// Returns first 10 Level 1 replies EACH with their Level 2 children

const handleLoadMore = () => {
  // When user clicks "Load More Replies"
  // Fetch next 10 Level 1 replies (keeping all Level 2 children)
  fetch(`/api/posts/${postId}/replies?page=${currentPage + 1}&limit=10`)
    .then(res => res.json())
    .then(newReplies => {
      setReplies([...replies, ...newReplies]); // Append
      setCurrentPage(currentPage + 1);
    });
};
```

### Caching Strategy

```typescript
// Frontend cache (React Query)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute
      cacheTime: 300000, // 5 minutes
    },
  },
});

// When user posts a reply:
// 1. Optimistic update: immediately show reply
// 2. API call: POST /api/posts/:id/replies
// 3. On success: invalidate discussion query
// 4. Refetch: GET /api/discussions/:id (gets fresh all replies)

// This ensures consistent state without manual cache updates
```

### Database Query Optimization

```typescript
// Get Level 1 replies with children in single query
SELECT r1.* 
FROM discussion_replies r1
WHERE r1.post_id = $1 AND r1.depth = 0
ORDER BY r1.created_at DESC
LIMIT 10;

// Get Level 2 children for each Level 1 reply
SELECT r2.* 
FROM discussion_replies r2
WHERE r2.depth = 1 AND r2.parent_reply_id = ANY($1)
ORDER BY r2.created_at ASC;

// Combine in application layer or use LEFT JOIN if performance critical
SELECT r1.*, 
       json_agg(r2.*) AS children
FROM discussion_replies r1
LEFT JOIN discussion_replies r2 ON r2.parent_reply_id = r1.id AND r2.depth = 1
WHERE r1.post_id = $1 AND r1.depth = 0
GROUP BY r1.id
ORDER BY r1.created_at DESC;
```

---

## Edge Cases Handled

### 1. Deleting a Reply with Children
```typescript
// Option A: Cascade delete (dangerous - loses conversation)
// Option B: Soft delete with tombstone (preferred)

UPDATE discussion_replies 
SET deleted_at = NOW(), content = '[deleted]'
WHERE id = $1;

// Deleted replies still show in thread but marked as [deleted]
// Maintains conversation context
```

### 2. Editing Reply at Max Depth
```typescript
// User can edit their reply at max depth
// They just can't add new children

PUT /api/replies/:replyId {
  content: "Updated comment"
}
// Works fine - only the create endpoint checks depth
```

### 3. Very Long Threads
```typescript
// If a post has 1000+ replies, initial load shows:
// - First 20 top-level replies
// - Each with 5 child replies collapsed
// - "Load more" buttons for expansion

GET /api/posts/:postId/replies?limit=20&offset=0
// Returns paginated results
```

---

## Comparison with Popular Platforms

| Platform | Max Depth | Behavior |
|----------|-----------|----------|
| **Reddit** | 10+ | Deep nesting, collapses UI |
| **Twitter** | 1 | No nesting (flat thread) |
| **YouTube** | 3-4 | Limited nesting, flattens deep replies |
| **HackerNews** | Unlimited | Handles with indentation |
| **Discord** | 1 | Threaded responses (flat) |
| **Our Design (Option 2)** | 2 | Limited depth with flattening, clean, performant ⭐ |

---

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Create `discussion_topics` table (topic lookup)
- [ ] Create `discussion_posts` table (posts in a discussion)
- [ ] Create `discussion_replies` table with depth constraints
- [ ] Create `reply_votes` table for voting
- [ ] Add UNIQUE index: (post_id, depth, parent_reply_id)
- [ ] Add indexes for fast filtering: post_id, user_id, depth
- [ ] Test constraint: depth = 0 OR (depth = 1 AND parent_reply_id IS NOT NULL)

### Phase 2: Backend API
- [ ] POST /api/discussions - Create discussion topic
- [ ] GET /api/discussions/:id - Get discussion with posts
- [ ] POST /api/discussions/:id/posts - Create post
- [ ] POST /api/posts/:id/replies - Create reply (auto-flatten Level 2+)
- [ ] GET /api/posts/:id/replies?page=1&limit=10 - Get paginated replies with children
- [ ] PUT /api/replies/:id - Edit reply
- [ ] POST /api/replies/:id/votes - Vote on reply
- [ ] DELETE /api/replies/:id - Soft delete (set deleted_at)
- [ ] Implement automatic flattening logic in POST /api/posts/:id/replies

### Phase 3: Frontend Components
- [ ] DiscussionBoard.tsx - List discussions
- [ ] DiscussionThread.tsx - Display discussion with posts
- [ ] PostCard.tsx - Display single post
- [ ] ReplyThread.tsx - Non-recursive, flat 2-level display
- [ ] ReplyCard.tsx - Single reply with vote buttons
- [ ] ReplyForm.tsx - Create/edit reply form
- [ ] VoteButtons.tsx - Like/dislike component
- [ ] CSS styling - Reddit-style indentation

### Phase 4: Integration
- [ ] Add Discussion link on MovieDetail page
- [ ] Add user authentication to posts/replies
- [ ] Track comment count in database
- [ ] Add moderation tools (delete, hide, report)
- [ ] Add user profiles with comment history

---

## Option 2 - Final Design Summary

### What We're Building ✅
- **Reddit-style discussions** with max 2 levels of nesting
- **Auto-flattening** when users try to reply to Level 2
- **Simple, performant rendering** with no recursion complexity
- **Mobile-friendly** with clean indentation
- **User-friendly** with notifications when replies flatten

### Key Differentiator
```
When user replies to Level 2 reply:
  Backend: "Hold on, I'll attach this to the Level 1 parent instead"
  Frontend: "Your reply was added to @original_author's thread"
  Result: User understands why their reply appears differently
```

### Why This Works
1. **Prevents infinite nesting** - Common problem in deep threads
2. **Maintains readability** - 2 levels = visual clarity
3. **Simplifies code** - No recursive components
4. **Better performance** - Single query with aggregation
5. **Better UX** - Users expect Reddit-style replies
6. **Scales well** - Works same with 10 or 10,000 replies

### Timeline to Launch
- Phase 1 (Database): 2 hours
- Phase 2 (API): 6-8 hours  
- Phase 3 (Frontend): 8-10 hours
- Phase 4 (Integration): 4-6 hours
- **Total: ~24 hours** (3 days of development)

Ready to implement! 🚀
````
