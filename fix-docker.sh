#!/bin/bash
echo "Stopping Docker Desktop..."
osascript -e 'quit app "Docker"'
sleep 5

echo "Deleting corrupted virtual disk..."
rm -f ~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw
rm -rf ~/Library/Containers/com.docker.docker/Data/vms/0/data/*

echo "Starting Docker Desktop..."
open -a Docker

echo "Waiting for Docker daemon to start (this can take up to a minute)..."
until docker info > /dev/null 2>&1; do
  sleep 2
done

echo "Docker is ready! Starting services..."
docker-compose down -v
docker-compose up -d

echo "Waiting for PostgreSQL to be healthy..."
sleep 5

echo "Pushing database schema..."
npx prisma db push
echo "DONE!"
