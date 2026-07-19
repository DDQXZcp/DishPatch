#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1
  pwd
)"

PROJECT_DIR="$(
  cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1
  pwd
)"

cd "${PROJECT_DIR}"

DOMAIN="${DOMAIN:-controlapi.dish-patch.com}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL must be provided}"

DISH_PATCH_NETWORK_NAME="${
  DISH_PATCH_NETWORK_NAME:-dishpatch-network
}"

LETSENCRYPT_DIR="${
  LETSENCRYPT_DIR:-/opt/dishpatch/letsencrypt
}"

CERTBOT_WEBROOT="${
  CERTBOT_WEBROOT:-/opt/dishpatch/certbot/www
}"

CERTIFICATE_FILE="${
  LETSENCRYPT_DIR
}/live/${DOMAIN}/fullchain.pem"

export DOMAIN
export DISH_PATCH_NETWORK_NAME
export LETSENCRYPT_DIR
export CERTBOT_WEBROOT

echo "Preparing persistent certificate directories..."

sudo mkdir -p \
  "${LETSENCRYPT_DIR}" \
  "${CERTBOT_WEBROOT}/.well-known/acme-challenge"

echo "Ensuring the shared Docker network exists..."

DISH_PATCH_NETWORK_NAME="${DISH_PATCH_NETWORK_NAME}" \
  "${SCRIPT_DIR}/ensure-network.sh"

if [ ! -f "${CERTIFICATE_FILE}" ]; then
  echo "No certificate found for ${DOMAIN}."
  echo "Starting temporary HTTP bootstrap Nginx..."

  docker compose \
    -f compose.bootstrap.yaml \
    up \
    --detach \
    --remove-orphans \
    --wait \
    --wait-timeout 60

  cleanup_bootstrap() {
    docker compose \
      -f compose.bootstrap.yaml \
      down \
      --remove-orphans || true
  }

  trap cleanup_bootstrap EXIT

  echo "Testing the HTTP challenge route..."

  CHALLENGE_TEST_FILE="${
    CERTBOT_WEBROOT
  }/.well-known/acme-challenge/deployment-test"

  echo "dishpatch-acme-test" |
    sudo tee "${CHALLENGE_TEST_FILE}" >/dev/null

  CHALLENGE_RESPONSE="$(
    curl \
      --fail \
      --silent \
      --show-error \
      --max-time 10 \
      "http://${DOMAIN}/.well-known/acme-challenge/deployment-test"
  )"

  sudo rm -f "${CHALLENGE_TEST_FILE}"

  if [ "${CHALLENGE_RESPONSE}" != "dishpatch-acme-test" ]; then
    echo "The public ACME challenge route is not working."
    echo "Check DNS and the EC2 security group."
    exit 1
  fi

  echo "Requesting the first TLS certificate..."

  docker run \
    --rm \
    --volume "${LETSENCRYPT_DIR}:/etc/letsencrypt" \
    --volume "${CERTBOT_WEBROOT}:/var/www/certbot" \
    certbot/certbot:latest \
    certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --domain "${DOMAIN}" \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --non-interactive

  cleanup_bootstrap
  trap - EXIT
else
  echo "Existing certificate found for ${DOMAIN}."
fi

echo "Building and starting production Docker Nginx..."

docker compose \
  -f compose.production.yaml \
  up \
  --detach \
  --build \
  --remove-orphans \
  --wait \
  --wait-timeout 60

echo "Validating production Nginx configuration..."

docker compose \
  -f compose.production.yaml \
  exec \
  -T \
  nginx \
  nginx -t

echo "Testing HTTPS..."

curl \
  --fail \
  --silent \
  --show-error \
  --max-time 15 \
  "https://${DOMAIN}/nginx-health"

echo
echo "Production Docker Nginx deployment completed successfully."

docker compose \
  -f compose.production.yaml \
  ps