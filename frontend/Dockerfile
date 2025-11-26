FROM nginx:alpine

# Install tools for testing (curl, ping, nc)
RUN apk update && apk add --no-cache curl iputils netcat-openbsd

# Replace default index.html with our own
COPY index.html /usr/share/nginx/html/index.html


