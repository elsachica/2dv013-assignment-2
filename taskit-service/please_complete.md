# Assignment 2 - Software Patterns and Architecture

## JTI (Just Task It) - Kubernetes Microservices Application

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Requirements Checklist](#requirements-checklist)
- [Migration Guide](#migration-guide)
- [Services](#services)
- [Setup Instructions](#setup-instructions)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)

---

## 🎯 Overview

This project extends the JTI application by implementing a microservices architecture with:

- **Stateless Taskit Service** with Redis session store
- **Event-driven architecture** using RabbitMQ
- **Analytics Service** for processing asynchronous events
- **Kubernetes deployment** with persistent storage
- **CI/CD pipeline** for continuous delivery

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                       │
│                                                               │
│  ┌────────────────┐      ┌──────────────┐                   │
│  │  Taskit Service│──────│   RabbitMQ   │                   │
│  │   (Producer)   │      │ Message Queue│                   │
│  └────────────────┘      └──────────────┘                   │
│         │                        │                           │
│         ├──────────┐             │                           │
│         │          │             │                           │
│    ┌────▼───┐ ┌───▼────┐   ┌───▼────────────┐             │
│    │MongoDB │ │ Redis  │   │Analytics Service│             │
│    │  (DB)  │ │Session │   │   (Consumer)    │             │
│    └────────┘ └────────┘   └─────────────────┘             │
│         │          │                 │                       │
│    ┌────▼──────────▼─────────────────▼──────┐              │
│    │      Persistent Volumes (PV/PVC)        │              │
│    └─────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Requirements Checklist

### 1. Preparation

- [ ] Kubernetes cluster with 3+ worker nodes (CSCloud/GKE/AWS)
- [ ] GitLab project setup in `Part2 Architecture` group
- [ ] Base code from "2DV013 - Kuberneterized Web Application"

### 2. Continuous Delivery

- [ ] GitLab CI/CD pipeline configured
- [ ] Automated deployment to Kubernetes
- [ ] Separate stages: build, test, deploy
- [ ] Optional: GitOps implementation

### 3. Taskit Service Fixes

#### ✅ MUST FIX:

- [ ] **Sessions in Redis** (not in-memory)
  - Redis deployment in Kubernetes
  - Update `sessionOptions.js` to use Redis store
  - Connect-redis package installed
- [ ] **Asynchronous event handling**
  - RabbitMQ deployment in Kubernetes
  - Event publisher implementation
  - Events: `task.created`, `task.completed`, `task.uncompleted`
- [ ] **Persistent data storage**
  - PersistentVolume for MongoDB
  - PersistentVolume for Redis
  - Mounted volumes in Kubernetes manifests

#### 🎁 OPTIONAL:

- [ ] Authentication/Authorization implementation

### 4. Analytics Service

- [ ] New microservice created
- [ ] RabbitMQ consumer implementation
- [ ] Message processing logic
- [ ] Data visualization dashboard
- [ ] Two panels minimum:
  - [ ] Graph: Tasks completed over time
  - [ ] Chart: Tasks per user

---

## 🚀 Migration Guide

### Phase 1: File Structure Setup

#### Create New Directory Structure

```bash
assignment2/
├── taskit-service/              # ← Copy existing app here
│   ├── src/
│   ├── public/
│   ├── k8s/                     # ← NEW: Kubernetes manifests
│   ├── Dockerfile
│   └── package.json
├── analytics-service/           # ← NEW: Create new service
│   ├── src/
│   ├── k8s/
│   ├── Dockerfile
│   └── package.json
├── infrastructure/              # ← NEW: Shared infrastructure
│   ├── rabbitmq/
│   ├── redis/
│   └── mongodb/
└── .gitlab-ci.yml              # ← UPDATE: For Kubernetes
```

#### Files to Copy from Current Repo

**✅ COPY THESE:**

```
Current Repo → Taskit Service
├── src/*                       # All source files
├── public/*                    # All static files
├── package.json               # Update with new dependencies
├── nodemon.json
├── .dockerignore
├── .gitignore
├── .eslintrc.json
└── .example.env               # Update for new services
```

**❌ DO NOT COPY:**

```
├── .volumes/                  # Local data (in .gitignore)
├── .env                       # Secrets (in .gitignore)
├── docker-compose*.yaml       # Replace with K8s manifests
└── Dockerfile.development     # Create new production Dockerfile
```

---

### Phase 2: Code Modifications

#### 2.1 Update `package.json` Dependencies

**ADD these packages:**

```json
{
  "dependencies": {
    "express-session": "^1.17.3",
    "connect-redis": "^7.1.0",
    "redis": "^4.6.0",
    "amqplib": "^0.10.3"
  }
}
```

#### 2.2 Create Redis Session Store

**CREATE NEW FILE:** `src/config/redis.js`

```javascript
import redis from "redis";

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://redis:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.on("connect", () => console.log("Redis Client Connected"));

await redisClient.connect();

export default redisClient;
```

**UPDATE FILE:** `src/config/sessionOptions.js`

```javascript
import RedisStore from "connect-redis";
import redisClient from "./redis.js";

export const sessionOptions = {
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new RedisStore({
    client: redisClient,
    prefix: "session:",
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: "lax",
  },
};
```

#### 2.3 Create RabbitMQ Publisher

**CREATE NEW FILE:** `src/config/rabbitmq.js`

```javascript
import amqp from "amqplib";

let channel = null;

export async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://rabbitmq:5672"
    );
    channel = await connection.createChannel();

    const exchange = "tasks";
    await channel.assertExchange(exchange, "topic", { durable: true });

    console.log("RabbitMQ Connected");
    return channel;
  } catch (error) {
    console.error("RabbitMQ Connection Error:", error);
    // Retry connection after 5 seconds
    setTimeout(connectRabbitMQ, 5000);
  }
}

export function publishEvent(routingKey, message) {
  if (!channel) {
    console.error("RabbitMQ channel not ready");
    return;
  }

  const exchange = "tasks";
  channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });

  console.log(`Published event: ${routingKey}`, message);
}
```

#### 2.4 Update TaskController

**UPDATE FILE:** `src/controllers/TaskController.js`

Add event publishing to all task operations:

```javascript
import { publishEvent } from "../config/rabbitmq.js";

// In create method - ADD:
publishEvent("task.created", {
  event_type: "task.created",
  task_id: task.id,
  task_name: task.name,
  user_id: req.session.userId || "anonymous",
  timestamp: new Date().toISOString(),
});

// In update method - ADD:
publishEvent("task.completed", {
  event_type: task.done ? "task.completed" : "task.uncompleted",
  task_id: task.id,
  task_name: task.name,
  user_id: req.session.userId || "anonymous",
  timestamp: new Date().toISOString(),
});

// In delete method - ADD:
publishEvent("task.deleted", {
  event_type: "task.deleted",
  task_id: req.params.id,
  user_id: req.session.userId || "anonymous",
  timestamp: new Date().toISOString(),
});
```

#### 2.5 Update server.js

**UPDATE FILE:** `src/server.js`

Add RabbitMQ initialization:

```javascript
import { connectRabbitMQ } from "./config/rabbitmq.js";

// After mongoose connection, ADD:
await connectRabbitMQ();
```

---

### Phase 3: Create Kubernetes Manifests

#### 3.1 Namespace

**CREATE:** `k8s/namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: jti-app
```

#### 3.2 MongoDB Deployment

**CREATE:** `k8s/mongodb-deployment.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: jti-app
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: jti-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:7
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: mongodb-storage
              mountPath: /data/db
          env:
            - name: MONGO_INITDB_DATABASE
              value: "just-task-it"
      volumes:
        - name: mongodb-storage
          persistentVolumeClaim:
            claimName: mongodb-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: jti-app
spec:
  selector:
    app: mongodb
  ports:
    - port: 27017
      targetPort: 27017
```

#### 3.3 Redis Deployment

**CREATE:** `k8s/redis-deployment.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: jti-app
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: jti-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: redis-storage
              mountPath: /data
          command: ["redis-server", "--appendonly", "yes"]
      volumes:
        - name: redis-storage
          persistentVolumeClaim:
            claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: jti-app
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
```

#### 3.4 RabbitMQ Deployment

**CREATE:** `k8s/rabbitmq-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: jti-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
        - name: rabbitmq
          image: rabbitmq:3-management-alpine
          ports:
            - containerPort: 5672
              name: amqp
            - containerPort: 15672
              name: management
          env:
            - name: RABBITMQ_DEFAULT_USER
              value: "admin"
            - name: RABBITMQ_DEFAULT_PASS
              valueFrom:
                secretKeyRef:
                  name: rabbitmq-secret
                  key: password
---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq
  namespace: jti-app
spec:
  selector:
    app: rabbitmq
  ports:
    - port: 5672
      targetPort: 5672
      name: amqp
    - port: 15672
      targetPort: 15672
      name: management
```

#### 3.5 Taskit Service Deployment

**CREATE:** `k8s/taskit-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taskit-service
  namespace: jti-app
spec:
  replicas: 3 # Multiple instances for load balancing
  selector:
    matchLabels:
      app: taskit-service
  template:
    metadata:
      labels:
        app: taskit-service
    spec:
      containers:
        - name: taskit
          image: registry.gitlab.lnu.se/<your-group>/taskit-service:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
          env:
            - name: DB_CONNECTION_STRING
              value: "mongodb://mongodb:27017/just-task-it"
            - name: REDIS_URL
              value: "redis://redis:6379"
            - name: RABBITMQ_URL
              value: "amqp://admin:$(RABBITMQ_PASSWORD)@rabbitmq:5672"
            - name: RABBITMQ_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: rabbitmq-secret
                  key: password
            - name: SESSION_SECRET
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: session-secret
            - name: EXPRESS_APP_PORT
              value: "3000"
            - name: BASE_URL
              value: "/"
            - name: SESSION_NAME
              value: "jti-session"
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: taskit-service
  namespace: jti-app
spec:
  type: LoadBalancer # Or NodePort/ClusterIP depending on setup
  selector:
    app: taskit-service
  ports:
    - port: 80
      targetPort: 3000
```

#### 3.6 Secrets

**CREATE:** `k8s/secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: jti-app
type: Opaque
stringData:
  session-secret: "your-super-secret-session-key-change-in-production"
---
apiVersion: v1
kind: Secret
metadata:
  name: rabbitmq-secret
  namespace: jti-app
type: Opaque
stringData:
  password: "your-rabbitmq-password-change-in-production"
```

**⚠️ IMPORTANT:** Never commit real secrets! Use GitLab CI/CD variables or sealed-secrets.

---

### Phase 4: Create Analytics Service

#### 4.1 Analytics Service Structure

**CREATE:** `analytics-service/package.json`

```json
{
  "name": "jti-analytics-service",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "amqplib": "^0.10.3",
    "mongodb": "^6.0.0",
    "chart.js": "^4.4.0"
  }
}
```

#### 4.2 Analytics Consumer

**CREATE:** `analytics-service/src/consumer.js`

```javascript
import amqp from "amqplib";
import { saveMetric } from "./database.js";

export async function startConsumer() {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://rabbitmq:5672"
    );
    const channel = await connection.createChannel();

    const exchange = "tasks";
    const queue = "analytics-queue";

    await channel.assertExchange(exchange, "topic", { durable: true });
    await channel.assertQueue(queue, { durable: true });

    // Bind to all task events
    await channel.bindQueue(queue, exchange, "task.*");

    console.log("Analytics Consumer started, waiting for messages...");

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const event = JSON.parse(msg.content.toString());
        console.log("Received event:", event);

        // Process and save metric
        await saveMetric(event);

        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("Consumer error:", error);
    setTimeout(startConsumer, 5000);
  }
}
```

#### 4.3 Analytics Database

**CREATE:** `analytics-service/src/database.js`

```javascript
import { MongoClient } from "mongodb";

const client = new MongoClient(
  process.env.ANALYTICS_DB_URL || "mongodb://mongodb:27017"
);
let db;

export async function connectDatabase() {
  await client.connect();
  db = client.db("jti-analytics");
  console.log("Analytics DB connected");
}

export async function saveMetric(event) {
  const collection = db.collection("metrics");
  await collection.insertOne({
    ...event,
    processed_at: new Date(),
  });
}

export async function getTasksCompletedOverTime() {
  const collection = db.collection("metrics");
  return await collection
    .aggregate([
      { $match: { event_type: "task.completed" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
}

export async function getTasksPerUser() {
  const collection = db.collection("metrics");
  return await collection
    .aggregate([
      { $match: { event_type: "task.completed" } },
      {
        $group: {
          _id: "$user_id",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray();
}
```

#### 4.4 Analytics Dashboard

**CREATE:** `analytics-service/src/server.js`

```javascript
import express from "express";
import { startConsumer } from "./consumer.js";
import {
  connectDatabase,
  getTasksCompletedOverTime,
  getTasksPerUser,
} from "./database.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.set("view engine", "ejs");
app.set("views", "./src/views");

// Initialize
await connectDatabase();
await startConsumer();

// Dashboard route
app.get("/", async (req, res) => {
  const tasksOverTime = await getTasksCompletedOverTime();
  const tasksPerUser = await getTasksPerUser();

  res.render("dashboard", {
    tasksOverTime,
    tasksPerUser,
  });
});

// API endpoints
app.get("/api/metrics/tasks-over-time", async (req, res) => {
  const data = await getTasksCompletedOverTime();
  res.json(data);
});

app.get("/api/metrics/tasks-per-user", async (req, res) => {
  const data = await getTasksPerUser();
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Analytics Dashboard running on port ${PORT}`);
});
```

#### 4.5 Analytics Dashboard View

**CREATE:** `analytics-service/src/views/dashboard.ejs`

```html
<!DOCTYPE html>
<html>
  <head>
    <title>JTI Analytics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 20px;
        background: #f5f5f5;
      }
      .dashboard {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      .panel {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      h1 {
        text-align: center;
        color: #333;
      }
      canvas {
        max-height: 300px;
      }
    </style>
  </head>
  <body>
    <h1>📊 JTI Analytics Dashboard</h1>

    <div class="dashboard">
      <div class="panel">
        <h2>Tasks Completed Over Time</h2>
        <canvas id="tasksOverTimeChart"></canvas>
      </div>

      <div class="panel">
        <h2>Tasks Per User</h2>
        <canvas id="tasksPerUserChart"></canvas>
      </div>
    </div>

    <script>
      // Tasks over time chart
      const timeData = <%- JSON.stringify(tasksOverTime) %>;
      new Chart(document.getElementById('tasksOverTimeChart'), {
        type: 'line',
        data: {
          labels: timeData.map(d => d._id),
          datasets: [{
            label: 'Completed Tasks',
            data: timeData.map(d => d.count),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }]
        }
      });

      // Tasks per user chart
      const userData = <%- JSON.stringify(tasksPerUser) %>;
      new Chart(document.getElementById('tasksPerUserChart'), {
        type: 'bar',
        data: {
          labels: userData.map(d => d._id),
          datasets: [{
            label: 'Completed Tasks',
            data: userData.map(d => d.count),
            backgroundColor: 'rgb(54, 162, 235)'
          }]
        }
      });
    </script>
  </body>
</html>
```

#### 4.6 Analytics Dockerfile

**CREATE:** `analytics-service/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 4000

CMD ["node", "src/server.js"]
```

#### 4.7 Analytics Kubernetes Deployment

**CREATE:** `analytics-service/k8s/analytics-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: analytics-service
  namespace: jti-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: analytics-service
  template:
    metadata:
      labels:
        app: analytics-service
    spec:
      containers:
        - name: analytics
          image: registry.gitlab.lnu.se/<your-group>/analytics-service:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 4000
          env:
            - name: RABBITMQ_URL
              value: "amqp://admin:$(RABBITMQ_PASSWORD)@rabbitmq:5672"
            - name: RABBITMQ_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: rabbitmq-secret
                  key: password
            - name: ANALYTICS_DB_URL
              value: "mongodb://mongodb:27017"
            - name: PORT
              value: "4000"
---
apiVersion: v1
kind: Service
metadata:
  name: analytics-service
  namespace: jti-app
spec:
  type: LoadBalancer
  selector:
    app: analytics-service
  ports:
    - port: 80
      targetPort: 4000
```

---

### Phase 5: GitLab CI/CD Pipeline

**UPDATE:** `.gitlab-ci.yml`

```yaml
stages:
  - build
  - test
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  TASKIT_IMAGE: $CI_REGISTRY_IMAGE/taskit-service:$CI_COMMIT_SHORT_SHA
  ANALYTICS_IMAGE: $CI_REGISTRY_IMAGE/analytics-service:$CI_COMMIT_SHORT_SHA

# Build Taskit Service
build-taskit:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - cd taskit-service
    - docker build -t $TASKIT_IMAGE .
    - docker push $TASKIT_IMAGE
    - docker tag $TASKIT_IMAGE $CI_REGISTRY_IMAGE/taskit-service:latest
    - docker push $CI_REGISTRY_IMAGE/taskit-service:latest
  only:
    - main
    - deploy

# Build Analytics Service
build-analytics:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - cd analytics-service
    - docker build -t $ANALYTICS_IMAGE .
    - docker push $ANALYTICS_IMAGE
    - docker tag $ANALYTICS_IMAGE $CI_REGISTRY_IMAGE/analytics-service:latest
    - docker push $CI_REGISTRY_IMAGE/analytics-service:latest
  only:
    - main
    - deploy

# Unit Tests
unit-tests:
  stage: test
  image: node:20-alpine
  script:
    - cd taskit-service
    - npm ci
    - npm test
  only:
    - main
    - deploy

# Lint Tests
lint-tests:
  stage: test
  image: node:20-alpine
  script:
    - cd taskit-service
    - npm ci
    - npm run lint
  only:
    - main
    - deploy

# Deploy to Staging
deploy-staging:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: staging
    url: http://$STAGING_HOST
  before_script:
    - echo "$KUBECONFIG_STAGING" > kubeconfig
    - export KUBECONFIG=kubeconfig
  script:
    - kubectl apply -f k8s/namespace.yaml
    - kubectl apply -f k8s/secrets.yaml
    - kubectl apply -f k8s/mongodb-deployment.yaml
    - kubectl apply -f k8s/redis-deployment.yaml
    - kubectl apply -f k8s/rabbitmq-deployment.yaml
    - kubectl apply -f k8s/taskit-deployment.yaml
    - kubectl apply -f analytics-service/k8s/analytics-deployment.yaml
    - kubectl rollout status deployment/taskit-service -n jti-app
    - kubectl rollout status deployment/analytics-service -n jti-app
  only:
    - main

# Manual approval for production
manual-approval:
  stage: deploy
  script:
    - echo "Manual approval required for production deployment"
  when: manual
  only:
    - deploy

# Deploy to Production
deploy-production:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: http://$PRODUCTION_HOST
  before_script:
    - echo "$KUBECONFIG_PRODUCTION" > kubeconfig
    - export KUBECONFIG=kubeconfig
  script:
    - kubectl apply -f k8s/namespace.yaml
    - kubectl apply -f k8s/secrets.yaml
    - kubectl apply -f k8s/mongodb-deployment.yaml
    - kubectl apply -f k8s/redis-deployment.yaml
    - kubectl apply -f k8s/rabbitmq-deployment.yaml
    - kubectl apply -f k8s/taskit-deployment.yaml
    - kubectl apply -f analytics-service/k8s/analytics-deployment.yaml
    - kubectl rollout status deployment/taskit-service -n jti-app
    - kubectl rollout status deployment/analytics-service -n jti-app
  needs:
    - manual-approval
  only:
    - deploy
```

---

## 🔧 Environment Variables

### Taskit Service

**Required:**

```env
DB_CONNECTION_STRING=mongodb://mongodb:27017/just-task-it
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
SESSION_SECRET=your-secret-key
EXPRESS_APP_PORT=3000
BASE_URL=/
SESSION_NAME=jti-session
```

### Analytics Service

**Required:**

```env
RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
ANALYTICS_DB_URL=mongodb://mongodb:27017
PORT=4000
```

---

## 🚀 Setup Instructions

### 1. Set up GitLab CI/CD Variables

In GitLab project settings → CI/CD → Variables, add:

```
KUBECONFIG_STAGING     = <your staging kubeconfig>
KUBECONFIG_PRODUCTION  = <your production kubeconfig>
STAGING_HOST           = <staging cluster IP>
PRODUCTION_HOST        = <production cluster IP>
```

### 2. Create Kubernetes Cluster

**CSCloud example:**

```bash
# Create cluster with 3 worker nodes
# Use CSCloud web interface or terraform
```

### 3. Local Development

```bash
# Start with Docker Compose (for local testing)
docker-compose -f docker-compose.yaml -f docker-compose.development.yaml up --build
```

### 4. Deploy to Kubernetes

```bash
# Manual deployment (for testing)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/rabbitmq-deployment.yaml
kubectl apply -f k8s/taskit-deployment.yaml
kubectl apply -f analytics-service/k8s/analytics-deployment.yaml

# Check status
kubectl get pods -n jti-app
kubectl get services -n jti-app
```

---

## 📊 Testing the System

### 1. Access Taskit Service

```bash
kubectl get service taskit-service -n jti-app
# Access via LoadBalancer IP or NodePort
```

### 2. Create Tasks

- Navigate to Taskit UI
- Create several tasks
- Mark some as completed

### 3. Verify Message Queue

```bash
# Access RabbitMQ Management UI
kubectl port-forward service/rabbitmq 15672:15672 -n jti-app
# Open http://localhost:15672
# Login: admin / <your-password>
```

### 4. Check Analytics Dashboard

```bash
kubectl get service analytics-service -n jti-app
# Access via LoadBalancer IP
```

### 5. Verify Persistent Storage

```bash
# Delete pods and verify data persists
kubectl delete pod <mongodb-pod> -n jti-app
kubectl delete pod <redis-pod> -n jti-app

# Pods will restart and data should remain
```

---

## 🐛 Troubleshooting

### Check Logs

```bash
# Taskit service logs
kubectl logs -f deployment/taskit-service -n jti-app

# Analytics service logs
kubectl logs -f deployment/analytics-service -n jti-app

# RabbitMQ logs
kubectl logs -f deployment/rabbitmq -n jti-app
```

### Common Issues

**Sessions not persisting:**

- Check Redis connection: `kubectl logs -f deployment/redis -n jti-app`
- Verify REDIS_URL environment variable

**Events not being processed:**

- Check RabbitMQ is running: `kubectl get pods -n jti-app`
- Verify message queue has consumers
- Check analytics service logs

**Database connection issues:**

- Verify MongoDB PVC is bound: `kubectl get pvc -n jti-app`
- Check MongoDB logs: `kubectl logs -f deployment/mongodb -n jti-app`

---

## 📝 Assignment Report Checklist

Make sure to answer in `REPORT.md`:

- [ ] Architecture diagram explanation
- [ ] Why stateless design matters
- [ ] How Redis improves scalability
- [ ] Event-driven architecture benefits
- [ ] RabbitMQ message flow
- [ ] Persistent storage strategy
- [ ] Kubernetes deployment strategy
- [ ] CI/CD pipeline explanation
- [ ] Scaling considerations
- [ ] Security considerations (secrets management)
- [ ] Monitoring and observability
- [ ] Future improvements

---

## 📚 Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html)
- [Redis Documentation](https://redis.io/docs/)
- [GitLab CI/CD](https://docs.gitlab.com/ee/ci/)
- [Chart.js Documentation](https://www.chartjs.org/docs/)

---

## 🎯 Success Criteria

Your assignment is complete when:

✅ Taskit service runs with multiple replicas in Kubernetes  
✅ Sessions are stored in Redis (not in-memory)  
✅ Tasks trigger events published to RabbitMQ  
✅ Analytics service consumes and processes events  
✅ Dashboard displays two visualizations  
✅ Data persists across pod restarts  
✅ CI/CD pipeline deploys to Kubernetes automatically  
✅ All code is in GitLab with proper merge request  
✅ REPORT.md is complete with answers

---

**Good luck! 🚀**
