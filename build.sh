#!/bin/bash
set -e

echo "Building Todo App..."

# Build frontend
echo "Building frontend..."
cd web
npm install
npm run build
cd ..

# Prepare embedded files
echo "Preparing embedded files..."
rm -rf cmd/server/web/dist
mkdir -p cmd/server/web/dist
cp -r web/dist/* cmd/server/web/dist/

# Build backend
echo "Building backend..."
CGO_ENABLED=1 go build -o bin/todo-app cmd/server/main.go

echo "Build complete! Binary: bin/todo-app"
echo "Run with: ./bin/todo-app"
