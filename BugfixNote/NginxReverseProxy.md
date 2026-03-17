## Setting up Nginx Reverse Proxy for api.campusride.herman-tang.com

### Install Nginx

For Amazon Linux / CentOS:

```
sudo yum install nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

For Ubuntu / Debian:

```
sudo apt update
sudo apt install nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Configure Nginx reverse proxy

Create a configuration file at **/etc/nginx/conf.d/api.campusride.herman-tang.com.conf** with the following content:

```
server {
    listen 80;
    server_name api.campusride.herman-tang.com;

    # Redirect all HTTP requests to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.campusride.herman-tang.com;

    ssl_certificate /etc/letsencrypt/live/api.campusride.herman-tang.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.campusride.herman-tang.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://localhost:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### Test Nginx configuration

Run:
```
sudo nginx -t
```

If the test is successful, reload Nginx:
```
sudo systemctl reload nginx
```

### Notes

- Make sure your backend application is running on localhost port 8080.
- The /ws location is proxied to your backend’s /ws endpoint.
- Let your backend handle CORS headers; **DO NOT** set CORS in Nginx to avoid conflicts !!!
- SSL certificates are managed by Certbot and placed in /etc/letsencrypt/live/api.campusride.herman-tang.com/.
- The HTTP server redirects all requests to HTTPS for security.

5. Troubleshooting

- If you see permission errors, check Nginx user permissions on files.
- If you get 403 errors, **set CORS in Spring Boot Backend, and remove CORS setting in Nginx**
- Check Nginx logs at /var/log/nginx/error.log and access.log for clues.

```
sudo tail -f /var/log/nginx/access.log | grep /ws/info
```
