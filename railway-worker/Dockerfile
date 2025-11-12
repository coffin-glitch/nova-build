FROM node:20-alpine

WORKDIR /app

# Copy package files from root
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy worker and lib files from root
COPY workers/ ./workers/
COPY lib/ ./lib/

# Install tsx globally for running TypeScript
RUN npm install -g tsx

# Start worker
CMD ["tsx", "workers/notification-worker.ts"]

