# Assignment 2 - Report

## 1. Architectural Patterns and Development

### 1.1 Architectural Patterns in Your Solution

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

**Extra aspekt (Skalbarhet och tillgänglighet med replicas)**  
För både Taskit och Analytics har jag satt `replicas: 3` i deras Kubernetes-manifester. Det innebär att tre instanser av varje tjänst körs parallellt, vilket ger:

- **Lastbalansering:** trafiken fördelas mellan flera pods via tjänstens Service (NodePort).
- **Hög tillgänglighet:** om en pod kraschar startas en ny automatiskt av Kubernetes.

```yaml
spec:
  replicas: 3
```

_För databastjänster som MongoDB, Redis och RabbitMQ används endast en replica, eftersom dessa annars kräver klustring för att bibehålla datakonsistens._

---

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

---

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

---

### 1.2 Debugging in a Cloud-Native Environment

Det största problemet jag hade i början var att få min gitlab CI/CD pipeline att att bygga och pusha mina images. I början skrev jag olika versioner av min `gitlab-ci.yml`, men ingen av dem fungerade då jag ofta stötte på problemet att Gitlab Shared Runners inte fungerade med `docker build`, detta på grund av att de saknade Docker-deamon.

Jag provade då andra alternativ, såsom Buildah, Docker Hub och Kaniko. Buildah strulade hela tiden och Docker Hub gav mig begränsningar, eftersom jag blev blockerad i 6 timmar efter att ha pushat mina images ett visst antal gånger. Dessutom läste jag att Docker Hub främst används för att dela images publikt, vilket jag inte var intresserad av. Kaniko kändes också tveksamt att använda, eftersom projektet verkade vara inaktuellt. Men jag kollade igenom projektexemplen från kursen och såg att många använde Kaniko, så jag testade det. Jag satte upp min pipeline med Kaniko och GitLab Container Registry, och då fick jag min pipeline att gå igenom.

Det tog mig lång tid att få min pipeline att fungera. Från att inte förstå var jag skulle lagra mina images, antingen på Docker Hub eller GitLab Container Registry, till att förstå vilket verktyg jag skulle använda. Jag insåg också hur värdefullt det är att kolla på exempel och dokumentation när man fastnar.

## 2. JTI Implementation and Reflection

### 2.1 The Problem of State

Jag märkte aldrig av problemet med sessioner när jag skalade upp, eftersom jag implementerade Redis som session store från början. Min tjänst hanterar inte heller någon inloggning, så det blev aldrig ett problem för mig. Men jag har förstått att om man lagrar sessioner i minnet på varje pod kan användare tappa sin session när de hamnar på en annan pod. Redis förhindrar detta, så när man skalar upp tjänsten tappar inte användarna sina sessioner, de blir till exempel inte utloggade.

### 2.2 The Asynchronous Data Flow

När en användare markerar en task som klar i Taskit (`taskit-service`) händer detta:

1. Användaren skickar en request (POST) från `taskRouter.js` till Taskit-backendens `TaskController.js`.

2. `TaskController.js` uppdaterar tasken i MongoDB och publicerar ett event (`task.updated`) via RabbitMQ.

3. RabbitMQ tar emot eventet och lägger det i en kö.

4. Analytics-service har `consumer.js` som lyssnar på RabbitMQ och tar emot eventet.

5. Analytics-service sparar eventet i `database.js` och uppdaterar statistiken.

6. `dashboard.ejs` hämtar och visar den uppdaterade statistiken.

Med RabbitMQ blir kommunikationen mellan Taskit och Analytics asynkron. Taskit behöver inte vänta på att Analytics har sparat eventet, och Taskit kan svara användaren direkt. Om Analytics skulle sluta fungera ligger eventet kvar i kön tills Analytics fungerar igen.

Utan RabbitMQ hade Taskit behövt anropa Analytics direkt, till exempel via HTTP. Detta gör att tjänsterna blir hårt kopplade. Om Analytics slutar fungera missas eventet och Taskit skulle få ett fel.

### 2.3 The Development Environment Trade-off

Det bästa med att använda Kubernetes var att jag fick testa hur det fungerar i "riktiga" projekt, precis som man gör på stora företag. Det känns värdefullt att ha fått prova på det och förstå hur deployment och skalbarhet funkar på riktigt.

Det mest frustrerande var att förstå hur allt hänger ihop, vilka kommandon jag skulle använda i terminalen, och vad som egentligen behövde vara med i YAML-filerna för att allt skulle fungera. Det tog tid att få koll på alla delar och hitta rätt när något strulade.
