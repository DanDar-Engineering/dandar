# dandar

DanDar EdTech plugin for erxes, powered by Gemma 4

An erxes plugin outside the erxes monorepo: `api/` (Node.js 22,
erxes-api-shared startPlugin + tenant-scoped Mongoose models (Node.js)) and `ui/` (React 18 Module Federation remote). `erxes.json`
is the single source of the plugin's identity and ports.

## Commands

- `pnpm install`
- `pnpm run dev:api` / `pnpm run dev:ui`
- `pnpm run codegen`
- `pnpm run check`, `pnpm run lint`, `pnpm run build`, `pnpm run fmt`
- `docker build --build-arg UI_ENTRY_URL=<remoteEntry.js URL> -t <image> .`

Run `check`, `lint` and `build` before calling a change done.

## Naming invariants

See `docs/erxes-integration.md`. In short:

- `erxes.json` `name` (`dandar`) drives Redis keys, `ENABLED_PLUGINS`, the
  docker host `plugin-dandar-api` and the CDN folder `dandar_ui`.
- `ui.name` (`dandar`) is `CONFIG.name`, the page expose `./dandar`,
  and the API permission identity. Keep the public name, including dashes;
  `ui.remote` (`dandar_ui`) is what core-api derives from `name`.
- Change names only in `erxes.json`, and only all together.

## Contracts

- `api/src/main.ts` boots through erxes-api-shared `startPlugin`, which owns
  gateway registration (including `UI_ENTRY_URL`), `/health`, `/graphql`,
  gateway-header parsing and — in production — the router-update BullMQ job.
- Tenant data goes through `generateModels(subdomain, context)` onto `context.models`;
  never connect to Mongo directly. `checkPermission(action)` is on the context.
- Prefix every GraphQL type with `Dandar` and every operation and root
  field with `dandar`; the supergraph is shared by all plugins.
- `ui/src/config.tsx` exports `CONFIG`; `ui/src/Main.tsx` exports `Dandar`;
  the only baseline exposes are `./config` and `./dandar`. The plugin owns
  `/dandar/settings` and its sidebar through `AppLayout`; the host does not
  mount a separate settings expose. Keep `ui/rspack.config.ts` in sync with
  `erxes.json`. Add notification widgets only when implementing notifications.
- `api/src/print-schema.ts` prints `typeDefs` from `api/src/graphql/schema.ts` to `api/generated/schema.graphql`.
- `erxes-ui`, `ui-modules` and `erxes-api-shared` are the npm packages
  `@erxes/ui`, `@erxes/ui-modules` and `@erxes/api-shared`, installed under
  those import names with exact npm aliases. The tested cohort is
  `3.3.2`; update all three together and validate the deployment.

## Rules

- No `any`; named exports (default export only where a tool requires it, e.g.
  `rspack.config.ts`).
- The `hostShared` list in `ui/rspack.config.ts` (`react`, `react-dom`,
  `react-router`, `react-router-dom`, `@apollo/client`, `jotai`,
  `react-i18next`, `erxes-ui`, `ui-modules`) mirrors core-ui's shared
  singletons: they stay `import: false` and are never bundled — the host
  provides them at runtime. Keep the list in sync with core-ui's
  `coreLibraries`.
- `erxes-ui`/`ui-modules` imports resolve to the shared singleton at runtime,
  so the installed versions should match the host's — they only decide what
  TypeScript and Rspack resolve against.
- UI classes use the `dandar:` Tailwind prefix and the host tokens
  (`bg-background`, `text-muted-foreground`, `border-border`, …).
- Authorize in the API using `context.user`; the UI route guard is not a
  security boundary. Platform data resolvers must also await
  `checkPermission(action)` and use tenant-bound models and bounded pagination.
  Forwarded identity/tenant headers are trusted gateway assertions, not
  authentication: keep API ports private and strip client identity headers at
  the public ingress. See the integration docs before deployment.
- Every query has loading, error and empty states; refetch or update the
  Apollo cache after each mutation.
- GraphQL documents are `gql()` from `~/gql` — generated into `ui/src/gql/`
  by `codegen` from `api/generated/schema.graphql` — written as a function
  call on a static string with no `${}` interpolation.
- Apollo hooks infer their types from the document: no `useQuery<T>` or
  `useMutation<T>` generics and no handwritten response interfaces; derive
  types from the generated `*Query` types.
- `api/generated` and `ui/src/gql` are gitignored; `check`, `build` and
  `dev:ui` run `codegen` first. Run `pnpm run codegen` after changing a
  document or the schema.

## Example module and erxes data

- `Samples` is the reference feature: `dandar_samples` collection,
  `dandarSamples` (read, `dandarSamplesRead`) and `dandarSampleAdd` (create,
  `dandarSamplesWrite`). Resolvers share `requireTenantUser` and validate input
  (label 1–200 chars; `customerId` must match an erxes record id).
- Records store only the `_id` of erxes data (`customerId` → core Customer).
  The UI resolves it with `ui-modules` (`SelectCustomer`, `CustomersInline`);
  the API reads core through `sendTRPCMessage({ pluginName: "core", ... })`,
  never by querying core collections.
- `BUILD.md` is the step-by-step guide for adding a module; keep it in sync
  when the sample's structure changes.

## Gemma 4 (AI, optional)

- The "Ask Gemma 4" card lives on the settings page, not the overview.

- `api/src/modules/ai/gemma.ts` owns every model call (`askGemma`,
  `getAiStatus`); resolvers never call a provider directly. `AI_PROVIDER`
  selects `gemini` (Gemini API `generateContent`, thought parts dropped) or
  `openai` (any OpenAI-compatible `/chat/completions`: Ollama, DigitalOcean).
  Calls use Node's `fetch` with a 60 s timeout; there is no AI SDK dependency.
- `TUTOR_SYSTEM_PROMPT` stays server-side; the UI sends only the question.
  `MAX_PROMPT_LENGTH` (4000) is mirrored in `ui/src/modules/ai/AskGemma.tsx`.
- `dandarAsk` is a mutation: it spends provider quota. Missing configuration
  is reported as `AI_NOT_CONFIGURED`, upstream failures as
  `AI_PROVIDER_ERROR`. Never return or log keys.
- AI settings live in `.env` (see `.env.example`); restart `dev:api` after
  changing them.

## Machine setup

`SETUP.md` is the Windows + WSL2 setup guide; `BUILD.md` covers adding features. `scripts/setup-wsl.sh` (sudo),
`scripts/setup-erxes.sh` and `scripts/setup-plugin.sh` automate it;
`scripts/erxes.env.example` is the erxes `.env` template. Keep secrets out of
the repository: `.env` files are gitignored and the scripts ask for them.

`scripts/start-all.sh` checks MongoDB reachability, then starts plugin API →
erxes backend → core-ui → plugin UI → VS Code tunnel detached, skipping
anything already listening (logs and pid files in `~/logs`);
`scripts/stop-all.sh` kills those process groups and any orphaned Apollo
Router. `REMOTE.md` covers serving erxes from a home PC to a laptop through a
VS Code Remote Tunnel and sharing it with the team through Live Share.
`scripts/vscode-tunnel-login.mjs` logs the VS Code CLI in with GitHub (VS
Code's OAuth app, `read:user read:org`): the CLI's own device login gets
stuck on `slow_down`, and GitHub CLI tokens are rejected by the tunnel service.
