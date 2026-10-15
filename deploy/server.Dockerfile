FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
WORKDIR /app
COPY --chown=node:node package.json LICENSE THIRD_PARTY_NOTICES.md SERVER_THIRD_PARTY_LICENSES.txt UI_THIRD_PARTY_LICENSES.txt ./
COPY --chown=node:node dist/cli.js dist/workspace.html ./dist/
USER node
ENV GROOVECTL_DATA=/data
ENV GROOVECTL_PLAYER=none
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["serve", "--profile", "curator"]
