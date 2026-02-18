import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function run(name, command, args) {
  const processHandle = spawn(command, args, {
    stdio: "inherit",
    env: process.env
  });

  processHandle.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code ?? 1);
  });

  children.push(processHandle);
  console.log(`[dev] started ${name}`);
}

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(0), 150);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

run("server", process.execPath, ["server/index.js"]);
run("client", npmCmd, ["run", "dev:client", "--", "--host"]);
