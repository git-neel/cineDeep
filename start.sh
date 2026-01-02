#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

# Start the server
npm start
