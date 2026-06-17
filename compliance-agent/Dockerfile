# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files and public
COPY dist ./dist
COPY public ./public
COPY Compliance_agent_template.xlsx ./
COPY .env.production ./

# Expose port (AgentBase expects 8080)
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]