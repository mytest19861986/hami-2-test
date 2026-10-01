FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-progress --fetch-retries=5 --fetch-timeout=300000
COPY apps/api/package.json apps/api/package.json
COPY apps/api/src apps/api/src
COPY apps/api/test apps/api/test
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY packages/database/prisma packages/database/prisma
COPY data/reference/iran-geography data/reference/iran-geography
RUN ./node_modules/.bin/prisma generate --schema packages/database/prisma/schema.prisma
COPY eslint.config.mjs eslint.config.mjs
WORKDIR /workspace/apps/api
EXPOSE 4000
CMD ["node","src/main.mjs"]
