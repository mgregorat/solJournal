# Use Node 18 base image
FROM node:18

# Install dependencies needed by native modules and puppeteer/chromium
RUN apt-get update && \
    apt-get install -y \
    python3 \
    g++ \
    make \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libxfixes3 \
    libasound2 \
    libpangocairo-1.0-0 \
    libx11-xcb1 \
    libxshmfence1 \
    libgbm1 \
    libnss3-tools \
    fonts-liberation \
    libappindicator3-1 \
    libxss1 \
    lsb-release \
    xdg-utils \
    wget \
    ca-certificates

# Set working directory
WORKDIR /app

# Copy files and install
COPY . .
RUN npm install
RUN npm run build

CMD ["npm", "start"] 