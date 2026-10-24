# DanDar: шинэ компьютер дээр тохируулах (Windows + WSL2)

Энэ заавар Windows компьютер дээр erxes болон DanDar plugin-ийг тэгээс эхлэн асаана.
Интернэтийн хурднаас хамаараад 30–40 минут орно.

erxes нь Windows дээр шууд ажиллахгүй: gateway нь Apollo Router-ийг `curl | sh`-ээр
татдаг, serve командууд нь Unix бичиглэлтэй. Тиймээс бүгдийг WSL2 Ubuntu дотор ажиллуулна.

## Бэлдэх зүйлс

- Windows 10/11, 15 GB сул зай, 8 GB-аас дээш RAM.
- GitHub account, `Ariubilig/dandar` repo-д хандах эрхтэй. Repo private байгаа үед
  багийн гишүүдийг GitHub → Settings → Collaborators хэсгээс нэмнэ.
- MongoDB Atlas-ийн `MONGO_URL` (password-тай).
  **Atlas → Network Access** хэсэгт тухайн компьютерийн IP-г нэмнэ. Hack Day дээр сүлжээ өөр
  байх тул тэнд дахин нэмэх эсвэл түр `0.0.0.0/0` зөвшөөрнө.
- Google AI Studio key: <https://aistudio.google.com/apikey> (үнэгүй).

## 1. WSL2 Ubuntu суулгах (PowerShell)

```powershell
wsl --install -d Ubuntu-24.04
```

Анх асахад username (зөвхөн жижиг үсэг, жишээ нь `rari`) болон password үүсгэнэ.
WSL анх удаа суулгаж байгаа бол компьютерээ restart хийхийг шаардаж магадгүй.

Цаашдын бүх командыг **Ubuntu terminal** дотор ажиллуулна (Start → Ubuntu, эсвэл
PowerShell-д `wsl -d Ubuntu-24.04`).

## 2. GitHub-д нэвтэрч repo татах

```bash
sudo apt update && sudo apt install -y git gh
gh auth login
git config --global user.name "Таны нэр"
git config --global user.email "tanii@email.com"
mkdir -p ~/erxes-plugins
gh repo clone Ariubilig/dandar ~/erxes-plugins/dandar
cd ~/erxes-plugins/dandar
```

`gh auth login` дээр: GitHub.com → HTTPS → Login with a web browser гэж сонгоно.
Browser нээгдэхгүй бол дэлгэцэнд гарсан кодыг <https://github.com/login/device> дээр оруулна.

## 3. Системийн багцууд: Node 22, Redis, pnpm

```bash
sudo bash scripts/setup-wsl.sh
```

Redis нь WSL асах бүрт өөрөө асдаг тул Docker хэрэггүй.

## 4. erxes (10–15 минут)

```bash
bash scripts/setup-erxes.sh
```

`MONGO_URL` асууна, бичихэд дэлгэцэнд харагдахгүй. Скрипт erxes-ийг `~/erxes` руу clone
хийж, `.env` бичээд `pnpm install` болон shared library build-ийг ажиллуулна.

## 5. DanDar plugin

```bash
bash scripts/setup-plugin.sh
```

`GEMINI_API_KEY` асууна. Дараа нь нэмж болно: `~/erxes-plugins/dandar/.env` файлд
`GEMINI_API_KEY=...` мөрийг бөглөнө.

## 6. Асаах: дараалал чухал

Дөрвөн Ubuntu terminal нээнэ (Windows Terminal дээр шинэ tab нээгээд `wsl -d Ubuntu-24.04`):

| #   | Юу            | Команд                                          | Порт       |
| --- | ------------- | ----------------------------------------------- | ---------- |
| 1   | Plugin API    | `cd ~/erxes-plugins/dandar && pnpm run dev:api` | 3399       |
| 2   | erxes backend | `cd ~/erxes && pnpm dev:core-api`               | 4000, 3300 |
| 3   | erxes UI      | `cd ~/erxes && pnpm nx serve core-ui`           | 3001       |
| 4   | Plugin UI     | `cd ~/erxes-plugins/dandar && pnpm run dev:ui`  | 3099       |

1-р terminal-ийг 2-оос **өмнө** асаана: gateway нь `ENABLED_PLUGINS`-д байгаа plugin бүрийг
хүлээдэг. Анх удаа 2-р terminal Apollo Router татна, нэг минут орчим болно.

Browser дээр <http://localhost:3001> нээнэ. Анх удаа owner account үүсгэнэ. Зүүн цэсэнд
**DanDar** гарч ирнэ. "Records" картад бичлэг нэмж, erxes-ийн харилцагчтай холбож туршаарай.
Харилцагч сонгохын тулд эхлээд erxes-ийн Contacts хэсэгт нэг харилцагч нэмнэ. Дараа нь
[BUILD.md](BUILD.md)-г дагаж өөрсдийн feature-ээ нэмнэ.

Шалгах:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/get-frontend-plugins
```

Эхнийх нь `ok`, хоёр дахь нь `dandar_ui` гэж буцаана.

## 7. Өдөр бүр

Компьютерээ асаасны дараа 6-р алхмын дөрвөн командыг дахин ажиллуулна. Terminal бүрт
Ctrl+C дарж зогсооно. Эсвэл нэг командаар бүгдийг арын горимд асааж болно (log: `~/logs/`):

```bash
bash ~/erxes-plugins/dandar/scripts/start-all.sh   # зогсоох: scripts/stop-all.sh
```

Скрипт эхлээд MongoDB холболтыг шалгаж, Atlas-д ямар IP нэмэхийг хэлдэг. Хэрэгтэй бол
`~/erxes`-д `git pull` хийгээд `pnpm install` ажиллуулна. erxes-ийг гэрийн PC дээр ажиллуулж
laptop-оос холбогдох бол [REMOTE.md](REMOTE.md)-г үзнэ.

## Gemma 4 тохиргоо

- **Анхдагч:** Google AI Studio, `gemma-4-26b-a4b-it` (хурдан). Илүү чанартай хариу хэрэгтэй
  бол `.env`-д `AI_MODEL=gemma-4-31b-it` гэж тавина.
- **Ollama (интернэтгүй, компьютер дээрээ):**
  `curl -fsSL https://ollama.com/install.sh | sh`, дараа нь `ollama pull gemma4:e4b`.
  `.env`-д: `AI_PROVIDER=openai`, `AI_BASE_URL=http://localhost:11434/v1`, `AI_MODEL=gemma4:e4b`.
- **DigitalOcean serverless inference:** `AI_PROVIDER=openai`,
  `AI_BASE_URL=https://inference.do-ai.run/v1`, `AI_API_KEY=<model access key>`,
  `AI_MODEL=<DigitalOcean дээрх model id>`.
- AI-д өгөх заавар (system prompt): `api/src/modules/ai/gemma.ts` доторх `TUTOR_SYSTEM_PROMPT`.

`.env` өөрчилсний дараа 1-р terminal-ийг (plugin API) restart хийнэ.

## Нэр, гарчиг солих

Дотоод нэр `dandar` нь GraphQL prefix, route, Redis key-д орсон тул **солихгүй** байх нь
хамгийн амар. Цэсэнд харагдах нэрийг солих бол `erxes.json` доторх `title`, `description`-ийг
өөрчилнө.

## Асуудал шийдэх

| Шинж тэмдэг                                                      | Шалтгаан                               | Шийдэл                                                                            |
| ---------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| `Waiting for plugin dandar to join service discovery` давтагдана | Plugin API асаагүй                     | 1-р terminal-ийг асаана                                                           |
| `Waiting for plugin  to join` (нэр хоосон)                       | `.env`-д `ENABLED_PLUGINS=` хоосон     | Мөрийг устгах эсвэл нэр бичнэ                                                     |
| `JavaScript heap out of memory`                                  | Node-ийн санах ойн хязгаар бага        | `~/erxes/.env`-д `NODE_OPTIONS=--max-old-space-size=6144` (8 GB RAM-тай бол 4096) |
| `MongoServerSelectionError`, холбогдохгүй                        | Atlas IP зөвшөөрөөгүй                  | Atlas → Network Access → Add Current IP Address                                   |
| "Ask Gemma 4" дээр "Not configured"                              | Key алга                               | `.env`-д `GEMINI_API_KEY` бөглөөд plugin API-г restart хийнэ                      |
| `Gemma request failed: ... quota`                                | AI Studio-ийн үнэгүй хязгаар           | Хэсэг хүлээнэ, эсвэл өөр model руу шилжинэ                                        |
| `localhost:3001` нээгдэхгүй                                      | core-ui асаагүй эсвэл build хийж байна | 3-р terminal-ийг шалгана                                                          |
| `C:\...` дотор ажиллуулахад алдаа гарна                          | erxes Unix орчин шаарддаг              | Бүгдийг Ubuntu дотор (`~/`) ажиллуулна                                            |

## Аюулгүй байдал

- `.env` файлууд git-д ордоггүй (`.gitignore`). Password, key-г repo-д хэзээ ч бичихгүй.
- core-api асахдаа `MONGO_URL`-ийг password-той нь log-д хэвлэдэг. Дэлгэцээ share хийхдээ
  болгоомжтой байгаарай. Hack Day-ийн дараа Atlas password-оо солиорой.

## Hack Day дээр repo-г public болгох

Эхлээд:

1. LICENSE нэмнэ. erxes core нь AGPLv3 тул plugin-д ямар license тохирохыг mentor-оос асууна.
2. README-д тэмцээний шаардлагуудыг бөглөнө: зорилго, боломжууд, stack, setup, erxes-тэй
   хэрхэн холбогддог, юу ажиллаж байгаа болон юу төлөвлөгдсөн.

Дараа нь:

```bash
gh repo edit Ariubilig/dandar --visibility public --accept-visibility-change-consequences
```
