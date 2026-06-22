# Health Checks and Configuration Reference

> Authority: [docs.openshift.com/container-platform/4.14/applications/application-health.html](https://docs.openshift.com/container-platform/4.14/applications/application-health.html) and [nextjs.org/docs/app/building-your-application/routing/route-handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

OpenShift requires liveness and readiness probes for production deployments. Environment variables must come from ConfigMaps and Secrets, never hardcoded in the Deployment.

---

## Health check endpoint

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { status: 200 }
  )
}
```

For a deeper health check that verifies backend connectivity:

```ts
// app/api/health/route.ts
export async function GET() {
  try {
    const agentRes = await fetch(`${process.env.AGENT_BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })

    return Response.json({
      status: agentRes.ok ? 'ok' : 'degraded',
      agent: agentRes.ok ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    }, { status: agentRes.ok ? 200 : 503 })
  } catch {
    return Response.json(
      { status: 'degraded', agent: 'unreachable', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
```

---

## OpenShift Deployment probe configuration

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
        - name: myapp
          image: registry.example.com/myapp:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          envFrom:
            - configMapRef:
                name: myapp-config
            - secretRef:
                name: myapp-secrets
```

---

## ConfigMap for non-sensitive env vars

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  AGENT_BACKEND_URL: "http://agent-service:8080"
  NEXT_PUBLIC_APP_NAME: "MyApp"
  NODE_ENV: "production"
  PORT: "3000"
```

Apply:
```bash
oc apply -f configmap.yaml
```

---

## Secret for sensitive values

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
type: Opaque
stringData:
  MLFLOW_TRACKING_URI: "http://mlflow-service:5000"
  DATABASE_URL: "postgresql://user:pass@db:5432/myapp"
```

Never commit `secret.yaml` with real values. Use sealed secrets or inject via CI:

```bash
oc create secret generic myapp-secrets \
  --from-literal=MLFLOW_TRACKING_URI=http://mlflow:5000 \
  --from-literal=DATABASE_URL=postgresql://...
```

---

## Tekton pipeline task (outline)

```yaml
# tekton/build-and-push.yaml
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: build-nextjs
spec:
  params:
    - name: image
      type: string
    - name: context
      type: string
      default: "."
  steps:
    - name: build
      image: registry.access.redhat.com/ubi9/buildah:latest
      script: |
        buildah bud \
          --format=docker \
          --tls-verify=false \
          -f Dockerfile \
          -t $(params.image) \
          $(params.context)

    - name: push
      image: registry.access.redhat.com/ubi9/buildah:latest
      script: |
        buildah push \
          --tls-verify=false \
          $(params.image) \
          docker://$(params.image)
```

---

## OpenShift Route for HTTPS

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: myapp
spec:
  to:
    kind: Service
    name: myapp
  port:
    targetPort: 3000
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

Edge TLS termination: OpenShift terminates TLS at the router; traffic within the cluster is HTTP. This is the standard pattern — no TLS certificates needed in the Next.js container.
