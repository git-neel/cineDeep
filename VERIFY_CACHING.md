# ✅ How to Verify Your Cost Savings Are Working

## 🎯 Quick Verification (30 seconds)

### Step 1: Start the Server

```bash
npm run start:local
```

You should see:

```
2:14:02 AM [express] serving on port 3000
```

### Step 2: Open Another Terminal & Test

```bash
# Test 1: Search for a movie
curl -s "http://localhost:3000/api/search?query=Inception" | jq '.[] | {id, title}' | head -3

# Expected output:
# {
#   "id": 27205,
#   "title": "Inception"
# }
```

### Step 3: Watch Server Logs

Look at Terminal 1 (where server is running) and you should see:

```
✅ [CACHE HIT] TMDB movie/27205    ← Caching is working!
```

---

## 📊 Detailed Verification

### Sign #1: Movie Details Return EMPTY Insights

```bash
curl -s "http://localhost:3000/api/title/movie/27205" | jq '.deepDive'
```

**Expected output:**

```json
[]
```

**What this means:** ✅ Insights are NOT auto-generated (saving money!)

---

### Sign #2: Insights Generated on Demand

```bash
curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
  -H "Content-Type: application/json" \
  -d '{"title": "Inception", "synopsis": "A thief steals corporate secrets"}'
```

**Expected:**

- First time: Takes 5-10 seconds (calling OpenAI)
- Server log shows: `🔄 Generating insights for movie/27205...`

**Second request (same movie):**

```bash
curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
  -H "Content-Type: application/json" \
  -d '{"title": "Inception", "synopsis": "A thief steals corporate secrets"}'
```

**Expected:**

- Takes <100ms (instant!)
- Server log shows: `✅ Using cached insights for movie/27205`

**What this means:** ✅ Insights cache is working! Second call was FREE!

---

### Sign #3: Different Movies Have Separate Caches

```bash
# Movie 1
curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
  -H "Content-Type: application/json" \
  -d '{"title": "Inception", "synopsis": "..."}'

# Movie 2 (different movie)
curl -X POST "http://localhost:3000/api/title/movie/550/insights" \
  -H "Content-Type: application/json" \
  -d '{"title": "Fight Club", "synopsis": "..."}'

# Movie 1 again (should use cache)
curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
  -H "Content-Type: application/json" \
  -d '{"title": "Inception", "synopsis": "..."}'
```

**Expected logs:**

```
🔄 Generating insights for movie/27205     (first time)
🔄 Generating insights for movie/550       (first time, different movie)
✅ Using cached insights for movie/27205   (cache hit!)
```

**What this means:** ✅ Each movie cached separately!

---

## 💰 Calculate Your Savings

### In the Server Logs, Count:

```
✅ [CACHE HIT]     = Free API calls (no money spent)
🔄 Generating      = API calls (money spent)
```

### Formula:

```
Cache Hit Rate = Cache Hits / (Cache Hits + API Calls)
Expected Rate: 90%+ (after first day)

Example:
100 total requests
95 cache hits ✅ ($0)
5 API calls 🔄 ($0.05)

Cost: $0.05 instead of $5.00
Savings: 99%! 🎉
```

---

## 🧪 Complete Test Scenario

Run this sequence to fully verify:

```bash
# 1. Simulate 100 users searching for the same movie
for i in {1..10}; do
  echo "Request $i:"
  curl -s "http://localhost:3000/api/title/movie/27205" > /dev/null
done

# 2. Watch server logs - should see mostly [CACHE HIT]

# 3. Simulate users generating insights
for i in {1..5}; do
  echo "Generating insight $i..."
  curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
    -H "Content-Type: application/json" \
    -d '{"title": "Inception", "synopsis": "Test"}' > /dev/null
done

# 4. Watch server logs - should see:
#   - First request: 🔄 Generating
#   - Requests 2-5: ✅ Using cached
```

---

## 📈 What Good Looks Like

### Server Logs After 1 Hour of Testing:

```
[CACHE HIT] TMDB movie/27205
[CACHE HIT] TMDB movie/550
✅ Using cached insights for movie/27205
[CACHE HIT] TMDB movie/278
[CACHED] Insights movie/550
✅ Using cached insights for movie/550
[CACHE HIT] TMDB movie/278
```

**Analysis:**

- ✅ Multiple TMDB cache hits = saving on TMDB API
- ✅ Multiple insight cache hits = saving on OpenAI API
- ✅ Few "Generating" messages = good rate limiting
- ✅ Mix of different movies = working as expected

---

## 🚨 What to Look For If Something's Wrong

### Problem: No [CACHE HIT] messages

**Solution:**

- Is database running? (needed for caching)
- Check: Do you see database connection errors?
- Check: Are there "CACHE MISS" or "cache write error" messages?

### Problem: Insights always slow (5+ seconds)

**Solution:**

- Cache may not be persisting properly
- Check database connection
- Verify table creation: `npm run db:push`

### Problem: Same insights take 5 seconds every time

**Solution:**

- Database caching not working
- Check if OpenAI API key is valid
- Check database for insert errors

---

## ✅ Success Checklist

After running tests, you should see:

- [ ] `[CACHE HIT] TMDB` messages in logs
- [ ] `✅ Using cached insights` messages
- [ ] Movie details endpoint returns empty `deepDive: []`
- [ ] First insights request slow, subsequent ones fast
- [ ] Same movie returns same cached data

---

## 📊 Real-World Metrics

### After 1 Day of Production:

```
Total Requests: 1,000
Cache Hits: 950
API Calls: 50

Cache Rate: 95%
Cost: $0.50 (50 API calls × $0.01 each)
Saved: $9.50 (vs $10 without cache)
```

### After 1 Month:

```
Total Requests: 100,000
Unique Movies: 200
Unique Insights: 150

TMDB API Calls: 200 (only 1 per movie) vs 100,000 without cache
OpenAI API Calls: 150 (only 1 per insight) vs 5,000 without cache

Monthly Cost: ~$2 (vs $50 without cache)
Savings: $48/month 💚
```

---

## 🎉 You're Done!

If you see cache hits and your endpoints are faster, **the cost optimization is working!**

Next steps:

1. Monitor logs in production
2. Track cache hit rate over time
3. Celebrate your cost savings! 🚀

Questions? Check the detailed docs in `TESTING_COST_SAVINGS.md`
