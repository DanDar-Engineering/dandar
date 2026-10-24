# Гэрийн PC-г server болгож laptop-оос холбогдох

erxes-ийн хүнд хэсэг (gateway, core-api, core-ui, plugin) гэрийн PC-ийн WSL дотор ажиллана.
Laptop-д зөвхөн **VS Code** хэрэгтэй: VS Code Remote Tunnel-ээр гэрийн PC-ийн файл, terminal-ийг
шууд ашиглаж, 3001, 4000, 3099 портуудыг laptop-ийн `localhost` руу дамжуулна. Ингэснээр erxes-ийн
тохиргоог өөрчлөхгүйгээр laptop-ийн browser-т `http://localhost:3001` нээгдэнэ.

Tunnel нь интернэтэд нээлттэй хаяг үүсгэдэггүй: зөвхөн tunnel үүсгэсэн GitHub account-аар холбогдоно.

## Гэрийн PC (нэг удаа)

1. **Унтахгүй байх:** Windows Settings → System → Power → Screen and sleep →
   "When plugged in, put my device to sleep after" → **Never**. Hack Day-ийн өдөр Windows Update-ийг
   түр зогсооно (Settings → Windows Update → Pause updates).
2. **Atlas IP:** Atlas → Network Access-д гэрийн PC-ийн IP-г нэмнэ. IP-гээ мэдэх:
   `curl https://api.ipify.org`. Компьютер дахин асахад IP өөрчлөгдөж болно.
3. **VS Code CLI суулгах (Ubuntu дотор):**

   ```bash
   mkdir -p ~/.local/bin && cd /tmp
   curl -fsSL -o vscode-cli.tar.gz "https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64"
   tar -xzf vscode-cli.tar.gz && mv code ~/.local/bin/code && rm vscode-cli.tar.gz
   ```

4. **GitHub-аар нэвтрэх:**

   ```bash
   node ~/erxes-plugins/dandar/scripts/vscode-tunnel-login.mjs
   ```

   Гарсан кодыг <https://github.com/login/device> дээр (шинэ tab-д) оруулж, **Authorize Visual
   Studio Code** дарна. Хэдэн секундын дараа "logged in" гэж гарна.
   `~/.local/bin/code tunnel user show` → "logged in with provider GitHub Account" бол болсон.
   Нэвтрэлт хадгалагддаг тул дахин асаах бүрт хийх шаардлагагүй.

   VS Code-ийн өөрийн `code tunnel user login --provider github` командыг **бүү** ашигла: тэр
   GitHub-ийн "slow_down" хариунд гацаж, Authorize дарсан ч нэвтэрдэггүй. GitHub CLI-ийн
   (`gh auth token`) токен ч ажиллахгүй: tunnel service зөвхөн VS Code-ийн app-ийн токеныг
   хүлээн авдаг (401).

## Бүгдийг асаах (дахин асаах бүрт)

```bash
bash ~/erxes-plugins/dandar/scripts/start-all.sh
```

Скрипт эхлээд MongoDB холболтыг шалгана (IP зөвшөөрөгдөөгүй бол яг аль IP-г нэмэхийг хэлнэ),
дараа нь plugin API → erxes backend → core-ui → plugin UI → VS Code tunnel (`dandar-home`)-ийг
дарааллаар арын горимд асаана. Аль хэдийн ажиллаж байгааг алгасдаг тул дахин ажиллуулж болно.
Log-ууд: `~/logs/*.log`. Зогсоох: `bash ~/erxes-plugins/dandar/scripts/stop-all.sh`.

Windows PowerShell-ээс: `wsl -d Ubuntu-24.04 -e bash /home/<user>/erxes-plugins/dandar/scripts/start-all.sh`

## Laptop (таны)

1. VS Code суулгана: <https://code.visualstudio.com>. Extensions хэсгээс **Remote - Tunnels** суулгана.
2. Зүүн доод буланд байгаа `><` товч → **Connect to Tunnel...** → GitHub → **dandar-home**.
3. File → Open Folder → `/home/<user>/erxes-plugins/dandar`.
4. Доод самбарын **Ports** tab → **Forward a Port** → `3001`, `4000`, `3099`-ийг нэмнэ (автоматаар
   нэмэгдсэн байж магадгүй).
5. Browser дээр <http://localhost:3001> нээнэ. `127.0.0.1` биш, яг `localhost` гэж бичнэ, учир нь
   нэвтрэлтийн cookie нь `localhost`-д холбогдсон.

Browser дээрх vscode.dev-ээр биш, **суулгасан VS Code**-оор холбогдоно: vscode.dev портуудыг
`localhost` биш тусдаа https хаягаар дамжуулдаг тул erxes-ийн UI API-гаа олж чадахгүй.

## Багийнхан (Live Share)

Tunnel нь таны GitHub account-тай холбоотой тул багийнхан шууд холбогдож чадахгүй. Тэд таны
VS Code-оос эхлүүлсэн Live Share session-д нэгдэнэ:

1. Та (tunnel-д холбогдсон VS Code дээр) **Live Share** extension суулгаад доод мөрөнд байгаа
   **Live Share** товчийг дарж холбоосоо багийнхандаа илгээнэ.
2. Багийнхан VS Code + Live Share extension суулгаж, холбоосоор нэгдэнэ. Нэг файлыг зэрэг засах
   боломжтой.
3. Та Live Share самбараас **Share Server** → `3001`, `4000`, `3099`-ийг тус бүр хуваалцана.
   Багийнхан өөрсдийн browser дээр <http://localhost:3001> нээнэ.
4. Terminal хуваалцах бол **Share Terminal** (read/write).

Live Share таны VS Code нээлттэй байх хугацаанд л ажиллана. Hack Day эхлэхэд нэг удаа туршиж
үзээрэй. Ажиллахгүй бол багийнхан [SETUP.md](SETUP.md)-ээр өөрсдийн компьютер дээр тохируулна.

## Асуудал шийдэх

| Шинж тэмдэг                                        | Шийдэл                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `start-all.sh`: "MongoDB is not reachable"         | Скриптийн хэлсэн IP-г Atlas → Network Access-д нэмээд 1–2 минут хүлээнэ                                      |
| `~/logs/vscode-tunnel.log` дээр "dns error"        | Компьютер асаад удаагүй үед гардаг түр алдаа; `start-all.sh`-ийг дахин ажиллуулна                            |
| Laptop-оос `dandar-home` tunnel харагдахгүй        | Гэрийн PC унтсан эсвэл унтарсан эсэхийг шалгаж, `start-all.sh`-ийг дахин ажиллуулна                          |
| `localhost:3001` нээгдэх ч өгөгдөл ачаалагдахгүй   | Ports tab-д `4000` дамжуулагдсан эсэхийг шалгана                                                             |
| Нэвтэрсэн ч дахин login хуудас руу шилжүүлнэ       | `127.0.0.1` биш `localhost` хаяг ашиглана                                                                    |
| `tail ~/logs/erxes-backend.log` дээр "app crashed" | `start-all.sh` асаах үедээ нэг удаа өөрөө дахин асаадаг; дахин гарвал `stop-all.sh`, дараа нь `start-all.sh` |
