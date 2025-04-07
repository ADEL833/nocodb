# Use the official Node.js image as the base image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/app

# Install necessary build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy all files from your repository to the container
COPY . .

# Install dependencies
RUN npm install

# Build the application (if required)
RUN npm run build

# Set environment variables
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
CMD ["npm", "start"]
