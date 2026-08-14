FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install sudo, curl, git and update
RUN apt-get update && \
    apt-get install -y sudo curl git && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js (v20+ recommended)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
    sudo apt-get install -y nodejs

# Install PM2 globally
RUN sudo npm install -g pm2

# Setup Project Directory
WORKDIR /root/Career-Manager

# Copy dependencies definitions
COPY package.json package-lock.json* ./

# Install Project Dependencies
RUN npm install

# Install Playwright browsers and their system dependencies
RUN npx playwright install chromium --with-deps

# Copy all other project files
COPY . .

# Build the project
RUN npm run build

# Expose the server port
EXPOSE 3000

# Start with PM2
CMD ["pm2-runtime", "start", "npm", "--name", "career-manager", "--", "start"]
