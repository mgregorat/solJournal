FROM node:18-alpine

# Install Python and build tools for node-gyp
RUN apk add --no-cache python3 make g++ py3-pip

# Set Python environment
ENV PYTHON=/usr/bin/python3

WORKDIR /app

# Copy package files
COPY package*.json ./

# Create comprehensive .npmrc to skip all problematic native builds
RUN echo "optional=false" >> .npmrc && \
    echo "ignore-scripts=true" >> .npmrc && \
    echo "fund=false" >> .npmrc && \
    echo "audit=false" >> .npmrc && \
    echo "save-exact=true" >> .npmrc && \
    echo "legacy-peer-deps=true" >> .npmrc && \
    echo "install-strategy=shallow" >> .npmrc && \
    echo "prefer-offline=true" >> .npmrc

# Set environment variables to skip native builds
ENV npm_config_build_from_source=false
ENV npm_config_cache_max=0
ENV npm_config_optional=false
ENV npm_config_ignore_scripts=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies with maximum skipping
RUN npm config set python python3 && \
    npm config set optional false && \
    npm config set ignore-scripts true && \
    npm config set build-from-source false && \
    npm install --omit=optional --ignore-scripts --no-fund --no-audit --legacy-peer-deps --verbose

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 