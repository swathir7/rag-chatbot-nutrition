FROM node:22-bookworm-slim

# Install build tools and python for better-sqlite3 native compilation (node-gyp)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHON=/usr/bin/python3

# Create app directory
WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm ci

# Pre-cache the Jina ONNX embedding model inside image for instant cold starts on Render
RUN node -e 'import("@huggingface/transformers").then(m => m.pipeline("feature-extraction", "Xenova/jina-embeddings-v2-small-en", { dtype: "fp32" })).catch(e => console.warn("Prefetch notice:", e.message))'

# Copy the rest of the application
COPY . .

# Build Next.js app
RUN npm run build

# Make start script executable
RUN chmod +x /app/start.sh

# Expose default port
EXPOSE 3000

# Start services
CMD ["/app/start.sh"]

