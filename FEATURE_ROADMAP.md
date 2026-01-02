# Cine-Seeker Feature Roadmap 2026

## Phase 1: Enhanced Authentication & Email Verification (Priority: HIGH)

### 1.1 Email Verification System
**Current State:** Login exists but no email verification
**Required Changes:**
- Add email verification tokens table
- Send verification emails (SendGrid/Nodemailer)
- Verify email before full access
- Resend verification email option

**Database:**
```sql
-- email_verification_tokens
- id (PK)
- user_id (FK)
- token (unique)
- email (email being verified)
- expires_at
- verified_at
- created_at
```

**Implementation Time:** 3-4 hours
**Files to Modify:** 
- server/routes.ts (new /verify-email endpoint)
- shared/schema.ts (add verification table)
- client/components/LoginModal.tsx

---

## Phase 2: Discussion Platform - "Scene Breakdown" (Priority: HIGH)

### 2.1 Enhanced Discussion Features
**Current State:** Basic topic creation exists
**Required Changes:**

#### Database Schema Updates:
```sql
-- Update discussion_topics
- Add description (what the discussion is about)
- Add view_count
- Add follower_count
- Add is_pinned (moderator feature)

-- discussion_posts (already exists, may need updates)
- Add vote_count
- Add reply_count
- Add is_edited
- Add edited_at

-- discussion_replies (new table - nested comments)
- id (PK)
- post_id (FK)
- parent_reply_id (FK) - for nested replies
- user_id (FK)
- content
- vote_count
- created_at
- edited_at
- deleted_at (soft delete)

-- post_votes (already exists - may rename to interaction_votes)
- post_id (FK)
- user_id (FK)
- value (-1, 0, 1) - dislike, none, like
- created_at
- UNIQUE(post_id, user_id)

-- reply_votes (new table)
- reply_id (FK)
- user_id (FK)
- value (-1, 0, 1)
- created_at
- UNIQUE(reply_id, user_id)
```

#### Frontend Components Needed:
1. **DiscussionThread.tsx** - View/create discussions
2. **PostCard.tsx** - Display individual posts with votes
3. **ReplyThread.tsx** - Nested reply display
4. **VoteButtons.tsx** - Like/dislike UI
5. **ReplyForm.tsx** - Add reply form
6. **DiscussionList.tsx** - List all discussions for a movie

#### New API Endpoints:
```
GET  /api/title/:type/:id/discussions - List all discussions for movie
POST /api/title/:type/:id/discussions - Create new discussion
GET  /api/discussions/:discussionId - Get discussion with posts
POST /api/discussions/:discussionId/posts - Add post to discussion
POST /api/posts/:postId/replies - Add reply to post
POST /api/posts/:postId/votes - Like/dislike post
POST /api/replies/:replyId/votes - Like/dislike reply
PUT  /api/posts/:postId - Edit post (own posts only)
PUT  /api/replies/:replyId - Edit reply (own replies only)
DELETE /api/posts/:postId - Delete post (own/mod only)
DELETE /api/replies/:replyId - Delete reply (own/mod only)
```

**Implementation Time:** 2-3 days
**Complexity:** Medium-High

---

## Phase 3: Subscription & Payment (Priority: MEDIUM)

### 3.1 Subscription Model
**Features:**
- Free Tier: 3 insights/week, full discussion access
- Premium Tier: Unlimited insights, early access features
- Monthly subscription: $4.99/month (recommend)

**Database:**
```sql
-- user_subscription
- id (PK)
- user_id (FK)
- stripe_customer_id
- stripe_subscription_id
- plan_type ('free' | 'premium')
- started_at
- expires_at
- status ('active' | 'cancelled' | 'past_due')
- billing_period_end
- created_at

-- insights_quota (update from user_insight_quota)
- user_id (PK)
- insights_generated_this_week
- weekly_limit (3 for free, unlimited for premium)
- week_start_date
- updated_at
```

#### Integration Points:
1. **Stripe Integration**
   - Create Checkout Session
   - Webhook handling (payment.success, subscription.updated)
   - Customer portal for management

2. **New Routes:**
   ```
   POST /api/subscription/checkout - Create Stripe session
   POST /api/subscription/webhook - Stripe webhook
   GET /api/subscription/status - Check user subscription
   POST /api/subscription/cancel - Cancel subscription
   GET /api/subscription/plans - List available plans
   ```

3. **Frontend:**
   - Pricing page
   - Subscription management
   - Paywall for insights

**Implementation Time:** 3-4 days
**External Dependencies:** Stripe API

---

## Phase 4: SEO & Search Optimization (Priority: MEDIUM)

### 4.1 Schema.org & Meta Tags
**Goal:** Make movie pages discoverable for searches like:
- "Housefull 2 hidden meaning"
- "easter egg in Housefull 2"
- "Housefull 2 trivia"
- "best scenes in Housefull 2"

**Implementation:**

1. **Dynamic Meta Tags** (in MovieDetail.tsx):
   ```typescript
   // Open Graph
   <meta property="og:title" content="Housefull 2 - Hidden Meanings & Easter Eggs" />
   <meta property="og:description" content="4 hidden insights, 2 easter eggs, and film analysis" />
   <meta property="og:image" content={backdropUrl} />
   <meta property="og:type" content="movie" />
   
   // Twitter Card
   <meta name="twitter:card" content="summary_large_image" />
   <meta name="twitter:title" content="Housefull 2 Analysis" />
   
   // Search
   <meta name="description" content="Discover hidden meanings, easter eggs, and analysis of Housefull 2. Join cinema lovers in discussions." />
   <meta name="keywords" content="Housefull 2, movie analysis, hidden meanings, easter eggs, cinema" />
   ```

2. **Schema.org Markup** (JSON-LD):
   ```json
   {
     "@context": "https://schema.org",
     "@type": "Movie",
     "name": "Housefull 2",
     "identifier": "85052",
     "description": "Hidden insights and community discussions",
     "aggregateRating": {
       "@type": "AggregateRating",
       "ratingValue": "7.5",
       "bestRating": "10",
       "ratingCount": "1234"
     },
     "keywords": "hidden meanings, easter eggs, analysis, discussion",
     "url": "https://cineseeker.com/title/movie/85052"
   }
   ```

3. **Sitemap Generation** (sitemap.xml):
   - Auto-generate for all movies in database
   - Update weekly

4. **Robots.txt** (for crawlers):
   ```
   User-agent: *
   Allow: /title/
   Disallow: /api/
   Sitemap: https://cineseeker.com/sitemap.xml
   ```

5. **URL Structure** (already good):
   - `/title/movie/85052` - Good for SEO
   - Add canonical tags to prevent duplicates

6. **Content Optimization:**
   - Page titles: "{Movie} - Hidden Meanings, Easter Eggs & Analysis | Cine-Seeker"
   - Descriptions with insights summary
   - H1-H6 tags properly structured
   - Rich snippets for ratings

**Implementation Time:** 1-2 days
**Tools:** 
- react-helmet for meta tags
- next-seo or similar

---

## Phase 5: Real-time Features (Priority: LOW - Future)

### 5.1 Live Discussions
**Technologies:**
- WebSocket (Socket.io)
- Real-time post updates
- User presence indicators
- Live notifications

**Not critical for MVP**

---

## Implementation Order (Recommended)

```
Week 1:
├── Phase 1: Email Verification (3-4 hours)
├── Phase 3.1: Subscription DB Schema (2 hours)
└── Phase 4: SEO Optimization (1-2 days)

Week 2-3:
├── Phase 2: Full Discussion Platform (2-3 days)
├── Phase 3.2: Stripe Integration (2-3 days)
└── Testing & Bug Fixes (1 day)
```

---

## Database Schema Summary

**New Tables Required:**
1. `email_verification_tokens`
2. `discussion_replies` (nested comments)
3. `reply_votes`
4. `user_subscription`
5. `insights_quota` (modified from user_insight_quota)

**Modified Tables:**
1. `discussion_topics` (add description, view_count, follower_count)
2. `discussion_posts` (add vote_count, reply_count, is_edited)
3. `users` (add subscription_status, email_verified)

---

## Cost Impact

### Estimated Monthly Costs:
- **Current:** $100-150 (TMDB + OpenAI)
- **With Subscriptions:** -$50-100 (offset by revenue)
- **Additional Services:**
  - Stripe: 2.9% + $0.30 per transaction
  - Email (SendGrid/Nodemailer): $0-20/month
  - Database (PostgreSQL): no change if Railway used

### Revenue Potential:
- 1000 users × 10% conversion × $4.99 = **$500/month**
- Offset API costs completely
- Profitable at 5% conversion rate

---

## Success Metrics

1. **SEO:**
   - Organic traffic to movie pages
   - Google Search Console ranking improvements
   - Target: Page 1 for "{Movie} hidden meanings"

2. **Engagement:**
   - Discussion creation rate
   - Reply ratio
   - User retention (weekly active users)

3. **Conversion:**
   - Subscription sign-up rate (target: 5-10%)
   - Email verification rate (target: 80%+)
   - Discussion participation (target: 30%+ of users)

4. **Technical:**
   - API response time <500ms (cached)
   - 99.9% uptime
   - No database errors in logs
