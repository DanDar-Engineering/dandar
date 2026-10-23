# DanDar

DanDar EdTech plugin for erxes, powered by Gemma 4

**New machine?** Follow [SETUP.md](SETUP.md) (Windows + WSL2, in Mongolian).
Idea shortlist for the team: [docs/IDEAS.md](docs/IDEAS.md).

## Gemma 4

The overview page has an "Ask Gemma 4" card (`ui/src/modules/ai/AskGemma.tsx`)
backed by `api/src/modules/ai/gemma.ts`. GraphQL: `dandarAiStatus` and the
`dandarAsk(prompt)` mutation. Configure it in `.env`, then restart
`pnpm run dev:api`:

| Variable                     | Default              | Purpose                                                                                          |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `AI_PROVIDER`                | `gemini`             | `gemini` (Google AI Studio) or `openai` (OpenAI-compatible: Ollama, DigitalOcean)                |
| `AI_MODEL`                   | `gemma-4-26b-a4b-it` | `gemma-4-31b-it` on the Gemini API, `gemma4:e4b` on Ollama                                       |
| `GEMINI_API_KEY`             |                      | Key from https://aistudio.google.com/apikey                                                      |
| `AI_BASE_URL` / `AI_API_KEY` |                      | OpenAI-compatible endpoint, e.g. `http://localhost:11434/v1` or `https://inference.do-ai.run/v1` |

An erxes plugin that lives outside the erxes monorepo and joins an erxes stack.
The shared-library baseline is erxes 3.3.2. Dashed plugin names
use the same public permission identity in the API and UI; the host must support
normalized remote discovery and dashed page-module loading (see integration docs).

| Part   | Path         | Stack                                                                              | Dev port |
| ------ | ------------ | ---------------------------------------------------------------------------------- | -------- |
| API    | `api`        | Node.js 22, erxes-api-shared startPlugin + tenant-scoped Mongoose models (Node.js) | 3399     |
| UI     | `ui`         | React 18 Module Federation remote (Rspack), Tailwind CSS                           | 3099     |
| Shared | `erxes.json` | Plugin identity and ports read by both parts                                       |          |

The UI uses erxes's `erxes-ui`/`ui-modules` design system, installed from npm
(`@erxes/ui`, `@erxes/ui-modules`; see
[docs/erxes-integration.md](docs/erxes-integration.md#shared-libraries)). The
host supplies them at runtime via Module Federation singletons — they are
installed only so TypeScript and Rspack can resolve the imports.

## Develop

```sh
pnpm install
cp .env.example .env
pnpm run dev:api   # registers with the erxes gateway through Redis
pnpm run dev:ui    # serves http://localhost:3099/remoteEntry.js
```

`check`, `build` and `dev:ui` run `codegen` first, so the generated GraphQL
types always match the printed API schema.

In the erxes checkout `.env`, add the plugin and restart the gateway and
core-api so they pick it up:

```sh
ENABLED_PLUGINS=...,dandar
```

Then open `http://localhost:3001/dandar` (settings: `/dandar/settings`).
Both processes must use the same Redis as erxes; `UI_ENTRY_URL` must be
reachable by the browser, not merely by the API container. Requests reach the
API through the gateway (`/graphql`), which forwards the signed-in user and
tenant. Those headers are not independently authenticated: keep the API on
a private gateway-only network and strip user/tenant headers at public ingress.

## Scripts

| Script             | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `pnpm run dev:api` | API in watch mode                               |
| `pnpm run dev:ui`  | UI remote dev server                            |
| `pnpm run codegen` | Print the API schema, generate UI GraphQL types |
| `pnpm run build`   | Production build of every part                  |
| `pnpm run check`   | Type-check every part                           |
| `pnpm run lint`    | oxlint                                          |
| `pnpm run fmt`     | oxfmt                                           |

## Deploy

- **API**: `docker build --build-arg UI_ENTRY_URL=<remoteEntry.js URL> -t <image> .`
  Run `pnpm install` first and commit its lockfile before building the image.
  The image serves the API on port 80 and registers itself on start
  (`plugin-dandar-api:80` unless `LOAD_BALANCER_ADDRESS` is set).
- **UI**: upload `ui/dist` to a static host or CDN. Upload hashed assets
  first and `remoteEntry.js` last with `Cache-Control: no-store`. Without
  `UI_ENTRY_URL`, erxes falls back to `https://plugins.erxes.io/<release>/dandar_ui/remoteEntry.js`;
  this generator does not upload there. Set your own browser-reachable URL,
  serve all emitted chunks with CORS for the erxes origin, and use immutable
  caching only for content-hashed assets (not stable-named expose chunks).

See [docs/erxes-integration.md](docs/erxes-integration.md) for how the plugin
plugs into erxes and [AGENTS.md](AGENTS.md) for the rules to keep it working.
