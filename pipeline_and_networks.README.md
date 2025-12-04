---

## Del 4 – CI/CD Pipeline och Deployment

### Versionshantering i Pipeline (Viktigt!)

**Problem:** Om du använder hårdkodade image-versioner (t.ex. `taskit-backend:1.0.0`) i din `deployment.yaml` medan din pipeline bygger med dynamiska taggar (t.ex. `taskit-backend:main`), kommer Kubernetes **inte att uppdatera pods automatiskt**.

**Lösning:** Säkerställ att både pipeline och deployment använder **samma tagg** för Docker-imagen.

#### 1. Pipeline bygger med dynamisk tagg

I `.gitlab-ci.yml`:

```yaml
build_taskit:
    stage: build
    script:
        - /kaniko/executor --context "${CI_PROJECT_DIR}/taskit-service" \
            --dockerfile "${CI_PROJECT_DIR}/taskit-service/Dockerfile" \
            --destination "gitlab.lnu.se:5050/eg223ps/assignment-2-2dv013/taskit-backend:${CI_COMMIT_REF_SLUG}"
```

> **Tips:** `${CI_COMMIT_REF_SLUG}` motsvarar branch-namnet (t.ex. `main`, `develop`, `feature-x`).

#### 2. Deployment använder samma tagg

I `k8s/taskit/deployment.yaml`:

```yaml
spec:
    template:
        spec:
            containers:
                - name: taskit
                    image: gitlab.lnu.se:5050/eg223ps/assignment-2-2dv013/taskit-backend:main
                    imagePullPolicy: Always
```

- `image:` måste matcha taggen som pipelinen bygger.
- `imagePullPolicy: Always` gör att Kubernetes alltid hämtar senaste imagen.
- Undvik hårdkodade versioner som `taskit-backend:1.0.0` om du vill att pods ska uppdateras automatiskt.

**Resultat:**  
Varje gång du pushar till `main` sker följande:

1. Pipen bygger en ny image: `taskit-backend:main`
2. Deployment använder samma tagg
3. Kubernetes hämtar den nya imagen (tack vare `imagePullPolicy: Always`)
4. Pods uppdateras automatiskt med den senaste koden


---

### Nätverk och Port-mappning

**Problem:** Port-mappningen mellan container, service och externa portar kan bli förvirrande.

**Lösning:** Förstå skillnaden mellan:

#### 1. Container Port (inuti podden)

I `k8s/taskit/deployment.yaml`:

```yaml
spec:
  containers:
    - name: taskit
      ports:
        - containerPort: 3000  # ← Port INUTI containern (där appen lyssnar)
```

Din Node.js-app i `taskit-service/src/server.js` lyssnar på port 3000.

#### 2. Service Port (inuti klustret)

I `k8s/taskit/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: taskit
spec:
  type: NodePort
  selector:
    app: taskit
  ports:
    - port: 3000              # ← Port inuti klustret (andra pods kan nå den här)
      targetPort: 3000        # ← Forwarda till container port
      nodePort: 30908         # ← Port UTSIDAN av klustret (vad du besöker)
```

#### 3. NodePort (utsidan av klustret)

- `nodePort: 30908` är den port du använder från **utsidan**
- Du besöker: `http://<SERVER_PUBLIC_IP>:30908`
- Kubernetes forwarda automatiskt `30908` → `3000` → container

**Flux diagram:**

```
Din webbläsare
    ↓
http://194.47.171.50:30908
    ↓
Kubernetes Node (port 30908)
    ↓
Service taskit (port 3000)
    ↓
Pod taskit-654fff9898-fwzlp (containerPort 3000)
    ↓
Node.js-app lyssnar på :3000
```

#### 4. Security Group må öppnas

För att nå NodePort från utsidan måste OpenStack Security Group tillåta port-range `30000-32767`:

I `terraform/network.tf`:

```hcl
resource "openstack_networking_secgroup_rule_v2" "allow_nodeport" {
  direction          = "ingress"
  ethertype          = "IPv4"
  port_range_min    = 30000
  port_range_max    = 32767
  protocol           = "tcp"
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.default.id
}
```

---

### Alternativ: Ingress (Renare URL)

Om du vill ha en renare URL (utan port) kan du använda **Ingress**:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: taskit-ingress
spec:
  ingressClassName: traefik
  rules:
    - host: taskit.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: taskit
                port:
                  number: 3000
```

**Fördel:** `http://taskit.example.com` istället för `http://194.47.171.50:30908`

**Men för denna uppgift räcker NodePort fint!**

---

### Checklist för Deployment

Innan du deployar, kontrollera:

- [ ] Pipeline använder dynamisk tagg: `${CI_COMMIT_REF_SLUG}`
- [ ] Deployment använder samma tagg som pipeline
- [ ] `imagePullPolicy: Always` är satt
- [ ] `containerPort` matchar vad appen lyssnar på
- [ ] Service `port` pekar till `targetPort`
- [ ] `nodePort` är i range `30000-32767`
- [ ] Security Group tillåter NodePort-range
- [ ] Du är ansluten till VPN (för att nå GitLab Registry)

---

### Verifiera Deployment

```bash
export KUBECONFIG=./k3s.yaml

# Se pods
kubectl get pods -o wide

# Se services och portar
kubectl get svc

# Se image-version på pods
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'

# Besök appen
# http://<SERVER_PUBLIC_IP>:<NodePort>
```

Exempel:
```
taskit        NodePort       10.43.185.173   <none>        3000:30908/TCP
```

Besök: `http://194.47.171.50:30908` (byt IP mot din server-IP)
