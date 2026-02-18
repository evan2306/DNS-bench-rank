# DNS Benchmark UI

Local DNS resolver benchmark dashboard built with Vue + Vite + JavaScript and a Node UDP backend.

## What It Measures

- Sends direct UDP DNS queries to each resolver on port `53`.
- Runs both:
  - `cached` mode: repeated queries on known domains
  - `uncached` mode: random subdomain queries to reduce cache hits
- Displays per resolver:
  - cached median ms
  - uncached median ms
  - combined score ms
  - success rate
  - live progress and last error

## Similarity To GRC DNS Benchmark

This is closer to GRC than pure DoH tests because it measures UDP/53 resolver latency directly.  
Results are still not guaranteed to be identical due to differences in query sets, timing strategy, and your network path at runtime.

## Default Providers

- HiNet: `168.95.1.1`, `168.95.192.1`
- Google: `8.8.8.8`, `8.8.4.4`
- Cloudflare: `1.1.1.1`, `1.0.0.1`
- Quad9: `9.9.9.9`, `149.112.112.112`
- OpenDNS: `208.67.222.222`, `208.67.220.220`
- AdGuard: `94.140.14.14`, `94.140.15.15`

## Run

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://127.0.0.1:8787`

## Scripts

- `npm run dev` - starts backend and Vite together
- `npm run dev:server` - backend only
- `npm run dev:client` - frontend only
- `npm run build` - Vite production build
- `npm run preview` - preview build output

## Notes

- Intended for local use.
- Some networks block UDP DNS egress; if so, you will see high timeout rates.
- Custom resolvers can be added in UI and are stored in local storage.
