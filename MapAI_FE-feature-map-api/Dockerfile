# Stage 1: Build the frontend application
FROM node:20-alpine AS build
WORKDIR /app

# Add build argument for API URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the remaining frontend code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine
# Copy the build output from the build stage to Nginx's html folder
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: Add a custom Nginx configuration to handle SPA routing
RUN printf "server {\n    listen 80;\n    location / {\n        root /usr/share/nginx/html;\n        index index.html index.htm;\n        try_files \$uri \$uri/ /index.html;\n    }\n}" > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
