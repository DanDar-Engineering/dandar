# Шинэ feature нэмэх

Тохиргоо хийж дууссаны дараа ([SETUP.md](SETUP.md)) багийн санааг энэ plugin дотор хийнэ.
Бүх жишээ бэлэн байгаа `Samples` модуль дээр тулгуурласан: тэр нь өөрийн өгөгдөл, нэмэх форм,
жагсаалт, erxes-ийн харилцагчтай холбох хэсгийг бүгдийг агуулсан бүрэн жишээ.

## Бүтэц

```text
api/src/
  main.ts                  startPlugin: erxes-д бүртгүүлэх, /graphql, /health
  config.ts                .env хувьсагчид
  connectionResolvers.ts   Mongoose model-уудыг бүртгэх (IModels)
  permissions.ts           эрхийн action-ууд
  graphql/schema.ts        GraphQL typeDefs болон resolvers
  modules/sample/db/       жишээ: definitions (schema) + models (method-ууд)
ui/src/
  config.tsx               erxes-ийн цэсэнд гарах нэр, icon
  Main.tsx                 route-ууд (/dandar/...)
  modules/Navigation.tsx   plugin доторх зүүн цэс
  pages/IndexPage.tsx      нүүр хуудас
  Samples.tsx              жишээ: форм + жагсаалт + erxes харилцагч
```

## Жишээ: "Хичээл" (Lesson) модуль нэмэх

### 1. Schema: `api/src/modules/lesson/db/definitions/lesson.ts`

`sample.ts`-ийг хуулж талбаруудаа өөрчилнө:

```ts
export interface ILesson {
  title: string;
  teacherId?: string; // erxes-ийн ажилтны (user) _id
  createdAt: Date;
}
export interface ILessonDocument extends ILesson, Document {}

export const lessonSchema = schemaWrapper(
  new Schema({
    title: { type: String, required: true },
    teacherId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now },
  }),
);
```

### 2. Model: `api/src/modules/lesson/db/models/Lesson.ts`

`Sample.ts`-ийг хуулна (`list`, `createSample` → `createLesson`).

### 3. Model бүртгэх: `api/src/connectionResolvers.ts`

```ts
export interface IModels {
  Samples: ISampleModel;
  Lessons: ILessonModel;
}
// loadClasses дотор:
models.Lessons = db.model<ILessonDocument, ILessonModel>("dandar_lessons", loadLessonClass(models));
```

Collection-ий нэр `dandar_` prefix-тэй байна.

### 4. Эрх: `api/src/permissions.ts`

```ts
export const LESSON_READ = "dandarLessonsRead";
export const LESSON_WRITE = "dandarLessonsWrite";
```

`modules` массивт `dandarSamples`-тай ижил бүтэцтэй шинэ модуль нэмнэ. Owner хэрэглэгч
бүх эрхтэй тул туршихад шууд ажиллана.

### 5. GraphQL: `api/src/graphql/schema.ts`

```graphql
type DandarLesson {
  _id: String!
  title: String!
  teacherId: String
  createdAt: String
}
# Query дотор:   dandarLessons(limit: Int = 20, offset: Int = 0): [DandarLesson!]!
# Mutation дотор: dandarLessonAdd(title: String!, teacherId: String): DandarLesson!
```

Resolver-ууд `dandarSamples`, `dandarSampleAdd`-тай яг ижил загвартай:
`requireTenantUser(context)` → `await context.checkPermission(...)` → оролтыг шалгах →
`context.models.Lessons...`. Файл томорвол `graphql/lesson.ts` гэж салгаад `schema.ts`-д нэгтгэнэ.

### 6. UI хуудас: `ui/src/pages/LessonsPage.tsx`

- GraphQL document-уудыг `gql()`-ээр (`~/gql`-ээс) бичнэ. Нэр нь `dandar`-аар эхэлнэ.
- `useQuery`, `useMutation` ашиглана. Mutation-д `refetchQueries: ["dandarLessons"]` тавивал
  жагсаалт refresh хийхгүйгээр шинэчлэгдэнэ.
- Loading, алдаа, хоосон төлөвүүдийг харуулна, амжилт эсвэл алдааг `toast`-оор мэдэгдэнэ.
  Бүгд `Samples.tsx`-д байгаа.

Route болон цэс нэмэх:

```tsx
// ui/src/Main.tsx
<Route path="lessons" element={<LessonsPage />} />

// ui/src/modules/Navigation.tsx
<NavigationMenuLinkItem name="Lessons" icon={IconBook} path={`/${manifest.ui.path}/lessons`} />
```

### 7. Шалгах

```bash
pnpm run codegen   # schema өөрчлөгдсөн бол UI-ийн type-уудыг дахин үүсгэнэ
pnpm run check     # TypeScript
pnpm run lint
```

`dev:api` өөрчлөлтийг автоматаар уншдаг, gateway шинэ schema-г хэдэн секундын дотор нэгтгэнэ.
Шинэ талбар харагдахгүй бол erxes-ийн backend-ийг (2-р terminal) restart хийнэ. `dev:ui`
hot reload хийдэг.

## erxes-ийн өгөгдөл ашиглах

Plugin нь erxes-ийн өгөгдлийн зөвхөн **ID**-г хадгална. Нэр болон дэлгэрэнгүйг erxes-ээс уншина.

### UI: `ui-modules`-ийн бэлэн component-ууд

| Юу             | Сонгох                                | ID-аар харуулах                       |
| -------------- | ------------------------------------- | ------------------------------------- |
| Харилцагч      | `SelectCustomer`                      | `CustomersInline`                     |
| Байгууллага    | `SelectCompany`                       | `CompaniesInline`                     |
| Ажилтан        | `SelectMember`                        | `MembersInline`                       |
| Хэлтэс, салбар | `SelectDepartments`, `SelectBranches` | `DepartmentsInline`, `BranchesInline` |
| Бүтээгдэхүүн   | `SelectProduct`                       | `ProductsInline`                      |
| Tag            | `SelectTags`                          | `TagInline`                           |

```tsx
import { CustomersInline, SelectCustomer } from "ui-modules";

<SelectCustomer mode="single" value={customerId || undefined} onValueChange={...} />
<CustomersInline customerIds={[customerId]} />
```

Бүрэн жишээ: `ui/src/Samples.tsx`.

### API: core руу tRPC-ээр хандах

```ts
import { sendTRPCMessage } from "erxes-api-shared/utils";

const customer = await sendTRPCMessage({
  subdomain,
  pluginName: "core",
  method: "query",
  module: "customers",
  action: "findOne",
  input: { _id: customerId },
  defaultValue: null,
});
```

erxes-ийн өөр plugin эсвэл core-ийн collection-ийг шууд хэзээ ч уншихгүй.

## erxes-ui component-ууд

`Button`, `Card`, `Input`, `Textarea`, `Select`, `Checkbox`, `DatePicker`, `Badge`, `Tabs`,
`Table`, `RecordTable` (том жагсаалт), `Form` (react-hook-form), `Sheet` (хажуугийн самбар),
`Dialog`, `Empty` (хоосон төлөв), `Skeleton`, `toast`. Бүгдийг `erxes-ui`-ээс root import
хийнэ (`import { Button } from "erxes-ui"`). Tailwind класс бүр `dandar:` prefix-тэй байна.

## Дүрмүүд

- GraphQL-ийн нэр бүр `dandar` (type бол `Dandar`) prefix-тэй. Бүх plugin нэг schema хуваалцдаг.
- `any` хэрэглэхгүй, named export ашиглана.
- Mutation бүрийн дараа жагсаалтыг шинэчилнэ (`refetchQueries`).
- Товч бүр ажилладаг handler-тай, форм бүр шалгалттай байна.
- `.env` болон key-г git-д оруулахгүй.

## Нэмэлт: Gemma 4

Settings хуудсанд "Ask Gemma 4" карт бий. `.env`-д `GEMINI_API_KEY` тавибал ажиллана.
Өөрийн feature-аас дуудах бол API талд `askGemma(prompt, systemPrompt)`-ийг
`api/src/modules/ai/gemma.ts`-ээс import хийнэ.
