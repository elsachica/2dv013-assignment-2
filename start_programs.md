# Starta hela miljön – Steg för steg

## 1. Klona repot och installera beroenden

```bash
git clone <repo-url>
cd assignment-2-2dv013
pipx install --include-deps ansible    # Om du inte redan har Ansible
brew install jq                        # Om du inte redan har jq
```

---

## 2. Starta Docker Desktop

Öppna Docker Desktop på din dator och se till att det körs innan du fortsätter.  
Du kan testa med:

```bash
docker ps
```

Om det visar en tom lista utan felmeddelande är Docker igång.

---

## 3. Ladda OpenStack-miljövariabler

```bash
source .env
# eller
source ../eg223ps-2dv013-ht25-openrc.sh
```

---

## 4. Provisionera infrastruktur med Terraform

```bash
cd terraform
terraform init
terraform apply
cd ..
```

---

## 5. Generera Ansible-inventory

```bash
bash generate-inventory.sh
```

> Scriptet skapar en `inventory.ini` med IP-adresserna till dina servrar så att Ansible vet vart det ska ansluta.

---

## 6. Testa anslutning till servrar

```bash
cd ansible
ansible all -i inventory.ini -m ping
cd ..
```

> Om det inte fungerar:  
> Ta bort manuellt `ansible/inventory.ini` och kör `bash generate-inventory.sh` igen.

---

## 7. Installera k3s-kluster med Ansible

```bash
ansible-playbook -i ansible/inventory.ini ansible/deploy-k3s.yml
```

---

## 8. Kopiera kubeconfig till din dator (för kubectl)

Hämta `k3s.yaml` från din server så att du kan styra klustret lokalt.

```bash
# Byt ut <SERVER_PUBLIC_IP> mot IP från inventory.ini
scp -i ~/.ssh/eg223ps-keypair.pem ubuntu@<SERVER_PUBLIC_IP>:/etc/rancher/k3s/k3s.yaml ./k3s.yaml
```

**Uppdatera server-IP i filen:**

Öppna `k3s.yaml` och ändra raden:

```yaml
server: https://127.0.0.1:6443
```

till din publika server-IP (hittas i `ansible/inventory.ini`), t.ex: server https://194.47.170.164:6443:

```yaml
server: https://<SERVER_PUBLIC_IP>:6443
```

**Ladda in konfigurationen:**

```bash
export KUBECONFIG=./k3s.yaml
kubectl get nodes
```

Om du ser dina noder listade är allt korrekt installerat.

---

## 9. Bygg och pusha Docker-images

Logga in på Docker Hub och bygg upp dina images:

```bash
# Logga in
docker login

# Bygg för rätt plattform:
docker buildx build --platform linux/amd64 -t <ditt-användarnamn>/taskit-backend:1.0.0 --push ./taskit-service
docker buildx build --platform linux/amd64 -t <ditt-användarnamn>/taskit-analytics:1.0.0 --push ./analytics-service

# Bygg images (byt ut <ditt-användarnamn>)
docker build -t <ditt-användarnamn>/taskit-backend:1.0.0 ./taskit-service
docker build -t <ditt-användarnamn>/taskit-analytics:1.0.0 ./analytics-service

# Pusha till Docker Hub
docker push <ditt-användarnamn>/taskit-backend:1.0.0
docker push <ditt-användarnamn>/taskit-analytics:1.0.0
```

> Kontrollera på [hub.docker.com](https://hub.docker.com) att dina images finns uppladdade innan du går vidare.

---

## 10. Deploya appar till k3s

```bash
kubectl apply -f k8s/

# eller om man har undermappar:
kubectl apply -f k8s/ --recursive
```

**Ta bort gamla pods om du ändrat images:**

```bash
kubectl delete pod -l app=taskit
kubectl delete pod -l app=analytics
```

---

## 11. Verifiera att allt fungerar

```bash
kubectl get pods -A
kubectl get svc -A
```

**Hitta NodePort-tjänsternas portar och IP:**

```bash
kubectl get svc
```

Besök sedan t.ex. `http://<SERVER_PUBLIC_IP>:<NodePort>` i webbläsaren.

**Felsök en pod:**

```bash
kubectl describe pod <pod-namn>
kubectl logs <pod-namn>
```

---

## 12. Felsökning och hitta din site

Om du redan gjort stegen ovan:

```bash
export KUBECONFIG=./k3s.yaml
kubectl get nodes
kubectl get pods
```

Om du får `No resources found in default namespace` betyder det att inga pods körs i default-namespace just nu.

**Möjliga orsaker:**
- Dina deployments har inte skapats eller har tagits bort.
- Du har deployat till ett annat namespace än `default`.
- Något gick fel vid deploy (`kubectl apply -f k8s/`).

**Så här felsöker du:**

```bash
kubectl get pods -A
kubectl get svc -A
kubectl apply -f k8s/
kubectl get deployments
```

**Hitta NodePort för din service:**

```bash
kubectl get svc
```

Leta efter raden för `taskit` (eller `analytics`).  
Exempel:

```
NAME      TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
taskit    NodePort   10.43.XXX.XXX   <none>        3000:3XXXX/TCP   XXd
```

Siffran efter `:` i PORT(S) (t.ex. `30312`) är din NodePort.

**Besök din site i webbläsaren:**

Öppna din webbläsare och gå till adressen:

```
http://<SERVER_PUBLIC_IP>:<NodePort>
```

**Exempel:**  
Om din server-IP är `194.47.171.50` och din NodePort är `32249`, besök:

```
http://194.47.171.50:32249
```

_Byt ut `<SERVER_PUBLIC_IP>` och `<NodePort>` mot dina egna värden från `kubectl get svc`._

**Om du har uppdaterat en fil i k8s:**
För att uppdatera deploymenten i klustret:
```bash
kubectl apply -f k8s/
```

---

> **Tips:**  
> Hur du stänger ner allt (rensa miljön): 
> 
> ```bash
> kubectl delete -f k8s/
> cd terraform  
> terraform destroy 
> ```
