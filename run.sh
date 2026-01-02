#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
  echo "✅ Loaded environment from .env.local"
else
  echo "❌ .env.local not found"
  exit 1
fi

# Check if required variables are set
if [ -z "$TMDB_API_KEY" ] || [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ Missing required API keys in .env.local"
  echo "   Required: TMDB_API_KEY, OPENAI_API_KEY"
  exit 1
fi

echo "🔨 Building app..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "🚀 Starting server on port ${PORT:-3000}..."
npm start
