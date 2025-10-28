# Assignment 2 - Quick Migration Guide

## 🎯 Uppgiftens krav

Du ska:

1. ✅ Göra Taskit-servicen **stateless** med Redis session store
2. ✅ Implementera **event-driven arkitektur** med RabbitMQ
3. ✅ Skapa en **Analytics Service** som konsumerar events
4. ✅ Deploya till **Kubernetes** med persistent storage
5. ✅ Sätta upp **CI/CD pipeline** för kontinuerlig leverans

---

## 📦 Vad ska kopieras till det nya projektet?

### ✅ KOPIERA DESSA FILER:

```
från example-dockerized-web-application/
│
├── src/                    ← HELA mappen (men kräver uppdateringar)
├── public/                 ← HELA mappen (ingen ändring)
├── package.json           ← Kopiera + lägg till nya dependencies
├── nodemon.json           ← Kopiera som den är
├── .dockerignore          ← Kopiera som den är
├── .gitignore             ← Kopiera som den är
├── .eslintrc.json         ← Kopiera som den är
└── .example.env           ← Kopiera + uppdatera för nya services
```

### ❌ KOPIERA INTE:

```
├── .volumes/              ← Lokal data (ska inte committas)
├── .env                   ← Secrets (ska inte committas)
├── docker-compose*.yaml   ← Ersätts med Kubernetes manifests
└── Dockerfile.*           ← Skapa ny production Dockerfile
```

---

## 🔧 FILER SOM MÅSTE UPPDATERAS

### 1. `package.json`

**LÄGG TILL** dessa dependencies:

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

---

### 2. `src/config/sessionOptions.js`

**UPPDATERA** för att använda Redis istället för in-memory:

**Före (in-memory):**

```javascript
export const sessionOptions = {
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    /* ... */
  },
};
```

**Efter (Redis):**

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
    /* ... */
  },
};
```

---

### 3. `src/controllers/TaskController.js`

**LÄGG TILL** event publishing i alla metoder:

```javascript
import { publishEvent } from "../config/rabbitmq.js";

// I create-metoden:
publishEvent("task.created", {
  event_type: "task.created",
  task_id: task.id,
  task_name: task.name,
  user_id: req.session.userId || "anonymous",
  timestamp: new Date().toISOString(),
});

// I update-metoden:
publishEvent(task.done ? "task.completed" : "task.uncompleted", {
  event_type: task.done ? "task.completed" : "task.uncompleted",
  task_id: task.id,
  task_name: task.name,
  user_id: req.session.userId || "anonymous",
  timestamp: new Date().toISOString(),
});

// I delete-metoden:
publishEvent("task.deleted", {
  event_type: "task.deleted",
  task_id: req.params.id,
  user_id: req.session.userId || "anonymous",
  timestamp: new Date().toISOString(),
});
```

---

### 4. `src/server.js`

**LÄGG TILL** RabbitMQ initialization efter mongoose connection:

```javascript
import { connectRabbitMQ } from "./config/rabbitmq.js";

// Efter mongoose.connect():
await connectRabbitMQ();
```

---

### 5. `.example.env`

**UPPDATERA** med nya environment variables:

```env
# Befintliga (behåll dessa)
DOCKER_HOST_PORT=3000
SESSION_SECRET=your-secret-key
DB_CONNECTION_STRING=mongodb://mongodb:27017/just-task-it

# NYA för Assignment 2
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
```

---

## 📝 NYA FILER SOM MÅSTE SKAPAS

### I Taskit Service:

#### 1. `src/config/redis.js` (NY FIL)

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

#### 2. `src/config/rabbitmq.js` (NY FIL)

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

#### 3. `Dockerfile` (NY FIL - production)

```dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
```

---

### Kubernetes Manifests (NYA FILER):

Skapa mapp `k8s/` och dessa filer:

#### 4. `k8s/namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: jti-app
```

#### 5. `k8s/secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: jti-app
type: Opaque
stringData:
  session-secret: "your-super-secret-session-key"
---
apiVersion: v1
kind: Secret
metadata:
  name: rabbitmq-secret
  namespace: jti-app
type: Opaque
stringData:
  password: "your-rabbitmq-password"
```

#### 6. `k8s/mongodb-deployment.yaml`

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
```

#### 7. `k8s/redis-deployment.yaml`

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
```

#### 8. `k8s/rabbitmq-deployment.yaml`

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
      name: amqp
    - port: 15672
      name: management
```

#### 9. `k8s/taskit-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taskit-service
  namespace: jti-app
spec:
  replicas: 3 # Flera instanser!
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
---
apiVersion: v1
kind: Service
metadata:
  name: taskit-service
  namespace: jti-app
spec:
  type: LoadBalancer
  selector:
    app: taskit-service
  ports:
    - port: 80
      targetPort: 3000
```

---

## 🎨 ANALYTICS SERVICE (helt ny service)

Skapa helt ny mapp `analytics-service/` med:

### 10. `analytics-service/package.json`

```json
{
  "name": "jti-analytics-service",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "amqplib": "^0.10.3",
    "mongodb": "^6.0.0",
    "ejs": "^3.1.9"
  }
}
```

### 11. `analytics-service/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["node", "src/server.js"]
```

### 12. `analytics-service/src/server.js`

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

await connectDatabase();
await startConsumer();

app.get("/", async (req, res) => {
  const tasksOverTime = await getTasksCompletedOverTime();
  const tasksPerUser = await getTasksPerUser();
  res.render("dashboard", { tasksOverTime, tasksPerUser });
});

app.listen(PORT, () => {
  console.log(`Analytics Dashboard running on port ${PORT}`);
});
```

### 13. `analytics-service/src/consumer.js`

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
    await channel.bindQueue(queue, exchange, "task.*");

    console.log("Analytics Consumer started");

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const event = JSON.parse(msg.content.toString());
        console.log("Received event:", event);
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

### 14. `analytics-service/src/database.js`

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
  await db.collection("metrics").insertOne({
    ...event,
    processed_at: new Date(),
  });
}

export async function getTasksCompletedOverTime() {
  return await db
    .collection("metrics")
    .aggregate([
      { $match: { event_type: "task.completed" } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $toDate: "$timestamp" },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
}

export async function getTasksPerUser() {
  return await db
    .collection("metrics")
    .aggregate([
      { $match: { event_type: "task.completed" } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
}
```

### 15. `analytics-service/src/views/dashboard.ejs`

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

### 16. `analytics-service/k8s/analytics-deployment.yaml`

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

## 🚀 CI/CD PIPELINE

### 17. `.gitlab-ci.yml` (ERSÄTT befintlig)

```yaml
stages:
  - build
  - test
  - deploy

variables:
  DOCKER_DRIVER: overlay2

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
    - docker build -t $CI_REGISTRY_IMAGE/taskit-service:latest .
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
    - docker build -t $CI_REGISTRY_IMAGE/analytics-service:latest .
    - docker push $CI_REGISTRY_IMAGE/analytics-service:latest
  only:
    - main
    - deploy

# Tests
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
    - kubectl apply -f k8s/
    - kubectl apply -f analytics-service/k8s/
    - kubectl rollout status deployment/taskit-service -n jti-app
    - kubectl rollout status deployment/analytics-service -n jti-app
  only:
    - main

# Manual approval
manual-approval:
  stage: deploy
  script:
    - echo "Manual approval required"
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
    - kubectl apply -f k8s/
    - kubectl apply -f analytics-service/k8s/
    - kubectl rollout status deployment/taskit-service -n jti-app
    - kubectl rollout status deployment/analytics-service -n jti-app
  needs:
    - manual-approval
  only:
    - deploy
```

---

## 📊 SAMMANFATTNING AV ÄNDRINGAR

### Befintliga filer att uppdatera:

1. ✏️ `package.json` - lägg till Redis + RabbitMQ dependencies
2. ✏️ `src/config/sessionOptions.js` - använd Redis store
3. ✏️ `src/controllers/TaskController.js` - lägg till event publishing
4. ✏️ `src/server.js` - initiera RabbitMQ connection
5. ✏️ `.example.env` - lägg till REDIS_URL och RABBITMQ_URL
6. ✏️ `.gitlab-ci.yml` - ersätt med Kubernetes deployment

### Nya filer att skapa (Taskit Service):

7. ➕ `src/config/redis.js`
8. ➕ `src/config/rabbitmq.js`
9. ➕ `Dockerfile`
10. ➕ `k8s/namespace.yaml`
11. ➕ `k8s/secrets.yaml`
12. ➕ `k8s/mongodb-deployment.yaml`
13. ➕ `k8s/redis-deployment.yaml`
14. ➕ `k8s/rabbitmq-deployment.yaml`
15. ➕ `k8s/taskit-deployment.yaml`

### Nya filer att skapa (Analytics Service):

16. ➕ `analytics-service/package.json`
17. ➕ `analytics-service/Dockerfile`
18. ➕ `analytics-service/src/server.js`
19. ➕ `analytics-service/src/consumer.js`
20. ➕ `analytics-service/src/database.js`
21. ➕ `analytics-service/src/views/dashboard.ejs`
22. ➕ `analytics-service/k8s/analytics-deployment.yaml`

---

## ✅ CHECKLISTA

- [ ] Kopiera alla filer från befintligt repo
- [ ] Uppdatera `package.json` med nya dependencies
- [ ] Skapa `src/config/redis.js` och `src/config/rabbitmq.js`
- [ ] Uppdatera `sessionOptions.js` för Redis
- [ ] Uppdatera `TaskController.js` med event publishing
- [ ] Uppdatera `server.js` med RabbitMQ init
- [ ] Skapa alla Kubernetes manifests i `k8s/`
- [ ] Skapa hela Analytics Service i `analytics-service/`
- [ ] Uppdatera `.gitlab-ci.yml` för Kubernetes
- [ ] Testa lokalt med Docker Compose först
- [ ] Deploya till Kubernetes
- [ ] Verifiera att sessions sparas i Redis
- [ ] Verifiera att events publiceras till RabbitMQ
- [ ] Verifiera att Analytics dashboard visar data
- [ ] Skriv klart `REPORT.md`

---

**Lycka till! 🚀**
