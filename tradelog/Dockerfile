FROM node:18-alpine

# Install Python and build tools for node-gyp
RUN apk add --no-cache python3 make g++ py3-pip

# Set Python environment
ENV PYTHON=/usr/bin/python3

WORKDIR /app

# Copy package files
COPY package*.json ./

# Set environment variables to skip native builds
ENV npm_config_build_from_source=false
ENV npm_config_optional=false
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

# Install dependencies allowing necessary scripts but skipping optional native modules
RUN npm config set python /usr/bin/python3 && \
    npm config set node_gyp_python /usr/bin/python3 && \
    npm ci --production --no-optional --no-fund --no-audit

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 