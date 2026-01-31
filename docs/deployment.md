# Deployment Guide (AWS)

This document describes a reference deployment for **DishPatch** on **AWS**, including cloud hosting, CI/CD via GitHub Actions, and keyless authentication using **AWS IAM OIDC**.

> **Scope:** This guide focuses on a practical, production-oriented AWS deployment pattern. Exact resource names may differ across environments.

---

## 1. Architecture Overview

DishPatch is deployed as a layered system:

- **Web Frontends (React)**
  - Hosted on **Amazon S3**
  - Delivered via **Amazon CloudFront**
  - DNS managed by **Route 53** (optional)

- **POS Backend (Serverless)**
  - **API Gateway** → **AWS Lambda**
  - Persistent storage in **DynamoDB**

- **Control Backend (Compute-based)**
  - Spring Boot application on **Amazon EC2**
  - Reverse proxied by **Nginx**
  - Job/event decoupling via **Amazon SQS**
  - Real-time updates via **WebSocket** (implementation-dependent)

- **Robotics Layer**
  - Initially deployed in simulation / containerised runtime (e.g., Docker + ROS 2)
  - Physical robot integration can be added later

---

## 2. Environments

A typical setup uses multiple environments:

- `dev` — sandbox/testing
- `staging` — pre-production validation
- `prod` — production deployment

Each environment should have isolated AWS resources (separate buckets, tables, queues, etc.).

---

## 3. Prerequisites

### 3.1 AWS
- An AWS account and permission to create:
  - S3, CloudFront, API Gateway, Lambda, DynamoDB
  - EC2, IAM, SQS
  - (optional) Route 53, ACM certificates, CloudWatch alarms

### 3.2 GitHub
- A GitHub repository for DishPatch
- GitHub Actions enabled

### 3.3 Domain (optional but recommended)
- A domain name for frontend access
- ACM certificate (recommended for HTTPS)

---

## 4. Frontend Deployment (S3 + CloudFront)

### 4.1 Create an S3 bucket
Create an S3 bucket for the frontend assets (per environment), for example:
- `dishpatch-pos-frontend-prod`
- `dishpatch-control-frontend-prod`

Recommended settings:
- Block public access **enabled**
- Use CloudFront Origin Access Control (OAC) to restrict direct S3 access

### 4.2 Create a CloudFront distribution
- Origin: the S3 bucket
- Enable HTTPS
- Configure caching policies for static assets

### 4.3 Deploy static assets
A typical deployment flow:
1. Build the React app (produces `dist/` or `build/`)
2. Upload build assets to the S3 bucket
3. Invalidate CloudFront cache (if needed)

---

## 5. POS Backend Deployment (API Gateway + Lambda + DynamoDB)

### 5.1 DynamoDB
Create a DynamoDB table per environment (example names):
- `dishpatch-orders-prod`
- `dishpatch-menu-prod`

Recommended:
- On-demand capacity for early-stage development
- Add secondary indexes only when needed

### 5.2 Lambda functions
Deploy Lambda functions for POS APIs (examples):
- `GET /menu`
- `POST /orders`
- `GET /tables/{id}`

Recommended:
- Environment variables for table names, environment, etc.
- Structured logging to CloudWatch Logs

### 5.3 API Gateway
Expose REST endpoints via API Gateway:
- Create a REST API or HTTP API
- Integrate routes to Lambda
- Enable CORS for the frontend domain(s)

---

## 6. Control Backend Deployment (EC2 + Nginx + SQS + WebSocket)

### 6.1 EC2 instance
Provision an EC2 instance for the control backend (per environment).

Recommended baseline:
- Use a minimal Linux AMI
- Place in a VPC subnet with appropriate security groups
- Enable SSH access from trusted IPs only (or use SSM)

### 6.2 Nginx reverse proxy
Nginx can provide:
- TLS termination (or use an ALB)
- Reverse proxy to Spring Boot
- Static routing rules and rate limits

Typical pattern:
- `https://<domain>/api` → Spring Boot
- `https://<domain>/ws` → WebSocket endpoint (if applicable)

### 6.3 SQS queue
Create an SQS queue for order/task dispatch decoupling, for example:
- `dishpatch-orders-queue-prod`

Rationale:
- buffers traffic spikes
- supports retry semantics
- isolates POS ordering from dispatch orchestration

### 6.4 WebSocket (real-time updates)
Real-time robot status can be delivered via:
- Spring Boot WebSocket endpoint behind Nginx, or
- a managed approach (future), depending on your roadmap

---

## 7. CI/CD with GitHub Actions

DishPatch can be deployed via GitHub Actions pipelines, typically:
- Frontend build → S3 upload → CloudFront invalidation
- Backend build/test → deploy Lambda or EC2 services
- Infrastructure provisioning (optional via IaC)

### 7.1 Recommended workflow triggers
- PRs: run build + tests
- `main` branch: deploy to `dev` or `staging`
- tags/releases: deploy to `prod`

---

## 8. AWS IAM OIDC for GitHub Actions (Keyless Auth)

To avoid storing long-lived AWS access keys in GitHub, DishPatch uses AWS IAM OIDC.

### 8.1 Create an OIDC identity provider in AWS
In IAM:
- Add identity provider: `token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

### 8.2 Create an IAM role for GitHub Actions
Create a role with:
- Trusted entity: the OIDC provider
- Trust policy restricting access to:
  - repository
  - branch (recommended)
  - environment (optional)

Example conditions you should enforce:
- `repo:<OWNER>/<REPO>:ref:refs/heads/main`

### 8.3 Attach least-privilege permissions
Attach only required permissions. Typical examples:
- S3: upload assets to specific bucket(s)
- CloudFront: create invalidations
- Lambda/API Gateway: update function code or deployments
- DynamoDB: deploy-time access (if required)
- EC2/SSM: deployment actions (if used)

### 8.4 GitHub Actions configuration
In your workflow:
- Use `aws-actions/configure-aws-credentials` with OIDC
- Specify the role ARN and AWS region
- No AWS secrets are stored in GitHub

---

## 9. Configuration & Secrets

Recommended practices:
- Do **not** commit secrets to the repository
- Store secrets in:
  - AWS Systems Manager Parameter Store, or
  - AWS Secrets Manager

Examples:
- API keys
- DB/table names (if sensitive)
- service endpoints
- robot credentials (future)

---

## 10. Observability (Recommended)

At minimum:
- CloudWatch Logs for Lambda and EC2 services
- CloudWatch metrics and alarms for:
  - SQS queue depth / age of oldest message
  - API Gateway error rate / latency
  - Lambda errors / throttles
  - EC2 health and service availability

---

## 11. Production Hardening (Recommended Next Steps)

For higher availability and safer production operations:
- Run control backend behind an **ALB** and an **Auto Scaling Group**
- Multi-AZ deployment for the control layer
- Use **ACM** for TLS certificates
- Tighten security groups and IAM permissions
- Add structured tracing/metrics where needed

---

## 12. Troubleshooting

Common issues:
- **CloudFront not updating**: invalidate cache or ensure correct cache-control headers
- **CORS errors**: confirm API Gateway CORS and allowed origins
- **OIDC role assumption fails**: check trust policy conditions (repo/branch) and workflow permissions
- **SQS delays**: check consumer scaling and visibility timeout settings

---

## Appendix: Suggested Documentation Additions
- `docs/ci-cd.md` — detailed GitHub Actions pipeline breakdown
- `docs/architecture.md` — diagrams and component responsibilities
- `docs/local-development.md` — running the stack locally