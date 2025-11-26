FROM alpine:3.19

# Install tools: nmap for scanning, curl for HTTP probing
RUN apk update && apk add --no-cache nmap curl

WORKDIR /app

# Copy the attack script into the container
COPY attack.sh .

RUN chmod +x attack.sh

# Keep the container running; we'll exec in and run attacks on demand
CMD ["sleep", "infinity"]

