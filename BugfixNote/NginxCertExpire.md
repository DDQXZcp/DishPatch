```
[ec2-user@ip-10-0-1-166 ~]$ sudo nginx -T | grep ssl_certificate
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
#        ssl_certificate "/etc/pki/nginx/server.crt";
#        ssl_certificate_key "/etc/pki/nginx/private/server.key";
    ssl_certificate /etc/letsencrypt/live/api.campusride.herman-tang.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/api.campusride.herman-tang.com/privkey.pem; # managed by Certbot
nginx: configuration file /etc/nginx/nginx.conf test is successful
[ec2-user@ip-10-0-1-166 ~]$ sudo nginx -T | grep ssl_certificate_key
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
#        ssl_certificate_key "/etc/pki/nginx/private/server.key";
    ssl_certificate_key /etc/letsencrypt/live/api.campusride.herman-tang.com/privkey.pem; # managed by Certbot
[ec2-user@ip-10-0-1-166 ~]$ date
Tue Mar 17 13:03:18 UTC 2026
[ec2-user@ip-10-0-1-166 ~]$ sudo openssl x509 -in /etc/letsencrypt/live/api.campusride.herman-tang.com/fullchain.pem -noout -dates -subject
notBefore=Nov 19 00:17:37 2025 GMT
notAfter=Feb 17 00:17:36 2026 GMT
subject=CN=api.campusride.herman-tang.com
```
By Running the above command, we dicovered that the Nginx SSH cert has expired.

Test Renewal
```
sudo certbot renew --dry-run
```

Real Cert Renewal
```
sudo certbot renew
sudo nginx -t
sudo systemctl reload nginx
sudo openssl x509 -in /etc/letsencrypt/live/api.campusride.herman-tang.com/fullchain.pem -noout -dates -subject
```

To enable auto-renew
```
sudo yum install -y cronie
sudo systemctl enable --now crond
```
Edit cron line
```
sudo crontab -e
```

In cron line
```
0 1 * * * certbot renew --quiet && systemctl reload nginx
```
Check Cron job
```
sudo crontab -l
```