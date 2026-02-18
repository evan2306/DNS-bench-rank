export async function streamBenchmark({ providers, settings, onEvent, signal }) {
  const response = await fetch("/api/benchmark", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ providers, settings }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Benchmark request failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error("No streaming body in benchmark response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const raw = line.trim();
      if (!raw) {
        continue;
      }
      const event = JSON.parse(raw);
      onEvent(event);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    onEvent(JSON.parse(tail));
  }
}
