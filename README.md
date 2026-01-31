![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![CloudFront](https://img.shields.io/badge/AWS%20CloudFront-FF9900?logo=amazonaws&logoColor=white)
![S3](https://img.shields.io/badge/AWS%20S3-569A31?logo=amazons3&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)
![API Gateway](https://img.shields.io/badge/AWS%20API%20Gateway-FF4F8B?logo=amazonapigateway&logoColor=white)
![Lambda](https://img.shields.io/badge/AWS%20Lambda-FF9900?logo=awslambda&logoColor=white)
![DynamoDB](https://img.shields.io/badge/AWS%20DynamoDB-4053D6?logo=amazondynamodb&logoColor=white)
![EC2](https://img.shields.io/badge/AWS%20EC2-FF9900?logo=amazonec2&logoColor=white)
![Spring%20Boot](https://img.shields.io/badge/Spring%20Boot-6DB33F?logo=springboot&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?logo=nginx&logoColor=white)
![SQS](https://img.shields.io/badge/AWS%20SQS-FF4F8B?logo=amazonsqs&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-000000?logo=socketdotio&logoColor=white)
<!-- ![React](https://img.shields.io/badge/react-frontend-61DAFB?logo=react&logoColor=white&labelColor=000000) -->


# DishPatch
DishPatch is an open-source, cloud-based, end-to-end restaurant service-robot system that integrates a full-stack web platform with robot fleet control.

<img alt="DishPatch Architecture" src="./img/DishPatch.png" />

# Background
## Overview
Service robots are increasingly used in restaurants and hotels. While commercial platforms (e.g., Yunji, Pudu) are mature and reliable, they are typically expensive, closed-source, and difficult for individual developers to customise or extend.

DishPatch addresses this gap by providing a modular reference system spanning:
- **Frontend (React)**: POS ordering and operator dashboards
- **Backend (Spring Boot)**: order processing, scheduling, and APIs
- **Robotics layer**: fleet management, robot state streaming, and task execution

The project is designed for developers with basic software/robotics background to build, test, and iterate on a complete solution—from simulation to real deployment.

## System Workflow

The proposed system workflow

<img alt="DishPatch Basic Workflow" src="./img/Workflow DishPatch.png" />
<p align="center">
  DishPatch Basic Workflows
</p>

## Components

### (1) POS System ![Status](https://img.shields.io/badge/status-done-brightgreen)

<p align="center">
  Implementation: <strong>HTCafePOS</strong> ·
  <a href="https://pos.herman-tang.com/menu">Demo</a> ·
  <a href="https://github.com/DDQXZcp/HTCafePOS/">Repository</a>
</p>

The POS system provides a customer-facing ordering interface used to place orders and generate delivery tasks.

**POS Frontend**
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![CloudFront](https://img.shields.io/badge/AWS%20CloudFront-FF9900?logo=amazonaws&logoColor=white)
![S3](https://img.shields.io/badge/AWS%20S3-569A31?logo=amazons3&logoColor=white)



<img alt="POS System Frontend" src="./img/POS System Frontend.png" />
<p align="center">
  HTCafePOS POS Frontend
</p>

The POS frontend is a React web application hosted on **Amazon S3** and delivered via **CloudFront** for global caching and low-latency access.

**POS Backend**
![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)
![API Gateway](https://img.shields.io/badge/AWS%20API%20Gateway-FF4F8B?logo=amazonapigateway&logoColor=white)
![Lambda](https://img.shields.io/badge/AWS%20Lambda-FF9900?logo=awslambda&logoColor=white)
![DynamoDB](https://img.shields.io/badge/AWS%20DynamoDB-4053D6?logo=amazondynamodb&logoColor=white)

The POS backend exposes APIs for menu/table queries and order submission. It uses **API Gateway + AWS Lambda** for request handling and **DynamoDB** for persistent storage.


<!-- > Note: If this module is currently hosted in a different repo (e.g., CampusRide), replace the link above to keep naming consistent. -->

---

### (2) Control System ![Status](https://img.shields.io/badge/status-planning-blue?labelColor=555555)

<p align="center">
  Existing Work <strong>CampusRide</strong> — Personal POS Project ·
  <a href="https://campusride.herman-tang.com/">Demo</a> ·
  <a href="https://github.com/DDQXZcp/DishPatch/tree/main">Repository</a>
</p>

**Control Frontend**
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![CloudFront](https://img.shields.io/badge/AWS%20CloudFront-FF9900?logo=amazonaws&logoColor=white)
![S3](https://img.shields.io/badge/AWS%20S3-569A31?logo=amazons3&logoColor=white)

The control system coordinates orders and fleet operations. It is intended to include:
- **Monitoring Dashboard** — real-time robot telemetry (location, heading, speed, battery)

<img alt="Control System Frontend" src="./img/CampusRide-Frontend.png" />
<p align="center">
  CampusRide Frontend
</p>

**Control Backend**
![EC2](https://img.shields.io/badge/AWS%20EC2-FF9900?logo=amazonec2&logoColor=white)
![Spring%20Boot](https://img.shields.io/badge/Spring%20Boot-6DB33F?logo=springboot&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?logo=nginx&logoColor=white)
![SQS](https://img.shields.io/badge/AWS%20SQS-FF4F8B?logo=amazonsqs&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-000000?logo=socketdotio&logoColor=white)


- **Job Scheduler** — transforms orders into tasks and assigns delivery jobs
- **Fleet Manager** — manages high-level robot coordination and task execution


**Planned deliverables**
- REST APIs for orders, tasks, and fleet management
- real-time status streaming via WebSocket/MQTT
- scheduling strategies (FIFO, priority-based, zone-aware, load balancing)

### (3) Robotics System ![Status](https://img.shields.io/badge/status-planning-blue?labelColor=555555)

The robotics layer is responsible for executing delivery tasks and publishing robot state. Initial development will focus on a virtual/simulated environment to validate end-to-end behaviour. Support for physical robots will be introduced once the platform interfaces and workflows stabilise.

---

<!-- ![Status](https://img.shields.io/badge/status-in%20progress-yellow?labelColor=555555)
![Status](https://img.shields.io/badge/status-planning-blue?labelColor=555555)
![Status](https://img.shields.io/badge/status-active-brightgreen?labelColor=555555)
![Status](https://img.shields.io/badge/status-beta-ffbf00?labelColor=555555)
![Status](https://img.shields.io/badge/status-stable-brightgreen?labelColor=555555)
![Status](https://img.shields.io/badge/status-maintained-brightgreen?labelColor=555555)
![Status](https://img.shields.io/badge/status-paused-lightgrey?labelColor=555555)
![Status](https://img.shields.io/badge/status-on%20hold-lightgrey?labelColor=555555)
![Status](https://img.shields.io/badge/status-deprecated-red?labelColor=555555)
![Status](https://img.shields.io/badge/status-experimental-orange?labelColor=555555) -->
