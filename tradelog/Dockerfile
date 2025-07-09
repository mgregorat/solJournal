FROM node:18-alpine

# Install Python and build tools for node-gyp
RUN apk add --no-cache python3 make g++ py3-pip

# Set Python environment
ENV PYTHON=/usr/bin/python3

WORKDIR /app

# Copy package files
COPY package*.json ./

# Configure npm to use python3 and install dependencies
RUN npm config set python python3 && \
    npm ci --only=production --ignore-scripts --no-optional

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 