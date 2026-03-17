```
sudo vi /etc/nginx/conf.d/controlapi.dish-patch.com.conf
```
Add Content
```
server {
    listen 80;
    server_name controlapi.dish-patch.com;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Reload Nginx
```
sudo nginx -t
sudo systemctl reload nginx
```

Request new certificate
```
sudo certbot --nginx -d controlapi.dish-patch.com
```

Check
```
openssl s_client -connect controlapi.dish-patch.com:443 -servername controlapi.dish-patch.com </dev/null 2>/dev/null | openssl x509 -noout -dates -subject
```