// Log the VS Code CLI in to GitHub for `code tunnel`.
//   node scripts/vscode-tunnel-login.mjs
// `code tunnel user login --provider github` can poll GitHub too fast, get
// stuck answering `slow_down`, and never pick up the approval. This runs the
// same device flow (VS Code's GitHub app and scopes) at the interval GitHub
// asks for, then hands the token straight to the CLI; it is never printed.
import { spawnSync } from "node:child_process";

const CLIENT_ID = "01ab8ac9400c4e429b23"; // VS Code CLI's GitHub OAuth app
const SCOPE = "read:user read:org"; // what the CLI requests for tunnels
const CODE_CLI = process.env.CODE_CLI ?? `${process.env.HOME}/.local/bin/code`;

const post = async (url, params) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return response.json();
};

const start = await post("https://github.com/login/device/code", {
  client_id: CLIENT_ID,
  scope: SCOPE,
});
if (!start.device_code) {
  console.error("GitHub refused the login request:", start);
  process.exit(1);
}
console.log(`Open ${start.verification_uri} and enter: ${start.user_code}`);
console.log("Then click 'Authorize Visual Studio Code'. Waiting…");

let interval = start.interval ?? 5;
const deadline = Date.now() + start.expires_in * 1000;

while (Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, (interval + 1) * 1000));
  const result = await post("https://github.com/login/oauth/access_token", {
    client_id: CLIENT_ID,
    device_code: start.device_code,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });

  if (result.access_token) {
    const login = spawnSync(
      CODE_CLI,
      ["tunnel", "user", "login", "--provider", "github", "--access-token", result.access_token],
      { stdio: "inherit" },
    );
    process.exit(login.status ?? 1);
  }
  if (result.error === "slow_down") {
    interval = result.interval ?? interval + 5;
    continue;
  }
  if (result.error !== "authorization_pending") {
    console.error(`GitHub login failed: ${result.error} ${result.error_description ?? ""}`);
    process.exit(1);
  }
}
console.error("The code expired; run this again for a new one.");
process.exit(1);
