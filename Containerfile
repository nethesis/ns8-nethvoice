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
LABEL org.nethserver.authorizations="traefik@any:routeadm node:fwadm"
LABEL org.nethserver.tcp-ports-demand="4027"
LABEL org.nethserver.udp-ports-demand="4027"
LABEL org.nethserver.rootfull="0"
ARG REPOBASE=ghcr.io/nethserver
ARG IMAGETAG=latest
LABEL org.nethserver.images="${REPOBASE}/nethvoice-mariadb:${IMAGETAG} \
    ${REPOBASE}/nethvoice-freepbx:${IMAGETAG} \
    ${REPOBASE}/nethvoice-asterisk:${IMAGETAG} \
    ${REPOBASE}/nethvoice-cti-server:${IMAGETAG} \
    ${REPOBASE}/nethvoice-cti-ui:${IMAGETAG} \
    ${REPOBASE}/nethvoice-tancredi:${IMAGETAG} \
    ${REPOBASE}/nethvoice-janus:${IMAGETAG} \
    ${REPOBASE}/nethvoice-phonebook:${IMAGETAG}"
