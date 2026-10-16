# The stdio MCP server, with its sign-in page on 8765. See docs/HOSTING.md.
FROM docker.io/library/node:22.22.0-bookworm-slim

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CLALIT_CONFIG_DIR=/data \
    CLALIT_LOGIN_HOST=0.0.0.0

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/mcp/package.json packages/mcp/
# Dev dependencies too: the server runs its TypeScript through tsx, and the
# sign-in warms Clalit's Imperva cookies in Playwright's Chromium first, as it
# does on a desktop.
RUN npm ci --include=dev \
 && npx playwright install --with-deps chromium \
 && npm cache clean --force \
 && rm -rf /var/lib/apt/lists/*

COPY packages packages
COPY tsconfig.json ./

# Any user works; give it a writable /data.
USER 1000:1000
EXPOSE 8765
ENTRYPOINT ["node", "--import", "tsx", "packages/cli/src/main.ts", "mcp"]
