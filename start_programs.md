# Starta hela miljön – Steg för steg

**Steg 0 – Kontrollera VPN**

Innan du börjar, kontrollera att du är ansluten till skolans VPN. Många steg kräver åtkomst till resurser som bara är tillgängliga via VPN.

## Del 1 – Infrastruktur

1. Klona repo
2. Starta Docker Desktop
3. Ladda OpenStack-miljövariabler
4. Provisionera med Terraform
5. Generera Ansible-inventory
6. Testa anslutning till servrar
7. Installera k3s-kluster med Ansible
8. Hämta kubeconfig till din dator

Följ dessa steg för att sätta upp din infrastruktur och Kubernetes-kluster:

1. **Klona repot och installera beroenden**

   - Klona repot:
     ```bash
     git clone <repo-url>
     cd assignment-2-2dv013
     ```
   - Installera Ansible (om du inte har det):
     ```bash
     pipx install --include-deps ansible
     ```
   - Installera jq (om du inte har det):
     ```bash
     brew install jq
     ```

2. **Starta Docker Desktop**

   - Öppna Docker Desktop och kontrollera att det är igång:
     ```bash
     docker ps
     ```
   - Om du får en tom lista utan felmeddelande är Docker igång.

3. **Ladda OpenStack-miljövariabler**

   - Ladda miljövariabler:
     ```bash
     source .env
     # eller
     source ../eg223ps-2dv013-ht25-openrc.sh
     ```

4. **Provisionera infrastruktur med Terraform**

   - Initiera och skapa infrastruktur:
     ```bash
     cd terraform
     terraform init
     terraform apply
     cd ..
     ```

5. **Generera Ansible-inventory**

   - Skapa inventory-fil med server-IP:
     ```bash
     bash generate-inventory.sh
     ```
   - Filen `ansible/inventory.ini` används av Ansible för att veta vilka servrar som ska konfigureras.

6. **Testa anslutning till servrar**

   - Testa anslutning:
     ```bash
     cd ansible
     ansible all -i inventory.ini -m ping
     cd ..
     ```
   - Om det inte fungerar:
     - Ta bort `ansible/inventory.ini` och kör `bash generate-inventory.sh` igen.
     - Testa SSH manuellt:
       ```bash
       ssh -i ~/.ssh/eg223ps-keypair.pem ubuntu@<SERVER_PUBLIC_IP>
       ```
     - Svara `yes` på fingerprint-frågan om den dyker upp.
     - Kontrollera att port 22 är öppen i din OpenStack security group.
     - Om du får "Connection refused" eller "Connection closed by UNKNOWN port", kan servern vara nystartad eller ha felaktiga nätverksinställningar – vänta och testa igen.

7. **Installera k3s-kluster med Ansible**

   - Installera k3s på servrarna:
     ```bash
     ansible-playbook -i ansible/inventory.ini ansible/deploy-k3s.yml
     ```

8. **Hämta kubeconfig till din dator (för kubectl)**

   - Kopiera kubeconfig från servern:
     ```bash
     scp -i ~/.ssh/eg223ps-keypair.pem ubuntu@<SERVER_PUBLIC_IP>:/etc/rancher/k3s/k3s.yaml ./k3s.yaml
     ```
   - Uppdatera raden `server:` i `k3s.yaml` till din publika IP:
     ```yaml
     server: https://<SERVER_PUBLIC_IP>:6443
     ```
   - **Obligatoriskt för GitLab CI/CD:** Base64-koda kubeconfig och lägg in som variabel:

     ```bash
     base64 -i k3s.yaml | tr -d '\n'
     ```

     Kopiera hela strängen och lägg in den som variabel `KUBECONFIG_DATA` i GitLab CI/CD settings.

     > **OBS!** Ta inte med eventuellt `%`-tecken i slutet av strängen – det är en terminalprompt och ska inte vara med i variabeln.

   - Ladda in konfigurationen:

     ```bash
     export KUBECONFIG=./k3s.yaml
     kubectl get nodes
     ```

     Om du ser dina noder listade är allt korrekt installerat.

     **Exempel på utdata:**

   ```bash
   NAME         STATUS   ROLES                  AGE   VERSION
   k3s-server   Ready    control-plane,master   20h   v1.33.5+k3s1

   # NAME: Namnet på noden i klustret
   # STATUS: "Ready" betyder att noden är aktiv
   # ROLES: Vilka roller noden har (t.ex. control-plane, master)
   # AGE: Hur länge noden har varit igång
   # VERSION: Vilken version av Kubernetes/k3s som körs
   ```

---

## Del 2 – Docker (OPTIONAL)

1. Logga in på GitLab Container Registry
2. Bygg Docker-images
3. Pusha images till registry

## 1. Bygg och pusha Docker-images

GitLab Container Registry används för att bygga, lagra och hantera dina Docker-images. Alla images pushas hit och används sedan vid deployment till Kubernetes.

> **Obs!** Du behöver bara logga in och pusha images manuellt om du vill testa från din egen dator. Om du använder GitLab-pipelinen sker detta automatiskt – pipelinen bygger och pushar images till registryt utan att du behöver göra något manuellt.

### GitLab Container Registry

```bash
# Om du vill testa att pusha images manuellt:
# Logga in på GitLab Container Registry
# OBS! Använd en access token istället för ditt vanliga lösenord, särskilt om du har tvåfaktorsautentisering (2FA).
# Skapa en token under GitLab → Inställningar → Access Tokens med "read_registry" och "write_registry".
# Använd sedan:
echo <personal-access-token> | docker login gitlab.lnu.se:5050 -u <gitlab-username> --password-stdin

# Bygg och pusha images manuellt
docker build -t registry.gitlab.lnu.se/<namespace>/<repo>/taskit-backend:1.0.0 ./taskit-service
docker build -t registry.gitlab.lnu.se/<namespace>/<repo>/taskit-analytics:1.0.0 ./analytics-service
docker push registry.gitlab.lnu.se/<namespace>/<repo>/taskit-backend:1.0.0
docker push registry.gitlab.lnu.se/<namespace>/<repo>/taskit-analytics:1.0.0
```

> Kontrollera på [GitLab Container Registry](https://gitlab.lnu.se/<namespace>/<repo>/-/container_registry) att dina images finns uppladdade innan du går vidare.

---

## Del 3 – Kubernetes

1. Deploya appar till k3s med kubectl
2. Verifiera att allt fungerar (pods, services) + Besök webbsidan
3. Felsök vid behov
4. Stäng ner och rensa miljö

Följ dessa steg för att deploya och verifiera dina appar i Kubernetes-klustret:

1. **Deploya appar till k3s**

   - Första gången du deployar _(eller om du har ändrat i yaml filerna)_:
     ```bash
     kubectl apply -f k8s/
     # eller om du har undermappar i k8s mappen:
     kubectl apply -f k8s/ --recursive
     ```
     Detta skapar alla pods, services och deployments i klustret.

2. **Verifiera att allt fungerar**

   - Kontrollera status på pods och services:
     ```bash
     kubectl get pods -A
     kubectl get svc -A
     ```
   - Hitta NodePort-tjänsternas portar och IP:
     ```bash
     kubectl get svc
     ```
   - Besök din app i webbläsaren:
     ```
     http://<SERVER_PUBLIC_IP>:<NodePort>
     ```
   - Exempel: Om din server-IP är `194.47.171.50` och NodePort är `32249`, besök:
     ```
     http://194.47.171.50:32249
     ```
   - Byt ut `<SERVER_PUBLIC_IP>` och `<NodePort>` mot dina egna värden från `kubectl get svc`.

3. **Felsökning**

   - Felsök en pod:
     ```bash
     kubectl describe pod <pod-namn>
     kubectl logs <pod-namn>
     ```
   - Om du får `No resources found in default namespace`:
     - Inga pods körs i default-namespace just nu.
     - Möjliga orsaker:
       - Deployments har inte skapats eller har tagits bort.
       - Deployat till annat namespace än `default`.
       - Något gick fel vid deploy (`kubectl apply -f k8s/`).
   - Så här felsöker du:
     ```bash
     kubectl get pods -A
     kubectl get svc -A
     kubectl apply -f k8s/
     kubectl get deployments
     ```
   - Hitta NodePort för din service:
     ```bash
     kubectl get svc
     ```
     Leta efter raden för `taskit` eller `analytics`. Siffran efter `:` i PORT(S) (t.ex. `30312`) är din NodePort.

4. **Stäng ner och rensa miljön**
   - Om du vill ta bort allt:
     ```bash
     kubectl delete -f k8s/
     cd terraform
     terraform destroy
     ```

---

### Kolla status på ditt Kubernetes-kluster

Om du bara vill kontrollera att ditt kluster är igång och se status på noder och pods:

```bash
export KUBECONFIG=./k3s.yaml
kubectl get nodes
kubectl get pods
```

Detta visar vilka noder som är anslutna och vilka pods som körs i ditt kluster.
