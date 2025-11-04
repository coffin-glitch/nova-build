# Use Node.js 18 as base image
FROM node:18-slim

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy Python requirements and install in virtual environment
COPY requirements.txt ./
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

# Copy the telegram forwarder script from railway-service directory
COPY scripts/telegram_bot_forwarder.py ./scripts/

# Copy the main server file
COPY server.js ./

# Create non-root user
RUN useradd -m -u 1001 railway && chown -R railway:railway /app
USER railway

# Expose port (Railway will set PORT env var, but we expose default for local dev)
EXPOSE 3001

# Health check (uses PORT env var that Railway sets)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the server
CMD ["npm", "start"]
