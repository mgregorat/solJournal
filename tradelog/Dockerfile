FROM node:18-alpine

# Install Python and build tools
RUN apk add --no-cache python3 make g++ py3-pip

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

# Install all dependencies (including devDependencies)
RUN npm install --no-optional --no-fund --no-audit || \
    (echo "Retrying with scripts disabled..." && \
     npm install --no-optional --ignore-scripts --no-fund --no-audit)

# Explicitly install critical build dependencies to ensure they're available
RUN npm install autoprefixer postcss tailwindcss --no-save || echo "Build dependencies already installed"

# Copy source code and configuration files
COPY tradelog/src ./src
COPY tradelog/public ./public
COPY tradelog/next.config.mjs ./
COPY tradelog/tailwind.config.mjs ./
COPY tradelog/tsconfig.json ./
COPY tradelog/components.json ./
COPY tradelog/eslint.config.mjs ./

# Create a minimal PostCSS config in the container
RUN echo "module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }" > postcss.config.js

# Set build-time environment variables from Railway
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_PRIVY_APP_ID=${NEXT_PUBLIC_PRIVY_APP_ID}
ENV NEXT_PUBLIC_SOLANA_RPC_URL=${NEXT_PUBLIC_SOLANA_RPC_URL}
ENV NEXT_PUBLIC_HELIUS_API_KEY=${NEXT_PUBLIC_HELIUS_API_KEY}

# Set NODE_ENV to production only after installation
ENV NODE_ENV=production

# Debug: Check if autoprefixer is installed and working
RUN echo "=== DEBUGGING AUTOPREFIXER ===" && \
    echo "1. Checking npm list:" && \
    npm list autoprefixer postcss tailwindcss || echo "Some packages not found in npm list" && \
    echo "2. Checking node_modules directories:" && \
    ls -la node_modules/ | grep -E "(autoprefixer|postcss|tailwindcss)" && \
    echo "3. Checking if packages can be required:" && \
    node -e "try { require('autoprefixer'); console.log('✓ autoprefixer OK'); } catch(e) { console.log('✗ autoprefixer ERROR:', e.message); }" && \
    node -e "try { require('postcss'); console.log('✓ postcss OK'); } catch(e) { console.log('✗ postcss ERROR:', e.message); }" && \
    node -e "try { require('tailwindcss'); console.log('✓ tailwindcss OK'); } catch(e) { console.log('✗ tailwindcss ERROR:', e.message); }" && \
    echo "4. Checking PostCSS config files:" && \
    ls -la postcss.config.* && \
    echo "5. Testing PostCSS config:" && \
    node -e "try { const config = require('./postcss.config.js'); console.log('✓ PostCSS config OK:', Object.keys(config.plugins)); } catch(e) { console.log('✗ PostCSS config ERROR:', e.message); }"

# Debug: List directory contents
RUN echo "Contents of /app:" && ls -la /app && \
    echo "Contents of /app/src:" && ls -la /app/src && \
    echo "Contents of /app/src/app:" && ls -la /app/src/app

# Build the application with verbose output
RUN npm run build --verbose || (echo "Build failed, showing more info:" && npm run build)

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 