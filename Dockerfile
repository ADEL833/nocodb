# Use Node.js 18.19.1 as the base image
FROM node:18.19.1-slim

# Set working directory
WORKDIR /usr/app

# Install necessary build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    rsync \
    && rm -rf /var/lib/apt/lists/*

# Set default environment variables
ENV APP_DB="sqlite3://sqlite.db" \
    APP_URL="/" \
    APP_AUTH_JWT_SECRET="default-secret-change-me" \
    NODE_OPTIONS="--max_old_space_size=16384"

# Copy all files from your repository to the container
COPY . .

# Install pnpm
RUN npm install -g pnpm@8.6.0

# Install dependencies
RUN pnpm bootstrap

# Build nc-gui
WORKDIR /usr/app/packages/nc-gui
RUN pnpm run generate

# Copy nc-gui build to nocodb dir
RUN mkdir -p /usr/app/packages/nocodb/docker/nc-gui/ && \
    rsync -rvzh --delete ./dist/ /usr/app/packages/nocodb/docker/nc-gui/

# Build nocodb
WORKDIR /usr/app/packages/nocodb
RUN pnpm run docker:build

# Set NocoDB environment variables
ENV NC_DB=${APP_DB} \
    NC_PUBLIC_URL=${APP_URL} \
    NC_AUTH_JWT_SECRET=${APP_AUTH_JWT_SECRET} \
    NC_TOOL_DIR="/usr/app/data"

# Create directory for persistent data
RUN mkdir -p /usr/app/data

# Expose the port NocoDB runs on
EXPOSE 8080

# Create volume mount point
VOLUME /usr/app/data

# Start NocoDB
CMD ["node", "dist/index.js"]
