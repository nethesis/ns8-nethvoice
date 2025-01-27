FROM docker.io/library/node:18.15.0 as ui_builder
WORKDIR /app
# install deps
COPY ui/package.json .
COPY ui/yarn.lock .
RUN yarn install --frozen-lockfile
# copy application
COPY ui/public public
COPY ui/src src
COPY ui/.browserslistrc .
COPY ui/.eslintrc.js .
COPY ui/babel.config.js .
COPY ui/vue.config.js .
# build application
ENV NODE_OPTIONS=--openssl-legacy-provider
RUN yarn build

FROM scratch as dist
# copy imageroot
COPY imageroot /imageroot
# copy ui from ui_builder
COPY --from=ui_builder /app/dist /ui
ENTRYPOINT [ "/" ]
LABEL org.nethserver.authorizations="traefik@any:fulladm node:fwadm nethvoice-proxy@any:routeadm"
LABEL org.nethserver.tcp-ports-demand="31"
LABEL org.nethserver.rootfull="0"
ARG REPOBASE=ghcr.io/nethserver
ARG IMAGETAG=latest
LABEL org.nethserver.images="${REPOBASE}/nethvoice-mariadb:${IMAGETAG} \
    ${REPOBASE}/nethvoice-freepbx:${IMAGETAG} \
    ${REPOBASE}/nethvoice-cti-server:${IMAGETAG} \
    ${REPOBASE}/nethvoice-cti-ui:${IMAGETAG} \
    ${REPOBASE}/nethvoice-tancredi:${IMAGETAG} \
    ${REPOBASE}/nethvoice-janus:${IMAGETAG} \
    ${REPOBASE}/nethvoice-phonebook:${IMAGETAG} \
    docker.io/library/redis:7.0.10-alpine \
    ${REPOBASE}/nethvoice-reports-ui:${IMAGETAG} \
    ${REPOBASE}/nethvoice-reports-api:${IMAGETAG} \
    ${REPOBASE}/nethvoice-sftp:${IMAGETAG}"
