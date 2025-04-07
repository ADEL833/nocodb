# Use the official Node.js image with glibc instead of Alpine
FROM node:18-slim

# Set working directory
WORKDIR /usr/app

# Install necessary build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

# Set environment variables with default values
ENV APP_DB="sqlite3://sqlite.db" \
    APP_URL="/" \
    APP_AUTH_JWT_SECRET="default-secret-change-me"

# Copy all files from your repository to the container
COPY . .

# Configure pnpm to use the Node.js version that's already installed
RUN echo "use-node-version=18.x" > .npmrc

# Install dependencies using pnpm
RUN pnpm install

# Build the application (if required)
RUN pnpm build

# Set NocoDB environment variables from the build args
ENV NC_DB=${APP_DB} \
    NC_PUBLIC_URL=${APP_URL} \
    NC_AUTH_JWT_SECRET=${APP_AUTH_JWT_SECRET}

# Create directory for persistent data
RUN mkdir -p /usr/app/data

# Expose the port NocoDB runs on
EXPOSE 8080

# Create volume mount point
VOLUME /usr/app/data

# Start NocoDB
CMD ["pnpm", "start"]
