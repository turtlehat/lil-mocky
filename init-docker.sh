#!/bin/bash 
docker build -t lil-mocky:latest .
docker run -dit -v $(pwd):/app --name lil-mocky lil-mocky:latest
docker exec -t lil-mocky npm install