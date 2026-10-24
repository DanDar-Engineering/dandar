# 🚀 DanDar — AI-Powered Education Plugin

**DanDar** бол [erxes](https://erxes.io) платформд зориулсан, хиймэл оюун ухаанд суурилсан боловсролын нэмэлт модуль (EdTech Plugin) юм. Google-ийн Gemma AI загварыг ашиглан сурагчдын суралцах үйл явцыг дэмжих, багшийн ажлыг хөнгөвчлөх, эцэг эх болон сургуулийн харилцааг сайжруулах зорилготой.

DanDar нь сурагчдад гэрийн даалгавраа шалгуулах, хичээлээс тест үүсгэх, суралцах төлөвлөгөө гаргах зэрэг боломжийг нэг дороос хүргэнэ.

---

## ✨ Гол боломжууд

### 1. 📝 AI гэрийн даалгавар шалгагч
- Гараар бичсэн гэрийн даалгаврын зургийг оруулах.
- AI ашиглан бодолт болон хариултыг шинжлэх.
- Алдааг илрүүлж, монгол хэлээр ойлгомжтой тайлбар өгөх.
- Сурагчдад бодлогыг алхам алхмаар ойлгоход туслах.

### 2. 📚 AI тест үүсгэгч
- Багш хичээлийн текст болон сургалтын материалаа оруулах.
- AI ашиглан олон сонголттой тест үүсгэх.
- Сурагчдын хариултыг автоматаар шалгах.
- Оноо болон үр дүнг нэгтгэн харуулах.

### 3. 📊 Эцэг эхэд зориулсан долоо хоногийн тайлан
- Сурагчийн суралцах явц, идэвхийг нэгтгэх.
- Хувь хүнд тохирсон тайлангийн текст үүсгэх.
- erxes Broadcast ашиглан тайланг имэйл эсвэл SMS-ээр илгээх.

### 4. 💬 Сургуулийн AI туслах
- Сургуулийн элсэлт болон сургалтын талаар ирсэн асуултад хариулт бэлтгэх.
- Түгээмэл асуултуудад хурдан хариулахад туслах.
- erxes Frontline болон Messenger inbox-ийн ажлын урсгалтай интеграцчлах.

---

## 🛠 Технологийн стек

| Хэсэг | Технологи |
|---|---|
| Backend | Node.js 22, TypeScript |
| Frontend | React 18, Rspack |
| UI | Tailwind CSS v4 |
| API | GraphQL |
| Өгөгдлийн сан | MongoDB, Mongoose |
| Кэш болон асинхрон ажиллагаа | Redis |
| AI | Gemma загвар, Google AI Studio эсвэл Ollama |
| Платформ | erxes |
| Интеграц | Module Federation, erxes UI modules |

---

## 📁 Төслийн бүтэц

```text
dandar/
├── api/
│   ├── src/
│   │   ├── main.ts
│   │   ├── config.ts
│   │   ├── permissions.ts
│   │   ├── connectionResolvers.ts
│   │   ├── graphql/
│   │   │   └── schema.ts
│   │   └── modules/
│   │       ├── sample/
│   │       ├── ai/
│   │       │   └── gemma.ts
│   │       ├── planner/
│   │       ├── scan/
│   │       ├── study/
│   │       └── voice/
│   ├── package.json
│   └── tsconfig.json
│
├── ui/
│   ├── src/
│   │   ├── Main.tsx
│   │   ├── Navigation.tsx
│   │   ├── config.tsx
│   │   ├── components/
│   │   │   ├── PureLogo.tsx
│   │   │   └── PureIcons.tsx
│   │   ├── modules/
│   │   │   ├── ai/
│   │   │   │   ├── PureChat.tsx
│   │   │   │   └── AskGemma.tsx
│   │   │   ├── scan/
│   │   │   ├── study/
│   │   │   ├── planner/
│   │   │   └── voice/
│   │   └── styles/
│   │       ├── styles.css
│   │       └── pure-ed-theme.css
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── IDEAS.md
│   ├── erxes-integration.md
│   └── planner-reminders.md
│
├── scripts/
│   ├── setup-wsl.sh
│   ├── setup-erxes.sh
│   └── setup-plugin.sh
│
├── README.md
├── SETUP.md
├── BUILD.md
├── AGENTS.md
├── REMOTE.md
├── .env.example
└── erxes.json
```

---

## ⚙️ Шаардлагатай орчин

Төслийг ажиллуулахын өмнө дараах програмууд болон үйлчилгээнүүд бэлэн байх шаардлагатай.

- [Node.js 22](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Git](https://git-scm.com/)
- MongoDB
- Redis
- erxes хөгжүүлэлтийн орчин
- Gemma AI-д холбогдох API key эсвэл локал Ollama орчин

**Тайлбар:** MongoDB болон erxes-ийн тохиргоо нь ашиглаж буй хөгжүүлэлтийн орчноос хамаарна.

---

## 🚀 Суулгах ба ажиллуулах

### 1. Repository татах

```bash
git clone https://github.com/DanDar-Engineering/dandar.git
cd dandar
```

Хэрэв `asd` branch-ийн өөрчлөлтүүдийг ашиглах бол:

```bash
git switch asd
```

### 2. Хамаарлуудыг суулгах

Repository-ийн root хавтас болон дэд package-уудын тохиргоонд нийцүүлэн:

```bash
pnpm install
```

### 3. Environment тохируулах

`.env.example` файлыг `.env` болгон хуулж, шаардлагатай утгуудыг тохируулна.

```bash
cp .env.example .env
```

Жишээ тохиргоо:

```env
MONGO_URL=mongodb://localhost:27017/dandar
GEMINI_API_KEY=your_api_key_here
AI_PROVIDER=google
```

> `.env.example` файлд байгаа бодит хувьсагчдын нэр болон шаардлагатай утгуудыг шалгаж тохируулна. API key болон нууц мэдээллийг GitHub-д commit хийж болохгүй.

### 4. Үйлчилгээнүүдийг асаах

Хөгжүүлэлтийн орчноос хамааран тусдаа terminal-уудаар ажиллуулна.

**Terminal 1 — API**

```bash
pnpm run dev:api
```

**Terminal 2 — UI**

```bash
pnpm run dev:ui
```

**Terminal 3 — Redis**

```bash
redis-server
```

**Terminal 4 — erxes**

```bash
cd ~/erxes
pnpm run dev
```

> Дээрх командууд нь root `package.json`, erxes repository болон орчны тохиргоонд тохирсон байх шаардлагатай.

### 5. Хөгжүүлэлтийн хаягууд

| Үйлчилгээ | Хаяг |
|---|---|
| erxes gateway / core API | `http://localhost:3001` |
| DanDar UI | `http://localhost:3099` |
| DanDar plugin | `http://localhost:3001/dandar` |
| DanDar API | `http://localhost:3399` |

Эдгээр нь төслийн одоогийн тохиргоонд тулгуурласан хаягууд бөгөөд бодит порт болон plugin route-ийг `erxes.json`, package scripts болон erxes-ийн тохиргоотой тулгаж шалгана.

Нэмэлт зааврыг [`SETUP.md`](./SETUP.md)-ээс үзнэ үү.

---

## 🎨 UI дизайн ба анимэйшн

DanDar-ийн интерфэйс нь **Pure-Ed** дизайн чиглэлийг баримтална.

### Дизайны онцлогууд
- Дугуйрсан, тод дүрстэй SVG icon-ууд.
- Цэвэрхэн, ойлгомжтой navigation.
- AI чатад зориулсан тусгай loading animation.
- Суралцах үйл явцад тохирсон интерактив картууд.
- Зөөлөн хөдөлгөөн болон hover эффектүүд.

### Ашигласан анимэйшнууд

| Анимэйшн | Зориулалт |
|---|---|
| `animate-bounce-subtle` | Navigation элементүүд |
| `animate-pulse-glow` | Зураг уншуулах icon |
| `animate-flip` | Давтлагын карт |
| `animate-spin-slow` | Тохиргооны icon |
| `animate-bounce-up` | Чатын мессеж |

Navigation элементүүдэд hover хийхэд glow болон scale эффект ашиглана.

---

## 🧩 Backend архитектур

DanDar нь erxes plugin архитектуртай нийцүүлэн модульчилсан бүтэцтэй.

Үндсэн хөгжүүлэлтийн урсгал:

```text
GraphQL Schema
      ↓
MongoDB Model
      ↓
Resolver
      ↓
Permission
      ↓
Frontend Integration
```

Шинэ feature нэмэхдээ дараах зүйлсийг анхаарна:

1. GraphQL schema болон API-ийн төрлүүдийг тодорхойлох.
2. Шаардлагатай өгөгдлийн model үүсгэх.
3. Resolver болон бизнес логик боловсруулах.
4. Permission болон хандалтын эрхийг тохируулах.
5. Frontend-ийг GraphQL API-тай холбох.
6. TypeScript болон GraphQL code generation шалгалт хийх.

Дэлгэрэнгүй мэдээллийг [`BUILD.md`](./BUILD.md)-ээс үзнэ үү.

---

## 🤖 AI интеграц

DanDar нь Gemma загвар ашиглан сургалтын агуулгыг боловсруулах, асуултад хариулах болон тайлбар үүсгэх боломжтой.

AI интеграцын үндсэн модуль:

```text
api/src/modules/ai/gemma.ts
```

AI үйлчилгээний сонголт болон тохиргооноос хамааран Google AI Studio API эсвэл локал Ollama орчныг ашиглаж болно.

AI хариултуудыг боловсролын зориулалтаар ашиглахдаа:

- Хариултын үнэн зөв байдлыг шалгах.
- Алдаатай бодолт, тайлбарыг багш эсвэл сурагч нягтлах боломжтой байлгах.
- Сурагчдын хувийн мэдээллийг хамгаалах.
- AI-аас үүсгэсэн үнэлгээг шууд эцсийн шийдвэр болгохоос зайлсхийх.

---

## 🧪 Кодын чанар ба шалгалт

TypeScript-ийн алдааг шалгах:

```bash
pnpm exec tsc --noEmit
```

Энэ командыг ажиллуулахдаа тухайн package-ийн `tsconfig.json` болон script тохиргоог харгалзана.

GraphQL schema өөрчлөгдсөн тохиолдолд UI-ийн төрлүүдийг шинэчлэх шаардлагатай байж болно.

```bash
pnpm run codegen
```

> `codegen` команд нь root `package.json` эсвэл холбогдох package-д бүртгэлтэй эсэхийг шалгана.

---

## 📚 Баримт бичгүүд

| Файл | Тайлбар |
|---|---|
| [`SETUP.md`](./SETUP.md) | Шинэ компьютер дээр хөгжүүлэлтийн орчин тохируулах |
| [`BUILD.md`](./BUILD.md) | Шинэ feature болон модуль нэмэх |
| [`AGENTS.md`](./AGENTS.md) | Код бичих болон төслийн бүтцийн дүрэм |
| [`REMOTE.md`](./REMOTE.md) | Алсын хөгжүүлэлтийн орчны мэдээлэл |
| [`docs/IDEAS.md`](./docs/IDEAS.md) | MVP-ийн дөрвөн үндсэн санаа |
| [`docs/erxes-integration.md`](./docs/erxes-integration.md) | erxes интеграцын тайлбар |
| [`docs/planner-reminders.md`](./docs/planner-reminders.md) | Төлөвлөгөө болон сануулгын мэдээлэл |

---

## 🗺️ Хөгжүүлэлтийн замын зураг

- [x] DanDar plugin-ийн үндсэн бүтэц
- [x] AI болон сургалтын модулиудын суурь бүтэц
- [x] Pure-Ed UI дизайн болон icon-ууд
- [x] Navigation болон чатны анимэйшны сайжруулалт
- [ ] Гэрийн даалгавар шалгах урсгалыг бүрэн хэрэгжүүлэх
- [ ] AI тест үүсгэх, бөглүүлэх, үнэлэх процессыг дуусгах
- [ ] Эцэг эхийн тайлангийн автоматжуулалт
- [ ] Сургуулийн AI туслахын интеграцыг дуусгах
- [ ] Автомат тест болон production deployment

*Тэмдэглэл: Дээрх жагсаалт нь төслийн өгөгдсөн тоймд үндэслэсэн төлөвлөлт юм. Дууссан эсэхийг бодит код болон тестээр баталгаажуулна.*

---

## 🤝 Хувь нэмэр оруулах

DanDar төслийг хөгжүүлэхэд хувь нэмэр оруулахдаа:

1. Repository-г clone хийх.
2. Шинэ branch үүсгэх.
3. Өөрчлөлтөө хэрэгжүүлж, шалгалтуудыг ажиллуулах.
4. Commit болон push хийх.
5. Pull request нээж, өөрчлөлтийн зорилго болон тестийн үр дүнг тайлбарлах.

Branch нэрийн жишээ:

```bash
git switch -c feature/quiz-generator
```

---

## 🔐 Аюулгүй байдал

- API key болон нууц мэдээллийг source code-д хатуу бичихгүй.
- `.env` файлыг Git-д оруулахгүй.
- API endpoint-уудын хандалтын эрхийг шалгах.
- Сурагчдын мэдээлэл болон сургалтын үр дүнг хамгаалах.
- Production орчинд алдааны дэлгэрэнгүй мэдээллийг хэрэглэгчид задруулахгүй.

---

## 📄 Лиценз

Лицензийн мэдээлэл repository-д тусгагдаагүй бол ашиглах болон түгээх нөхцөлийг тодорхойлсны дараа энэ хэсгийг шинэчилнэ.

---

## 🌟 Төслийн тухай

**DanDar — Суралцахыг илүү ухаалаг, хүртээмжтэй, үр дүнтэй болгоё.**

GitHub: [DanDar-Engineering/dandar](https://github.com/DanDar-Engineering/dandar)

Branch: `asd`
