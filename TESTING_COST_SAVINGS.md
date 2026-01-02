# 🧪 Cost Savings Testing Guide

## ✅ Test 1: Cache Hit Detection (TMDB API Caching)

### What to Test:
- First call hits TMDB API
- Second call gets cached response
- Network request time comparison

### How to Test (in 2 terminals):

**Terminal 1: Start the server**
```bash
npm run start:local
```

**Terminal 2: Test API calls**

```bash
# Test 1: Search for a movie (first call - hits TMDB API)
curl -s "http://localhost:3000/api/search?query=Inception" | jq '.[] | {id, title}' | head -20

# Wait 2 seconds
sleep 2

# Test 2: Get movie details (first call - hits TMDB API)
curl -s "http://localhost:3000/api/title/movie/27205" | jq '{id, title, year}' 

# Wait 5 seconds for cache to be written
sleep 5

# Test 3: Get same movie details again (SHOULD BE CACHED)
time curl -s "http://localhost:3000/api/title/movie/27205" | jq '{id, title, year}'
```

### Expected Output:
```
✅ First call: SLOWER (fresh from TMDB API)
✅ Second call: FASTER (from cache, ~50-70% faster)
✅ Server logs show: "[CACHE HIT] TMDB movie/27205"
```

---

## ✅ Test 2: Insights Lazy Loading (On-Demand Generation)

### What Changed:
- **Before:** Insights auto-generated (costly)
- **After:** Insights generated only when requested (saves money)

### How to Test:

```bash
# Test 1: Get movie details (insights should be empty)
curl -s "http://localhost:3000/api/title/movie/27205" | jq '.deepDive'

# Output should be: [] (empty array)
# This proves insights are NOT auto-generated ✅

# Test 2: Explicitly request insights (generates once)
curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Inception",
    "synopsis": "A thief who steals corporate secrets..."
  }' | jq '.[] | {type, title}'

# This will take 5-10 seconds (calling OpenAI)
# Server logs show: "🔄 Generating insights for movie/27205..."
# Then: "✅ Generated and cached insights for movie/27205"

# Test 3: Request same insights again (should be CACHED)
time curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Inception",
    "synopsis": "A thief who steals corporate secrets..."
  }' | jq '.[] | {type, title}'

# Should be INSTANT (< 100ms)
# Server logs show: "✅ Using cached insights for movie/27205"
```

### Expected Results:
```
❌ BEFORE: /api/title always generated insights (EXPENSIVE)
✅ AFTER: 
  - Movie details: instant, no insights
  - Insights endpoint: generate once, cache forever
  - Second call: instant from cache
  - Cost: 1 OpenAI call per movie (not per user!)
```

---

## ✅ Test 3: Rate Limiting (Saves Money by Preventing Abuse)

### How to Test:

```bash
# Create a test user session (you'll need a userId)
# For now, test the endpoint structure:

# First 5 insights (allowed)
for i in {1..5}; do
  echo "Request $i:"
  curl -X POST "http://localhost:3000/api/title/movie/$((27205+i))/insights" \
    -H "Content-Type: application/json" \
    -H "x-session-id: test-user-123" \
    -d '{
      "title": "Movie '$i'",
      "synopsis": "Test"
    }' | jq '.error // .[] | .title'
done

# Request 6 (should fail with rate limit)
echo "Request 6 (should be blocked):"
curl -X POST "http://localhost:3000/api/title/movie/27211/insights" \
  -H "Content-Type: application/json" \
  -H "x-session-id: test-user-123" \
  -d '{
    "title": "Movie 6",
    "synopsis": "Test"
  }' | jq '.error'
```

### Expected Output:
```
Request 1-5: ✅ Insights generated
Request 6: ❌ "Daily insight limit reached (5 per day)"
```

---

## 📊 How to Monitor Cost Savings

### Check Server Logs for Cache Hits:

```
✅ CACHE HIT messages = Money saved!
❌ 🔄 Generating = OpenAI API call (costs $$)

Log patterns:
[CACHE HIT] TMDB movie/27205       → TMDB API saved
[CACHE HIT] Insights movie/27205   → OpenAI API saved
[CACHED] TMDB movie/27205          → Successfully stored cache
🔄 Generating insights for movie   → API call being made
✅ Generated and cached insights    → Successfully cached
```

---

## 💰 Verify Cost Reductions

### Count API Calls in Logs:

```bash
# Run the server for a test session, then:

# Count OpenAI API calls (search for "🔄 Generating")
grep "🔄 Generating" server.log | wc -l

# Count cache hits (search for "[CACHE HIT]")
grep "CACHE HIT" server.log | wc -l

# If cache hits >> API calls = SUCCESS! ✅
```

### Expected Ratio After Caching:
```
Without Caching:
- 100 users request Inception
- 100 OpenAI API calls (100% cost)

With Caching:
- 100 users request Inception
- 1 OpenAI API call (99% savings!)
- 99 cache hits
```

---

## 🧪 Quick Test Script

Save as `test-caching.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Cache Implementation"
echo "================================"

# Test 1: TMDB Cache
echo -e "\n1️⃣  Testing TMDB Cache..."
echo "First call (should be slow):"
time curl -s "http://localhost:3000/api/title/movie/27205" > /dev/null

echo -e "\nSecond call (should be instant):"
time curl -s "http://localhost:3000/api/title/movie/27205" > /dev/null

# Test 2: Insights (lazy loading)
echo -e "\n2️⃣  Testing Insights Lazy Loading..."
echo "Movie details without insights:"
curl -s "http://localhost:3000/api/title/movie/27205" | jq '.deepDive'

echo -e "\n3️⃣  Requesting insights (will call OpenAI)..."
time curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
  -H "Content-Type: application/json" \
  -d '{"title": "Inception", "synopsis": "Thieves steal secrets"}' > /dev/null

echo -e "\n4️⃣  Getting cached insights (should be instant)..."
time curl -X POST "http://localhost:3000/api/title/movie/27205/insights" \
  -H "Content-Type: application/json" \
  -d '{"title": "Inception", "synopsis": "Thieves steal secrets"}' > /dev/null

echo -e "\n✅ Testing complete!"
```

Run it:
```bash
chmod +x test-caching.sh
./test-caching.sh
```

---

## ✅ Checklist: Signs Caching is Working

- [ ] Second API call is faster than first
- [ ] Server logs show "[CACHE HIT]" messages
- [ ] Movie details return empty `deepDive: []`
- [ ] Insights endpoint generates once, then uses cache
- [ ] Different movies cached separately
- [ ] Cache persists across requests

---

## 🚨 Troubleshooting

### Database not running
```bash
# Make sure PostgreSQL is installed and running
# If local DB missing, comment out database-dependent features for now

# Check if PostgreSQL is running:
pg_isready
```

### Cache not working
```bash
# Check if cache.ts is being imported:
grep "cache" server/routes.ts

# Verify cache functions are called:
# Look for [CACHE HIT] or 🔄 Generating in logs
```

### Too slow
- Cache writes happen async
- Wait 2-3 seconds between calls for cache to persist
- Check database connection first

---

## 📈 Expected Metrics After Optimization

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Requests to OpenAI | 1 per user | 1 per movie | **90%+** |
| Requests to TMDB | Every time | Every 30 days | **95%+** |
| Cost per 1000 users | $10-20 | $1-2 | **80-90%** |

