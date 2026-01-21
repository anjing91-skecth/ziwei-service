FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Optional: allow embedded bazi binary if needed
RUN chmod +x bazi-go/bazi-go || true

ENV NODE_ENV=production
CMD ["npm", "start"]
