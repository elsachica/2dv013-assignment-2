# Just Task It – Cloud Native Applications (2DV013)

**Full-stack project with Express, MongoDB, Redis, RabbitMQ, Docker, Kubernetes, Terraform, and Ansible.**

---

## Project Overview

This is a cloud-native application with a microservices architecture demonstrating event-driven communication, containerization, and infrastructure as code.

**Two main services:**

- **taskit-service** – RESTful backend for task management (CRUD operations)
- **analytics-service** – Real-time analytics and metrics collection via RabbitMQ

Each service runs in its own container with separate Kubernetes manifests, enabling independent scalability and deployment.

### Technical Stack

- **Backend:** Node.js/Express, EJS templating
- **Databases:** MongoDB (tasks), Redis (sessions), RabbitMQ (event queue)
- **Containerization:** Docker with multi-stage builds
- **Orchestration:** Kubernetes (k3s)
- **Infrastructure:** Terraform (OpenStack) + Ansible
- **CI/CD:** GitLab Pipelines (Kaniko for image building)
- **Architectural Patterns:** Microservices, Event-Driven Architecture, MVC, PRG pattern

---

## Getting Started

### Prerequisites

- Docker Desktop
- kubectl (included with Docker Desktop)
- Terraform
- Ansible
- SSH key pair for OpenStack
- Access to LNU VPN (for accessing deployed services)

### Quick Start

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd assignment-2-2dv013

# 2. Provision infrastructure (Terraform)
cd terraform && terraform apply && cd ..

# 3. Setup Kubernetes cluster (Ansible)
bash generate-inventory.sh
ansible-playbook -i ansible/inventory.ini ansible/deploy-k3s.yml

# 4. Create ImagePullSecret for GitLab Container Registry
export KUBECONFIG=./k3s.yaml
kubectl create secret docker-registry gitlab-registry-secret \
  --docker-server=gitlab.lnu.se:5050 \
  --docker-username=<your-username> \
  --docker-password=<your-token> \
  --docker-email=<your-email> \
  --dry-run=client -o yaml | kubectl apply -f -

# 5. Deploy applications
kubectl apply -f k8s/ --recursive

# 6. Access your application
kubectl get svc
# Visit: http://<SERVER_PUBLIC_IP>:<NodePort>
```

For detailed instructions, see [start_programs.md](start_programs.md).

---

## Architecture

### Microservices Pattern

The application is split into two independent services:

- **taskit-service** ([`taskit-service/`](taskit-service/))
  - Handles task CRUD operations
  - Publishes events (task.created, task.updated, task.deleted) to RabbitMQ
  - Uses MongoDB for persistence, Redis for sessions
  - Implements MVC pattern with EJS templates

- **analytics-service** ([`analytics-service/`](analytics-service/))
  - Consumes events from RabbitMQ
  - Stores metrics in MongoDB
  - Provides analytics dashboard with real-time statistics
  - Independent of taskit-service (can fail without affecting tasks)

### Event-Driven Communication

Services communicate asynchronously via RabbitMQ:
```
Taskit → task.created event → RabbitMQ queue → Analytics consumer → MongoDB metrics
```

This decouples services and ensures data consistency even during service failures.

---

## Accessing Your Application

### After Deployment

```bash
# Get service information and ports
kubectl get svc

# Example output:
# NAME         TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)
# taskit       NodePort   10.43.185.173   <none>        3000:30908/TCP
# analytics    NodePort   10.43.253.123   <none>        4000:31764/TCP
```

### Service URLs

Replace `<SERVER_PUBLIC_IP>` with your OpenStack floating IP and `<NodePort>` with the port from `kubectl get svc`:

- **Just Task It (Task Management):**  
  `http://<SERVER_PUBLIC_IP>:30908`

- **Analytics Dashboard:**  
  `http://<SERVER_PUBLIC_IP>:31764`

**Example:**
- Task management: `http://194.47.171.189:30908`
- Analytics: `http://194.47.171.189:31764`

> ⚠️ **Note:** You must be connected to LNU VPN to access services running on OpenStack/Cumulus.

---

## Key Features

### 1. Automatic Deployment Pipeline

The GitLab CI/CD pipeline automatically:
- Builds Docker images using Kaniko
- Pushes to GitLab Container Registry
- Deploys to Kubernetes cluster
- Runs tests and linting

**Trigger:** Push to `main` branch or manually run pipeline

### 2. High Availability

- **3 replicas** of taskit and analytics services (load balancing)
- **Single replicas** for databases (data consistency)
- Automatic pod restart on failure
- Rolling updates without downtime

### 3. ConfigMaps & Secrets

- Environment variables managed via [`k8s/taskit/configmap.yaml`](k8s/taskit/configmap.yaml) and [`k8s/analytics/configmap.yaml`](k8s/analytics/configmap.yaml)
- Sensitive data (SESSION_SECRET) stored in Kubernetes Secrets
- Easy configuration updates without rebuilding images

### 4. Persistent Storage

- MongoDB data persists via PersistentVolumeClaims
- Redis session data persists across restarts
- RabbitMQ queue data persists

---

## Troubleshooting

### Check Cluster Status

```bash
export KUBECONFIG=./k3s.yaml

# View all pods
kubectl get pods -A

# View all services
kubectl get svc -A

# View pod logs
kubectl logs <pod-name>

# Describe pod (detailed info)
kubectl describe pod <pod-name>

# View Kubernetes events
kubectl get events --sort-by='.lastTimestamp'
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `ImagePullBackOff` | Create ImagePullSecret: `kubectl create secret docker-registry gitlab-registry-secret ...` |
| Pods stuck in `Pending` | Check resources: `kubectl describe pod <name>` |
| `Connection refused` on RabbitMQ | Pods may be starting, wait a moment and check logs |
| Can't reach service from browser | Verify VPN connection and firewall rules |
| `kubectl: command not found` | Set KUBECONFIG: `export KUBECONFIG=./k3s.yaml` |

### Cleanup

```bash
# Delete all Kubernetes resources
kubectl delete -f k8s/ --recursive

# Destroy infrastructure
cd terraform
terraform destroy
cd ..
```

---

## CI/CD Pipeline

The GitLab CI/CD pipeline (`.gitlab-ci.yml`) has three stages:

1. **Build** – Builds Docker images using Kaniko, pushes to GitLab Container Registry
2. **Test** – Runs linting and unit tests
3. **Deploy** – Applies Kubernetes manifests and updates cluster

**Pipeline triggers:**
- Automatically on push to `main`, `master`, or `deploy` branches
- Can be manually triggered from GitLab UI

**Key features:**
- Dynamic image tagging based on branch name
- Automatic ImagePullSecret creation
- Automatic rollout status checking

---

## Development

### Local Development (Optional)

To test locally with Docker Compose:

```bash
# Development environment (with hot reload)
cd taskit-service
npm run docker:dev

# Production-like environment
npm run docker:prod
```

### Project Guidelines

- Follow MVC pattern for controllers and models
- Use EJS for templating
- Implement proper error handling and logging
- Write descriptive commit messages
- Keep services loosely coupled via RabbitMQ

---

## Testing

Currently, basic structure is in place. To add tests:

```bash
cd taskit-service
npm test

cd ../analytics-service
npm test
```

Tests run automatically in CI/CD pipeline.

---

## Performance & Scaling

### Current Configuration

- **Taskit replicas:** 3 (distributed load balancing)
- **Analytics replicas:** 3 (distributed load balancing)
- **Resource limits:** 256Mi memory, 250m CPU per pod
- **Resource requests:** 128Mi memory, 125m CPU per pod

### Scaling

To increase replicas:

```bash
# Edit deployment
kubectl edit deployment taskit

# Or patch directly
kubectl patch deployment taskit -p '{"spec":{"replicas":5}}'

# Monitor rollout
kubectl rollout status deployment/taskit
```

---

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [k3s Lightweight Kubernetes](https://k3s.io/)
- [Terraform OpenStack Provider](https://registry.terraform.io/providers/terraform-provider-openstack/openstack/latest/docs)
- [Ansible Documentation](https://docs.ansible.com/)
- [GitLab CI/CD](https://docs.gitlab.com/ee/ci/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html)

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

## Author

**Elsa Gas Wikström** – Cloud Native Applications (2DV013)

*Linneus University, 2025*