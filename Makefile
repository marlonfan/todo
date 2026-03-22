.PHONY: build run dev test test-ui clean frontend

# Build the application
build:
	cd web && npm run build
	go build -o bin/todo-app cmd/server/main.go

# Run the server
run:
	go run cmd/server/main.go

# Run with custom config
run-config:
	go run cmd/server/main.go -config=config.yaml

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
	go test -v ./...

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
	# Linux AMD64
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/todo-app-linux-amd64 cmd/server/main.go
	# Linux ARM64
	GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bin/todo-app-linux-arm64 cmd/server/main.go
	# Darwin AMD64
	GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o bin/todo-app-darwin-amd64 cmd/server/main.go
	# Darwin ARM64 (M1/M2)
	GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o bin/todo-app-darwin-arm64 cmd/server/main.go
	# Windows AMD64
	GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/todo-app-windows-amd64.exe cmd/server/main.go

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
	go run cmd/server/main.go

# Docker
docker-build:
	docker build -t todo-app:latest .

docker-run:
	docker run -p 8080:8080 -v $(PWD)/data:/app/data todo-app:latest
