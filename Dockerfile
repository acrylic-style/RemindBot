FROM node:18.12.0 AS Builder

WORKDIR /app

# fetch packages
COPY package*.json ./
COPY yarn.lock ./
RUN yarn

FROM node:18.12.0-alpine AS Runner

WORKDIR /app

COPY --from=Builder /app/package.json ./
COPY --from=Builder /app/node_modules/ ./node_modules/
COPY index.js ./
COPY .env.example ./

CMD ["yarn", "start"]
