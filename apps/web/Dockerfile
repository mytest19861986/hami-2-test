FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-progress --fetch-retries=5 --fetch-timeout=300000
COPY apps/web/package.json apps/web/package.json
COPY apps/web/pages apps/web/pages
COPY apps/web/lib apps/web/lib
COPY apps/web/components apps/web/components
COPY apps/web/styles.css apps/web/styles.css
COPY apps/web/public apps/web/public
COPY apps/web/test apps/web/test
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY scripts scripts
COPY eslint.config.mjs eslint.config.mjs
WORKDIR /workspace/apps/web
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
