.PHONY: build run dev test test-ui clean frontend

# Build the application
build:
	cd web && npm run build
	CGO_ENABLED=1 go build -o bin/todo-app cmd/server/main.go

# Run the server
run:
	CGO_ENABLED=1 go run cmd/server/main.go

# Run with custom config
run-config:
	CGO_ENABLED=1 go run cmd/server/main.go -config=config.yaml

# Development mode (frontend + backend)
dev:
	@echo "Starting development server..."
	@make -j2 dev-frontend dev-backend

dev-frontend:
	cd web && npm run dev

dev-backend:
	air -c .air.toml

# Run tests
test:
	CGO_ENABLED=1 go test -v ./...

test-ui:
	cd web && npm run test:ui

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf web/dist/
	rm -f todo.db

# Install dependencies
deps:
	go mod download
	cd web && npm install

# Create release build for multiple platforms
release:
	mkdir -p bin
	CGO_ENABLED=1 go build -ldflags="-s -w" -o bin/todo-app-$$(go env GOOS)-$$(go env GOARCH) cmd/server/main.go

# Frontend commands
frontend-install:
	cd web && npm install

frontend-build:
	cd web && npm run build

frontend-dev:
	cd web && npm run dev

# Database
db-reset:
	rm -f todo.db
	CGO_ENABLED=1 go run cmd/server/main.go

# Docker
docker-build:
	docker build -t todo-app:latest .

docker-run:
	docker run -p 8080:8080 -v $(PWD)/data:/app/data todo-app:latest
