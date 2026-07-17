FROM node:20-alpine

WORKDIR /app

# Copy only what we need for dependency install first (better layer caching)
COPY backend/package*.json ./backend/

RUN cd backend && npm ci --omit=dev

# Copy app source
COPY backend ./backend
COPY frontend ./frontend

# Expose the port the app listens on
EXPOSE 5050

# Ensure host binding for container
ENV HOST=0.0.0.0
ENV PORT=5050

CMD ["node", "backend/server.js"]

