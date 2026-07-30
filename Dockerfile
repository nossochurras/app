FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ARG VITE_PAGBANK_PUBLIC_KEY
ENV VITE_PAGBANK_PUBLIC_KEY=$VITE_PAGBANK_PUBLIC_KEY

RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
