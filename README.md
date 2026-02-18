<<<<<<< HEAD
# DNS Benchmark UI

Local DNS resolver benchmark dashboard built with Vue + Vite + JavaScript and a Node UDP backend.

## What It Measures

  - `cached` mode: repeated queries on known domains
  - `uncached` mode: random subdomain queries to reduce cache hits
  - cached median ms
  - uncached median ms
  - combined score ms
  - success rate
  - live progress and last error

## Similarity To GRC DNS Benchmark

This is closer to GRC than pure DoH tests because it measures UDP/53 resolver latency directly.  
Results are still not guaranteed to be identical due to differences in query sets, timing strategy, and your network path at runtime.

## Default Providers


## Run

```bash
npm install
npm run dev
```


## Scripts


## Notes

=======
# DNS-bench-rank
為了測 DNS 速度，自己手搓的一個測試網站
>>>>>>> ebea8912217c2146c4a04a07757bcb0316a7753b
