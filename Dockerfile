FROM node:22-alpine
WORKDIR /app
COPY src ./src
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
USER node
CMD ["node", "src/app.mjs"]
