# Nginx

Nginx listens on container port 80 and is published locally on port 8080. `/api/` is proxied to the API container and all other paths are proxied to the web container. The observed validation is `curl http://localhost:8080/api/v1/health` returning `{"status":"ok"}`.
