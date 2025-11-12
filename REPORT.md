# Assignment 2 - Report

## 1. Architectural Patterns and Development

### 1. Microservices Pattern

**Beskrivning:**  
Applikationen är uppdelad i två separata tjänster:`taskit-service` och `analytics-service`.  
Varje tjänst har sin egen kodbas, Dockerfile och Kubernetes-manifests, samt hanterar sin egen databasanslutning.  
Tjänsterna är självständigt deploybara och kan skalas oberoende av varandra. Kommunikation sker via RabbitMQ.

**Kodreferenser:**
- `taskit-service/Dockerfile` och `analytics-service/Dockerfile`
- `k8s/taskit-deployment.yaml` och `k8s/analytics-deployment.yaml`
- Miljövariabler i deployment-filerna visar att varje container har sina egna beroenden (MongoDB, Redis, RabbitMQ).

**Motivering:**  
Denna struktur följer microservices-mönstret genom att dela upp systemet i små, självständiga delar med tydligt ansvar.  
Det gör applikationen skalbar och underhållbar.


**Extra aspekt – Skalbarhet och tillgänglighet med replicas**  
För både Taskit och Analytics har jag satt `replicas: 3` i deras Kubernetes-manifester. Det innebär att tre instanser av varje tjänst körs parallellt, vilket ger:

- **Lastbalansering:** trafiken fördelas mellan flera pods via tjänstens Service (NodePort).
- **Hög tillgänglighet:** om en pod kraschar startas en ny automatiskt av Kubernetes.

```yaml
spec:
  replicas: 3
```
_För databastjänster som MongoDB, Redis och RabbitMQ används endast en replica, eftersom dessa annars kräver klustring för att bibehålla datakonsistens._

-------------------------------------------------------------------------------------

### 2. Event-Driven Architecture (Observer Pattern)

**Beskrivning:**  
Tjänsterna kommunicerar asynkront genom events via RabbitMQ.  
När något händer i `taskit-service` (t.ex. en task skapas eller tas bort) publiceras ett event som `analytics-service` prenumererar på och lagrar som statistik.

**Kodreferenser:**
- I `taskit-service/src/controllers/TaskController.js` används funktionen `publishEvent()` för att skicka events (`task.created`, `task.updated`, `task.deleted`).
- I `analytics-service/consumer.js` används RabbitMQ:s konsumtionslogik för att lyssna på dessa events och spara dem via `saveMetric()`.

**Motivering:**  
Detta följer Event-Driven Architecture (Observer Pattern), där tjänster reagerar på händelser i stället för att direkt anropa varandra.  
Det gör systemet mer löst kopplat och mer robust.

-------------------------------------------------------------------------------------

### 3. Model–View–Controller (MVC)

**Beskrivning:**  
`taskit-service` använder MVC för att separera applikationslogik, datalager och vyer.  
Det gör koden enklare att testa, utöka och förstå.

**Kodreferenser:**
- Model: `models/TaskModel.js` – definierar Mongoose-modellen för en task.
- Controller: `controllers/TaskController.js` – hanterar CRUD-operationer och publicerar events.
- View: `views/tasks/*.ejs` – renderar gränssnittet för användaren (t.ex. `index.ejs`, `create.ejs`, `update.ejs`).

**Motivering:**  
Genom att separera ansvar mellan model, view och controller följer applikationen klassiskt MVC-mönster, vilket förbättrar kodstruktur och underhållbarhet.

-------------------------------------------------------------------------------------

## 2. JTI Implementation and Reflection
