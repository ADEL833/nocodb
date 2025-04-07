# Use Node.js 18.19.1 specifically (meets the project requirements)
FROM node:18.19.1-slim

# Set working directory
WORKDIR /usr/app

# Install necessary build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set default environment variables
ENV APP_DB="sqlite3://sqlite.db" \
    APP_URL="/" \
    APP_AUTH_JWT_SECRET="default-secret-change-me" \
    NODE_ENV="production" \
    NC_TOOL_DIR="/usr/app/data"

# Copy all files from your repository to the container
COPY . .

# Install pnpm with a specific version
RUN npm install -g pnpm@8.6.0

# Create a .npmrc file to disable node version check
RUN echo "node-version=18.19.1" > .npmrc && \
    echo "engine-strict=false" >> .npmrc

# Install missing dependencies explicitly
RUN cd packages/nocodb && pnpm add \
    bignumber.js \
    fast-deep-equal \
    moment \
    stream-json \
    deep-object-diff \
    node-machine-id

# Bootstrap the project (install dependencies and build packages)
RUN pnpm bootstrap

# Build the packages in the correct order
RUN cd packages/nocodb-sdk && pnpm build && \
    cd ../nc-gui && pnpm build && \
    cd ../nocodb && pnpm build

# Set NocoDB environment variables
ENV NC_DB=${APP_DB} \
    NC_PUBLIC_URL=${APP_URL} \
    NC_AUTH_JWT_SECRET=${APP_AUTH_JWT_SECRET}

# Create directory for persistent data
RUN mkdir -p /usr/app/data

# Expose the port NocoDB runs on
EXPOSE 8080

# Create volume mount point
VOLUME /usr/app/data

# Start NocoDB in production mode
CMD ["node", "packages/nocodb/dist/index.js"]
