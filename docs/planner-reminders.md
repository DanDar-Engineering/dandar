# Сануулга ба Smart Planner — багийн нэгтгэл

Энэ өөрчлөлт нь Pure-Ed боломжийн жагсаалтын **3. Reminders**, **4. Smart Planner** хэсгүүдийг хэрэгжүүлнэ. OCR болон материалын модуль ороогүй.

## Ажиллуулах

Төслийн README/SETUP дахь erxes, Mongo, Redis болон plugin эхлүүлэх алхмууд хэвээр. `pnpm install`, `pnpm run check`, `pnpm run lint`, `pnpm run build` ажиллуулна. `/dandar` үндсэн дэлгэц шинэ planner болсон. Settings дахь Ask Gemma карт хэвээр.

Админ хэрэглэгчид `dandarPlannerRead`, `dandarPlannerWrite` эрх олгоно. Бүх API нь tenant болон нэвтэрсэн user-ээр хязгаарлагдана. `dandar_planner` collection хэрэглэгч тус бүрийн snapshot хадгална; хэрэглэгчийн ID-г client-ээс авахгүй.

Gemma нь одоогийн `api/src/modules/ai/gemma.ts` холболт, `.env.example` дахь `AI_PROVIDER`, `AI_MODEL`, `GEMINI_API_KEY` эсвэл `AI_BASE_URL`/`AI_API_KEY` тохиргоог ашиглана. Түлхүүрийг browser руу явуулахгүй. Тохиргоо байхгүй эсвэл AI алдаа гарвал дэлгэцэд fallback тайлбар гарч, дүрмээр төлөвлөнө. AI-ийн даалгаврын эрэмбийг хугацаа, сул цаг, өдрийн дээд минут, завсарлага, давхцлын дүрмээр хязгаарлана.

## Багийн API гэрээ

- `dandarPlanner { version data }`: data нь JSON `{ tasks, blocks, preferences, delivered }`.
- `dandarPlannerUpdate(version, action, data)`: JSON payload-тай optimistic concurrency mutation. Хуучирсан version үед CONFLICT; дахин уншаад хэрэглэгч дахин оролдоно.
- `action: task`: `{ id, title, subject, deadline, minutes, priority, status, reminders }`. ISO UTC deadline; minutes 5–2400; priority 1–3; status `todo|started|completed`; reminders нь хугацаанаас өмнөх минутын массив (0–10080, дээд тал нь 5). Багийн Tasks/OCR модуль өөрийн тогтвортой ID-тай баталсан даалгаврыг энд upsert хийж болно. Одоогийн snapshot/version-ийг эхлээд уншина.
- `deleteTask`: ID string. Холбоотой сесс бас устна.
- `preferences`: `{ enabled, quietStart, quietEnd, timeZone, focus, dailyLimit }`. focus 25 эсвэл 45; завсарлага 5 эсвэл 10; dailyLimit 25–480 минут. quietStart=quietEnd үед чимээгүй цаггүй.
- `dandarPlanPropose(windows)`: windows JSON `[{ start, end }]`. 31 хоногийн хүрээ, дээд тал нь 28 цонх, цонх тус бүр 24 цагаас бага/тэнцүү. Preview, warnings, model буцаана; хадгалахгүй.
- `confirm`: preview block массив. Сервер дахин шалгаад хадгална. Хэрэглэгч санал батлах шаардлагатай.
- `move`: `{ id, start }`. Planned сессийг шинэ цагт шилжүүлнэ; давхцал, завсарлага, хугацаа, ачааллыг дахин шалгана.
- `block`: `{ id, status }`, status `started|completed|missed`. Сервер startedAt-аас бодит минут тооцно. Тасалдсан сессийн ажлыг дахин санал гаргахад оруулна. Даалгаврыг дуусгах нь тусдаа үйлдэл.
- `claimReminders`: сануулгын ID массив. Сервер цаг/чимээгүй цаг/давхардлыг шалгаад version-оор атомик claim хийнэ. `taskId:deadline:minutesBefore` ID хэрэглэнэ.

Төрөл болон шалгалтууд `api/src/modules/planner/contract.ts` дотор. Snapshot 100 task, 500 block хүртэл. Илүү том системд нэг task/session тутамд document болон cursor pagination руу шилжүүлнэ.

## Демо урсгал

1. Даалгавар нэмэх: маргааш хугацаатай, 100 минут.
2. Өнөөдрийн 2 цаг, маргаашийн 2 цагийг сул цагаар сонгох.
3. Gemma санал гаргуулах, model/fallback болон ачааллын анхааруулга шалгах.
4. Саналыг батлаад календарьт харах; сессийг чирэх эсвэл цагийн input-аар шилжүүлэх.
5. Сесс эхлүүлж timer харах, дуусгах; тасалдсан гэж тэмдэглээд дахин төлөвлөх.
6. Browser мэдэгдэл зөвшөөрөх. Ойрын deadline-тай даалгаврын сануулгыг шалгах. Хоёр таб нээхэд нэг claim л амжилттай байна.
7. Сануулга хаахад даалгаврын төлөв өөрчлөгдөхгүйг шалгах.

## Хязгаар

Browser notification нь HTTPS/localhost дээр, апп нээлттэй үед ажиллана. Браузер хаалттай үеийн web push, email/mobile delivery ороогүй. Календарь browser-ийн local цагаар харуулна; reminder quiet hours болон daily limit тохируулсан timezone ашиглана. Хичээл тасалдсан/тасалдсан сессийг хэрэглэгч тэмдэглээд шинэ санал гаргуулна. Энэ хувилбар гүйцэтгэлийн түүхээс хугацаа таамаглан суралцах ML эсвэл adaptive estimate оруулаагүй.

Хугацаа, давхцал, завсарлага, давхар availability, ачаалал, олон өдрийн шалгалтын бэлтгэл, тасалдсан сессийг engine.test.ts шалгана: `node --test api/src/modules/planner/engine.test.ts` (Node 22.18+ эсвэл `pnpm --filter dandar_api exec tsx --test src/modules/planner/engine.test.ts`).
