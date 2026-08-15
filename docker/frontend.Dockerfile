FROM node:22-alpine
WORKDIR /app
EXPOSE 5173
CMD ["node", "node_modules/vite/bin/vite.js", "--host", "0.0.0.0"]
