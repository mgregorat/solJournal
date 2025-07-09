FROM node:18-alpine

# Install Python and build tools
RUN apk add --no-cache python3 make g++ py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./

# Set environment variables for npm and node-gyp
ENV npm_config_python=/usr/bin/python3
ENV npm_config_node_gyp_python=/usr/bin/python3
ENV npm_config_build_from_source=false
ENV npm_config_optional=false
ENV npm_config_ignore_scripts=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production
ENV PYTHON=/usr/bin/python3

# Install all dependencies (including devDependencies needed for build)
RUN npm install --no-optional --ignore-scripts --no-fund --no-audit || \
    (echo "Retrying with scripts enabled..." && \
     npm install --no-optional --no-fund --no-audit)

# Copy source code and configuration files
COPY src ./src
COPY public ./public
COPY next.config.mjs ./
COPY tailwind.config.mjs ./
COPY postcss.config.mjs ./
COPY tsconfig.json ./
COPY components.json ./
COPY eslint.config.mjs ./

# Debug: List directory contents
RUN echo "Contents of /app:" && ls -la /app && \
    echo "Contents of /app/src:" && ls -la /app/src && \
    echo "Contents of /app/src/app:" && ls -la /app/src/app

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 