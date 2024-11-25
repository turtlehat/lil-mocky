#!/bin/bash 
docker container start lil-mocky
docker exec -t lil-mocky npm run test
