FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

FROM deps AS builder

COPY . .

RUN npm run build \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Chromium is required by the server-side PDF export.
RUN apt-get update && apt-get install -y \
    chromium \
    fontconfig \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm-dev \
    libgbm-dev \
    libglapi-mesa \
    libxkbcommon-x11-0 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxshmfence-dev \
    libxshmfence1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV UNIFIL_PDF_BROWSER=/usr/bin/chromium

RUN mkdir -p /app/data /app/public/uploads /app/public/gabaritos

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]
