FROM nginx:stable-alpine

# Remove the sample Nginx website configuration.
RUN rm -f /etc/nginx/conf.d/default.conf

# Add the DishPatch reverse-proxy configuration.
COPY nginx/controlapi.conf /etc/nginx/conf.d/controlapi.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]