FROM node:18-alpine

# Install Python and build tools for node-gyp
RUN apk add --no-cache python3 make g++ py3-pip

# Set Python environment
ENV PYTHON=/usr/bin/python3

WORKDIR /app

# Copy package files
COPY package*.json ./

# Create .npmrc to skip optional dependencies and scripts
RUN echo "optional=false" >> .npmrc && \
    echo "ignore-scripts=true" >> .npmrc && \
    echo "fund=false" >> .npmrc && \
    echo "audit=false" >> .npmrc

# Configure npm and install dependencies with aggressive skipping
RUN npm config set python python3 && \
    npm config set optional false && \
    npm config set ignore-scripts true && \
    npm install --production --no-optional --ignore-scripts --no-fund --no-audit --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 