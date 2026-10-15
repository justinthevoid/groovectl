FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370
WORKDIR /app
COPY --chown=node:node package.json LICENSE THIRD_PARTY_NOTICES.md SERVER_THIRD_PARTY_LICENSES.txt UI_THIRD_PARTY_LICENSES.txt ./
COPY --chown=node:node dist/cli.js dist/workspace.html ./dist/
USER node
ENV GROOVECTL_DATA=/data
ENV GROOVECTL_PLAYER=none
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["serve", "--profile", "curator"]
