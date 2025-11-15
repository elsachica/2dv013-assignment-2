# Just Task It – Cloud Native Applications (2DV013)

**Fullstack-projekt med Express, MongoDB, Redis, RabbitMQ, Docker, Kubernetes, Terraform och Ansible.**

---

## Projektöversikt

Detta projekt är en cloud native applikation med microservices-arkitektur.  
Två huvudtjänster ingår:

- **taskit-service** – backend för task management
- **analytics-service** – statistik och analys

Varje tjänst körs i egna containrar och har separata Kubernetes-manifests, vilket ger skalbarhet och enkel deployment.

**Tekniska highlights:**

- Microservices med event-driven kommunikation via RabbitMQ
- Containerisering med Docker
- Infrastruktur som kod med Terraform & Ansible
- CI/CD med GitLab pipelines
- Kubernetes (k3s) för orkestrering
- MongoDB för tasks, Redis för sessions, RabbitMQ för meddelanden
- MVC-mönster och PRG (Post/Redirect/Get) i backend

---

## Kom igång

Se [start_programs.md](start_programs.md) för en detaljerad steg-för-steg-guide.

**Snabbstart:**

1. Klona repot och installera beroenden
2. Provisionera infrastruktur med Terraform
3. Installera k3s-kluster med Ansible
4. Bygg och pusha Docker-images
5. Deploya appar till Kubernetes

---

## Hitta din site

Efter deployment, kör:

```bash
kubectl get svc
```

Besök i webbläsaren:

```
http://<SERVER_PUBLIC_IP>:<NodePort>
```

Byt ut `<NodePort>` mot porten för t.ex. `taskit` eller `analytics`.

---

### Direkta länkar till tjänster (exempel)

- **Analytics dashboard:**  
  http://194.47.171.189:31764
- **Just Task It:**  
  http://194.47.171.189:30908

  > Obs! Du måste vara ansluten till LNUs VPN för att kunna nå webbplatserna som körs på Cumulus/Openstack.
---

## Felsökning

- **Se status på pods och tjänster:**
  ```bash
  kubectl get pods -A
  kubectl get svc -A
  ```
- **Se loggar:**
  ```bash
  kubectl logs <pod-namn>
  ```
- **Rensa miljön:**
  ```bash
  kubectl apply -f k8s/ --recursive
  cd terraform
  terraform destroy
  ```

---

## Test och CI/CD

Automatiska tester och deployment körs via GitLab CI/CD.  
Se [.gitlab-ci.yml](.gitlab-ci.yml) för pipeline-definition.

---

## Struktur

- `taskit-service/` – Backend för task management
- `analytics-service/` – Microservice för statistik och analys
- `k8s/` – Kubernetes-manifests
- `terraform/` – Infrastruktur som kod
- `ansible/` – Automatiserad serverkonfiguration
- `.gitlab-ci.yml` – CI/CD-pipeline
- `start_programs.md` – Start- och felsökningsguide

---

## Licens

Detta projekt är licensierat under MIT-licensen. Se [LICENSE](./LICENSE) för mer information.