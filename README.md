# assignment-2-2dv013

Just Task It – Cloud Native Applications (2DV013)  
Fullstack-projekt med Express, MongoDB, Redis, RabbitMQ, Docker, Kubernetes, Terraform och Ansible.

--------__-----___--__--

I detta projekt har jag byggt en cloud native applikation med microservices-arkitektur. Applikationen består av två huvudtjänster: `taskit-service` (backend för task management) och `analytics-service` (för statistik och analys). Varje tjänst är isolerad och körs i egna containrar, vilket möjliggör skalbarhet och oberoende deployment.

Jag har använt flera moderna verktyg och mönster:
- **Microservices:** Varje tjänst har sin egen kodbas, Dockerfile och Kubernetes-manifest. Kommunikation mellan tjänster sker via RabbitMQ (event-driven architecture).
- **Containerisering:** All kod körs i Docker-containrar, vilket gör det enkelt att köra och deploya i olika miljöer.
- **Infrastructure as Code:** Infrastruktur provisioneras automatiskt med Terraform och konfigureras med Ansible. Detta gör det enkelt att reproducera och ändra miljön.
- **CI/CD:** Deployment och tester automatiseras med GitLab CI/CD, där pipeline-filen [`.gitlab-ci.yml`](.gitlab-ci.yml) bygger, testar och deployar tjänsterna till Kubernetes.
- **Kubernetes:** Applikationen körs i ett k3s-kluster, där varje tjänst har en egen deployment och service (NodePort) för extern åtkomst.
- **Persistens och state:** MongoDB används för lagring av tasks, Redis för sessions, och RabbitMQ för meddelandehantering mellan tjänster.
- **Designmönster:** Backend använder MVC (Model-View-Controller) med Express och EJS för vyer. PRG (Post/Redirect/Get) används för att undvika dubbla formulärsubmissions.

Utvecklingen har varit modulär och testbar tack vare tydlig separation mellan tjänster och användning av best practices för cloud native applikationer.
____---_____--___--__-______------

---

## Om projektet

Detta repo innehåller en komplett miljö för att köra och analysera en task management-app med microservices.  
Projektet är byggt för kursen 2DV013 och visar hur man automatiserar infrastruktur, deployment och CI/CD med moderna verktyg.

**Tekniker:**  
- Node.js/Express  
- MongoDB, Redis, RabbitMQ  
- Docker & Docker Compose  
- Kubernetes (k3s)  
- Terraform & Ansible  
- GitLab CI/CD

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
Besök:  
```
http://<SERVER_PUBLIC_IP>:<NodePort>
```
Byt ut `<NodePort>` mot porten för t.ex. `taskit` eller `analytics`.

---

## Felsökning

- Se status på pods och tjänster:
  ```bash
  kubectl get pods -A
  kubectl get svc -A
  ```
- Se loggar:
  ```bash
  kubectl logs <pod-namn>
  ```
- Rensa miljön:
  ```bash
  kubectl delete -f k8s/
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


---

## Licens

Detta projekt är licensierat under MIT-licensen.  
Se [LICENSE](./LICENSE) för mer information.