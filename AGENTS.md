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

## Scans (Gemma 4 OCR)

- Route `/dandar/scans` (`ui/src/pages/ScansPage.tsx`, `ui/src/modules/scan/`)
  with a student tab (`ScanWizard` + own list) and a teacher tab (inbox).
  `ScanWizard` follows the Pure-Ed "Скан" design: upload → check → save, the
  photo beside editable fields with confidence badges.
- Nothing is stored before the student confirms: `dandarScanRead` only reads,
  `dandarScanSave` stores the checked fields. Field limits are mirrored in
  `FIELD_LIMITS` (`ui/src/modules/scan/ScanWizard.tsx`).
- Roles follow the record, not a setting: `studentId` is the uploader,
  `teacherId` an erxes team member picked with `SelectMember`. Every model
  query filters by the acting user (`api/src/modules/scan/db/models/Scan.ts`).
- Permissions: `dandarScansSubmit` (upload, own list, send to teacher) and
  `dandarScansReview` (inbox, review).
- `dandarScanRead` runs `readScan` (`api/src/modules/scan/readScan.ts`):
  one vision call transcribes, a second sees the photo plus text and returns
  JSON `{kind, title, subject, summary, confidence}`; `confident` is false for
  low confidence or `[?]` in the text. On save, `note` keeps a summary; `exam`
  goes to `teacherId` (`sent`) or waits for one (`awaiting_teacher`).
- `CameraButton` (`ui/src/modules/scan/CameraButton.tsx`, used by
  `ScanWizard` and `AddCards`) opens a live camera dialog when the page is a
  secure context (localhost/HTTPS) and otherwise `<input capture>` for the
  phone camera app (plain http on the LAN). Shots go through `prepareImage`
  like uploads; the stream stops when the dialog closes.
- Photos are stored as base64 in `dandar_scans` and returned only by
  `dandarScanDetail` (`imageUrl`); lists project them out. The UI re-encodes
  to JPEG ≤1600 px because the Apollo Router rejects bodies over 2 MB;
  `MAX_IMAGE_CHARS` (1 500 000) is mirrored in `ui/src/modules/scan/image.ts`.
- `api/src/modules/scan/constants.ts` must not import mongoose or
  erxes-api-shared: `print-schema` loads it and would otherwise never exit.

## Study cards (Anki-style review, exams, Gemma 4 card drafts)

- Route `/dandar/study?tab=review|add|exams|library`
  (`ui/src/pages/StudyPage.tsx`, `ui/src/modules/study/`). The tab and, for
  `tab=add`, the `scan` id live in the URL: "Миний материал" links to
  `/dandar/study?tab=add&scan=<id>` and `AddCards` starts a draft from it.
- Scheduling is pure code, no LLM: `api/src/modules/study/logic/`
  (`forgettingCurve.ts` `R = exp(-t/S)`, `scheduler.ts` four grades
  `forgot|unsure|know|easy` that update stability `S` and the next due time,
  `mastery.ts` weak decks, `exam.ts` `applyExam`: as an exam date nears,
  intervals shrink so each card gets `TARGET_ROUNDS` (4) reviews, and nothing
  is due later than the day before the exam). `pnpm --filter dandar_api test`
  runs the combined unit tests (`tsx --test`, using the same TypeScript
  module handling as the API so planner resolver tests can load its config).
- Gemma only writes content: `dandarCardsDraft` (notes, a photo, or a saved
  scan) and `dandarCardHelp` (hint / explain / mnemonic). Prompts and the
  JSON parser are in `api/src/modules/study/cardGen.ts`; calls go through
  `askGemma` with its `image` option. The material is passed as data and the
  prompt says to ignore instructions inside it.
- Nothing is stored before the student checks it: `dandarCardsDraft` returns
  cards, `DraftEditor` lets the student edit/drop them, `dandarCardsSave`
  stores them (and, when the material states an exam date, schedules the
  deck). Limits are mirrored in `AddCards.tsx` / `DraftEditor.tsx`.
- From scans: `scanIds` (up to 5, `MAX_DRAFT_SCANS`) reuse the scans' stored
  `text` (no second photo upload) and are accepted only for the signed-in
  student's own scans. Cards keep `scanIds`; `dandarScanCardCounts` tells
  `ScanPicker` which earlier scans already became cards.
  `useScanImages` also sends each scan's stored photo (one Gemma call per
  scan, `mergeDrafts` joins them; one failed call still returns the rest).
- Exam papers (`kind: exam`) always get their own call with the practice
  rules in `cardSystemPrompt`: new questions of the same kind with short
  solutions, never answers to the paper's own questions (academic
  integrity). The draft comes back with `examMode: true`, `DraftEditor`
  asks the student to check the answers, and a date found in the material
  pre-fills the exam schedule.
  Photos taken in the card form go through the same `prepareImage` as scans
  (JPEG ≤1600 px, `MAX_IMAGE_CHARS`) and `assertImage` from `graphql/scan.ts`.
- Data: `dandar_study_cards` (`userId`, `topicId` = deck, `front`, `back`,
  `scanIds`, stability, lapses, reviews, `lastReviewedAt`, `dueAt`),
  `dandar_study_exams` (`userId`, `deck`, `examAt`, unique per user and deck)
  and `dandar_study_settings` (reminder toggles, hour, quiet hours).
  Every query filters by `userId`; permissions `dandarStudyRead` /
  `dandarStudyWrite`.

- Review keys: Space/Enter shows the answer, 1–4 grade, S skips (skipping
  only reorders the session; the schedule stays).
- Every grade is logged in `dandar_study_reviews` (`source: review|quiz`);
  the Ахиц tab (`dandarStudyProgress`, `logic/progress.ts`) shows active days
  of the last 7, reviews per local day and a 7-day due forecast. When the
  queue empties, `SessionSummary` lists hard cards and can draft Gemma cards
  that ask them from another angle (normal draft → check → save flow).
- Тест tab (`graphql/studyPractice.ts`, `logic/quiz.ts`): multiple choice
  built from the student's own cards (wrong choices are other cards' answers,
  same deck first; no model call). `dandarQuiz` never returns the answer;
  `dandarQuizAnswer` checks it and reschedules the card (right = know,
  wrong = forgot).
- Багц tab: search (`dandarStudyCards(search)`, escaped regex on front/back),
  edit a card (`dandarCardUpdate`), rename a deck (`dandarDeckRename`, moves
  its exam unless the target has one) and delete a deck with its exam
  (`dandarDeckDelete`).

## Notifications

- `api/src/modules/notify/notify.ts` `notifyUsers` sends a `system`
  notification to the erxes bell through `sendNotification` (tRPC to core).
  It imports `erxes-api-shared` lazily because `graphql/*.ts` use it and
  `print-schema` must not open the platform's Redis. A failed notification
  is logged and never fails the action.
- Triggers: a scan sent to a teacher (`dandarScanSave` with a teacher,
  `dandarScanSendToTeacher`) notifies the teacher; `dandarScanReview`
  notifies the student.
- Study reminders: `api/src/modules/study/reminders.ts`, started from
  `onServerInit`, ticks every 10 minutes over tenants recorded in the Redis
  set `dandar:study:tenants` (`rememberTenant` in `apolloServerContext`).
  `logic/reminders.ts` `planReminders` decides: a daily review reminder when
  cards are due and exam reminders 7/3/1 days before, only at the student's
  `reminderHour` and never inside quiet hours. A Redis `SET NX` key per
  reminder makes it go out once across replicas. Env: `STUDY_REMINDERS=off`
  disables it, `STUDY_TZ_OFFSET_MINUTES` (default 480, Ulaanbaatar) sets the
  students' local time.

## Voice (OmniVoice + Chimege)

- Text-to-speech goes through `api/src/modules/voice/tts.ts`, which picks
  `TTS_PROVIDER`: `omnivoice` (default) calls the Gradio app at
  `OMNIVOICE_URL` (`/gradio_api/call/_design_fn`, language `Mongolian`,
  `OMNIVOICE_GENDER`; `api/src/modules/voice/omnivoice.ts`) and downloads the
  24 kHz WAV only from that host; `chimege` uses `synthesize` below. The
  public Space needs no key but has a shared GPU quota (`OMNIVOICE_HF_TOKEN`
  raises it); self-host with `omnivoice-demo` on a GPU for demos.
- Speech-to-text uses Chimege when `CHIMEGE_STT_TOKEN`/`CHIMEGE_TOKEN` is set,
  otherwise the browser's Web Speech API in `mn-MN`
  (`ui/src/modules/voice/browserDictation.ts`, Chrome/Edge only);
  `MicButton` takes `useChimege` to pick one.
- Voice planning (`ui/src/modules/planner/VoicePlan.tsx`, header button
  "Дуугаар төлөвлөх"): the student speaks or types, `dandarPlanFromSpeech`
  (`api/src/modules/planner/voicePlan.ts`) asks Gemma for `{tasks, windows}`
  using the planner's time zone and local time, then the planner `schedule()`
  engine places sessions in those windows. Nothing is stored until
  "Төлөвлөгөөнд нэмэх" saves each task (`task`) and the sessions (`confirm`)
  through `dandarPlannerUpdate`. Transcript ≤2000 chars, ≤10 tasks.

- `api/src/modules/voice/chimege.ts` owns every Chimege call: `synthesize`
  (POST `<CHIMEGE_API_URL>/synthesize`, `Token` header, plain text in, audio
  out) and `transcribe` (POST `/transcribe`, 16 kHz mono WAV in, text out).
  The console issues one token per API: `CHIMEGE_TOKEN` (TTS) and
  `CHIMEGE_STT_TOKEN` (STT, falls back to `CHIMEGE_TOKEN`). A missing token
  makes `dandarVoiceStatus.configured` / `sttConfigured` false and the UI
  hides that control; errors are `VOICE_NOT_CONFIGURED` /
  `VOICE_PROVIDER_ERROR`.
- GraphQL (`api/src/graphql/voice.ts`): `dandarVoiceStatus`,
  `dandarSpeak(text)` → `audioUrl` data URL (≤300 chars, mirrored in
  `ui/src/modules/voice/useSpeak.ts`), `dandarTranscribe(audioData)` (base64
  WAV ≤30 s, `MAX_AUDIO_CHARS` mirrored in `ui/src/modules/voice/recordWav.ts`).
- The browser records WebM/Opus; `recordWav.ts` resamples to 16 kHz mono PCM
  WAV before upload.
- Planner: a delivered reminder is also read aloud when "Дуут сануулга" is on
  (per-device, `localStorage` key `dandar:voiceReminders`); each reminder row
  has a listen button and the task title has a microphone (`MicButton`).

## Gemma 4 (AI, optional)

- The "Ask Gemma 4" card lives on the settings page, not the overview.

- `api/src/modules/ai/gemma.ts` owns every model call (`askGemma`,
  `getAiStatus`); resolvers never call a provider directly. `AI_PROVIDER`
  selects `gemini` (Gemini API `generateContent`, thought parts dropped) or
  `openai` (any OpenAI-compatible `/chat/completions`: Ollama, DigitalOcean).
  Calls use Node's `fetch` with a 60 s timeout (180 s with an image); there is
  no AI SDK dependency. `askGemma`'s options take an `image` (base64 +
  mimeType: Gemini `inlineData`, OpenAI-compatible `image_url` data URL) and a
  `temperature`.
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
`scripts/set-mongo-url.sh` writes `MONGO_URL` into both `.env` files from the
Atlas driver string (asks for `<db_password>` separately, adds the `erxes`
database; `--check` only tests it); `setup-erxes.sh` calls it and skips the
Cypress/Puppeteer browser downloads. `scripts/wsl-dns.sh` (sudo, opt-in) makes
WSL DNS survive lossy wifi; `setup-wsl.sh` suggests it when lookups fail.

`scripts/start-all.sh` checks MongoDB reachability, then starts plugin API →
erxes backend → core-ui → plugin UI → VS Code tunnel detached, skipping
anything already listening (logs and pid files in `~/logs`) and restarting the
backend once if the gateway crashes while Apollo Router starts;
`scripts/stop-all.sh` kills those process groups and any orphaned Apollo
Router. `start-all.sh --host [IP]` serves phones on the same wifi: it binds
core-ui to `0.0.0.0`, exports the Windows LAN address as
`REACT_APP_API_URL`, `DOMAIN` (gateway CORS) and `UI_ENTRY_URL`, refuses to
reuse services started for another host (`~/logs/public-host`), and prints the
admin `scripts/phone-forward.ps1` command (port proxy + LocalSubnet firewall
rule for 3001/3099/4000; 3399 stays private) while WSL's NAT address is not
forwarded. `REMOTE.md` covers serving erxes from a home PC to a laptop through a
VS Code Remote Tunnel and sharing it with the team through Live Share.
`scripts/vscode-tunnel-login.mjs` logs the VS Code CLI in with GitHub (VS
Code's OAuth app, `read:user read:org`): the CLI's own device login gets
stuck on `slow_down`, and GitHub CLI tokens are rejected by the tunnel service.
