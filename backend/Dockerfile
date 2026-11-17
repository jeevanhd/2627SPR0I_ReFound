# ReFound API — runtime image.
# Slim base + production dependencies only + a tight build context (.dockerignore).
# Build:  docker build -t sprint-service:local backend
FROM node:20.18.1-alpine3.20

WORKDIR /app
ENV NODE_ENV=production

# Pinned dependency file first, so this layer is cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Only what the server needs at run time: code, the schema (npm run db:init), and the
# staff seed script. Tests, docs and .env stay out — see .dockerignore.
COPY src ./src
COPY db ./db
COPY scripts ./scripts

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
