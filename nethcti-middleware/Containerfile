# Use Go as base image for building
FROM docker.io/golang:1.26-alpine3.22 AS builder

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Download dependencies
RUN go mod download

# Build the Go application
RUN go build -o whale

FROM docker.io/alpine:3.24 AS runtime

# Set working directory
WORKDIR /app

# Install oathtool in the runtime image.
# Keep compatibility within 2.6.x across Alpine patch updates.
RUN apk --no-cache add oath-toolkit-oathtool=~2.6

# Copy the built binary from the builder stage
COPY --from=builder /app/whale .

# Expose the service port (based on your configuration)
EXPOSE 8080

# Run the binary (fix the command format)
CMD ["./whale"]
