FROM node:18-alpine

# Install Python, build tools, and Chromium for Puppeteer
RUN apk add --no-cache chromium python3 make g++ py3-pip nss freetype harfbuzz ca-certificates ttf-freefont

WORKDIR /app

# Copy package files
COPY tradelog/package*.json ./

# Set environment variables for npm and node-gyp
ENV npm_config_python=/usr/bin/python3
ENV npm_config_node_gyp_python=/usr/bin/python3
ENV npm_config_build_from_source=false
ENV npm_config_optional=false
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PYTHON=/usr/bin/python3

# Install ALL dependencies including devDependencies (needed for build)
RUN npm ci --no-optional --no-fund --no-audit || \
    (echo "npm ci failed, trying npm install..." && \
     npm install --no-optional --no-fund --no-audit)

# Copy source code and configuration files
COPY tradelog/src ./src
COPY tradelog/public ./public
COPY tradelog/next.config.mjs ./
COPY tradelog/tailwind.config.mjs ./
COPY tradelog/tsconfig.json ./
COPY tradelog/components.json ./
COPY tradelog/eslint.config.mjs ./

# Create postcss.config.js to ensure autoprefixer is properly configured
RUN echo "module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }" > postcss.config.js

# Declare build-time arguments passed from railway.json
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_HELIUS_API_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SOLANA_RPC_URL
ARG SUPABASE_SERVICE_KEY
ARG HELIUS_API_KEY
ARG CRON_SECRET
ARG BIRDEYE_API_KEY

# Set these arguments as environment variables so they are available to the build process
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_HELIUS_API_KEY=$NEXT_PUBLIC_HELIUS_API_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SOLANA_RPC_URL=$NEXT_PUBLIC_SOLANA_RPC_URL
ENV SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
ENV HELIUS_API_KEY=$HELIUS_API_KEY
ENV CRON_SECRET=$CRON_SECRET
ENV BIRDEYE_API_KEY=$BIRDEYE_API_KEY

# Set NODE_ENV to production for the build
ENV NODE_ENV=production

# Verify critical dependencies are installed
RUN echo "=== VERIFYING BUILD DEPENDENCIES ===" && \
    npm list autoprefixer postcss tailwindcss && \
    echo "✓ All build dependencies verified" || \
    (echo "✗ Missing dependencies, attempting to install..." && \
     npm install autoprefixer postcss tailwindcss --no-save)

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 