FROM node:20-alpine

WORKDIR /usr/src/app

# Debug: Show build context contents
RUN echo "=== Build Context Contents ==="
RUN ls -la

# Copy package.json
COPY backend/package.json ./

# Debug: Show after package.json copy
RUN echo "=== After package.json copy ==="
RUN ls -la

# Install dependencies
RUN npm install

# Copy backend directory
COPY backend/ ./

# Debug: Show final contents
RUN echo "=== Final Contents ==="
RUN ls -la

EXPOSE 8080

CMD ["npm", "start"]
