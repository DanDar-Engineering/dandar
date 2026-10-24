import "./planner.css";
import {
  IconCalendar,
  IconBell,
  IconSparkles,
  IconClock,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconCheck,
  IconArrowRight,
  IconSettings,
  IconPlayerPlay,
  IconMoon,
  IconTrash,
  IconPencil,
  IconFlag,
  IconBook2,
  IconLayoutGrid,
  IconVolume,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Link } from "react-router";
import { PLANNER, UPDATE, PROPOSE } from "./graphql";
import { MicButton } from "../voice/MicButton";
import { useSpeak } from "../voice/useSpeak";

// Spoken reminders are a per-device choice (speakers, classroom), so they
// live in localStorage rather than in the synced preferences.
const VOICE_KEY = "dandar:voiceReminders";
const readVoicePreference = () => {
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
};

type Task = {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  minutes: number;
  priority: number;
  status: "todo" | "started" | "completed";
  reminders: number[];
};
type Block = {
  id: string;
  taskId: string;
  start: string;
  end: string;
  status: "planned" | "started" | "completed" | "missed";
  actualMinutes: number;
  startedAt?: string;
};
type Preferences = {
  enabled: boolean;
  quietStart: number;
  quietEnd: number;
  timeZone: string;
  focus: 25 | 45;
  dailyLimit: number;
  sessionReminderMinutes?: number;
};
type State = { tasks: Task[]; blocks: Block[]; preferences: Preferences; delivered: string[] };
const local = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const day = (date: Date) => local(date).slice(0, 10);
const freshTask = (): Task => ({
  id: crypto.randomUUID(),
  title: "",
  subject: "",
  deadline: new Date(Date.now() + 86400000).toISOString(),
  minutes: 50,
  priority: 2,
  status: "todo",
  reminders: [1440, 60, 0],
});
const blank: State = {
  tasks: [],
  blocks: [],
  delivered: [],
  preferences: {
    enabled: true,
    quietStart: 22,
    quietEnd: 7,
    timeZone: "Asia/Ulaanbaatar",
    focus: 25,
    dailyLimit: 180,
    sessionReminderMinutes: 15,
  },
};
const time = (value: string) =>
  new Date(value).toLocaleString("mn-MN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const Planner = () => {
  const { data, loading, error, refetch } = useQuery(PLANNER, {
    pollInterval: 30000,
    fetchPolicy: "network-only",
  });
  const [update, { loading: saving }] = useMutation(UPDATE);
  const [propose, { loading: thinking }] = useMutation(PROPOSE);
  const [state, setState] = useState<State>(blank);
  const version = useRef(0);
  const busy = useRef(false);
  const [tab, setTab] = useState<"planner" | "reminders">("planner");
  const [modal, setModal] = useState<"task" | "plan" | "preferences" | "block" | null>(null);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (modal && d && !d.open) d.showModal();
    if (!modal && d?.open) d.close();
  }, [modal]);
  const [task, setTask] = useState<Task>(freshTask);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Block[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [windows, setWindows] = useState([
    {
      start: local(new Date(Date.now() + 3600000)),
      end: local(new Date(Date.now() + 4 * 3600000)),
    },
  ]);
  const [selected, setSelected] = useState(day(new Date()));
  const [weekly, setWeekly] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [prefs, setPrefs] = useState(blank.preferences);
  const [notification, setNotification] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const {
    configured: voiceReady,
    sttConfigured: dictationReady,
    speak,
    speaking,
    error: voiceError,
  } = useSpeak();
  const [voiceOn, setVoiceOn] = useState(readVoicePreference);
  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    try {
      localStorage.setItem(VOICE_KEY, next ? "on" : "off");
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  };
  useEffect(() => {
    if (voiceError) setMessage(`Дуут сануулга: ${voiceError}`);
  }, [voiceError]);
  useEffect(() => {
    if (data) {
      try {
        const next = JSON.parse(data.dandarPlanner.data) as State;
        setState(next);
        setPrefs(next.preferences);
        version.current = data.dandarPlanner.version;
      } catch {
        setMessage("Өгөгдөл уншиж чадсангүй.");
      }
    }
  }, [data]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function save(action: string, payload: unknown) {
    if (busy.current) return false;
    busy.current = true;
    setMessage("");
    try {
      const result = await update({
        variables: { version: version.current, action, data: JSON.stringify(payload) },
      });
      if (!result.data) throw new Error("No response");
      const next = result.data.dandarPlannerUpdate;
      version.current = next.version;
      setState(JSON.parse(next.data) as State);
      await refetch().catch(() => undefined);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Хадгалж чадсангүй");
      await refetch().catch(() => undefined);
      return false;
    } finally {
      busy.current = false;
    }
  }
  const p = state.preferences;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: p.timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(now)),
  );
  const quiet =
    p.quietStart === p.quietEnd
      ? false
      : p.quietStart < p.quietEnd
        ? hour >= p.quietStart && hour < p.quietEnd
        : hour >= p.quietStart || hour < p.quietEnd;
  const deadlineDue = state.tasks
    .filter((t) => t.status !== "completed")
    .flatMap((t) =>
      t.reminders.map((m) => ({
        id: `${t.id}:${t.deadline}:${m}`,
        task: t,
        due: Date.parse(t.deadline) - m * 60000,
      })),
    )
    .filter(
      (r) =>
        now >= r.due &&
        now < Date.parse(r.task.deadline) + 86400000 &&
        !state.delivered.includes(r.id),
    );
  const lead = p.sessionReminderMinutes ?? 15;
  const sessionDue = state.blocks
    .filter(
      (b) =>
        b.status === "planned" &&
        now >= Date.parse(b.start) - lead * 60000 &&
        now < Date.parse(b.start) + 60000,
    )
    .flatMap((b) => {
      const t = state.tasks.find((t) => t.id === b.taskId && t.status !== "completed");
      const id = `session:${b.id}:${b.start}:${lead}`;
      return t && !state.delivered.includes(id)
        ? [{ id, task: t, due: Date.parse(b.start) - lead * 60000 }]
        : [];
    });
  const due = [...deadlineDue, ...sessionDue];
  // A server-side version claim ensures only one browser/tab handles each reminder.
  useEffect(() => {
    if (!due.length || quiet || !p.enabled || notification !== "granted" || busy.current) return;
    const batch = due.slice(0, 100);
    void save(
      "claimReminders",
      batch.map((r) => r.id),
    ).then((ok) => {
      if (ok) {
        const titles = [...new Set(batch.map((r) => r.task.title))];
        try {
          new Notification("DanDar • Сануулга", {
            body: titles.join(" • "),
            tag: "dandar-deadlines",
          });
        } catch {
          setMessage("Браузер мэдэгдэл харуулж чадсангүй.");
        }
        // The same reminder, read aloud in Mongolian by Chimege.
        if (voiceOn && voiceReady) {
          void speak(`Сануулга. ${titles.join(". ")}`);
        }
      }
    });
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  async function generate() {
    setMessage("");
    setPreview([]);
    try {
      const result = await propose({
        variables: {
          windows: JSON.stringify(
            windows.map((w) => ({
              start: new Date(w.start).toISOString(),
              end: new Date(w.end).toISOString(),
            })),
          ),
        },
      });
      if (result.data) {
        setPreview(JSON.parse(result.data.dandarPlanPropose.data) as Block[]);
        setWarnings(result.data.dandarPlanPropose.warnings);
        setModel(result.data.dandarPlanPropose.model);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Төлөвлөж чадсангүй");
    }
  }
  const running = state.blocks.find((b) => b.status === "started");
  const days = Array.from({ length: weekly ? 7 : 1 }, (_, i) => {
    const d = new Date(`${selected}T12:00:00`);
    d.setDate(d.getDate() + i);
    return day(d);
  });
  const remaining = running
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(running.startedAt ?? running.start) +
            (Date.parse(running.end) - Date.parse(running.start)) -
            now) /
            1000,
        ),
      )
    : 0;
  const elapsed = (b: Block) =>
    Math.max(0, Math.round((now - Date.parse(b.startedAt ?? b.start)) / 60000));

  const upcoming = state.blocks
    .filter((b) => b.status === "planned" && Date.parse(b.end) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const focusBlock = running ?? upcoming[0];
  const focusTitle = state.tasks.find((t) => t.id === focusBlock?.taskId)?.title;
  const completed = state.blocks.filter((b) => b.status === "completed");
  const openTasks = state.tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  const visibleBlocks = state.blocks.filter((b) => days.includes(day(new Date(b.start))));
  const startHour = Math.min(8, ...visibleBlocks.map((b) => new Date(b.start).getHours()));
  const endHour = Math.max(
    19,
    ...visibleBlocks.map((b) =>
      Math.ceil(new Date(b.end).getHours() + new Date(b.end).getMinutes() / 60),
    ),
  );
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour);
  const selectedBlock = state.blocks.find((b) => b.id === activeBlock);
  function newTask() {
    setTask(freshTask());
    setModal("task");
  }
  function changeDate(amount: number) {
    const date = new Date(`${selected}T12:00:00`);
    date.setDate(date.getDate() + amount);
    setSelected(day(date));
  }
  const close = () => setModal(null);
  const statusLabel = (status: Block["status"]) =>
    ({
      planned: "Төлөвлөсөн",
      started: "Төвлөрч байна",
      completed: "Дууссан",
      missed: "Тасалдсан",
    })[status];
  const clock = (value: string) =>
    new Date(value).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
  if (loading && !data)
    return (
      <div className="dandar:study-app">
        <div className="dandar:study-empty" role="status">
          <IconCalendar size={36} />
          <h2>Төлөвлөгөөг ачаалж байна…</h2>
        </div>
      </div>
    );
  if (error && !data)
    return (
      <div className="dandar:study-app">
        <div className="dandar:study-empty" role="alert">
          <IconBell size={36} />
          <h2>Холболтоо шалгана уу</h2>
          <p>{error.message}</p>
          <button onClick={() => refetch()}>Дахин оролдох</button>
        </div>
      </div>
    );
  return (
    <main className="dandar:study-app">
      <div className="dandar:study-shell">
        <header className="dandar:study-header">
          <div>
            <div className="dandar:eyebrow">
              <span className="dandar:brand-mark">
                <IconSparkles size={15} />
              </span>{" "}
              PURE ED <span>/ СУРАГЧИЙН ОРОН ЗАЙ</span>
            </div>
            <h1>
              {tab === "planner" ? "Төлөвлөгөө" : "Сануулга"}
              <span className="dandar:heading-dot">.</span>
            </h1>
            <p>
              {tab === "planner"
                ? "Өдөр бүр бага багаар. Зорилгодоо нэг алхам ойртоорой."
                : "Чухал ажлаа цагт нь. Өөрт тохирох үедээ сануулаарай."}
            </p>
          </div>
          <div className="dandar:header-actions">
            <button
              className="dandar:icon-button"
              aria-label="Сануулгууд"
              onClick={() => setTab("reminders")}
            >
              <IconBell size={20} />
              {due.length > 0 && <span className="dandar:notification-dot" />}
            </button>
            <button className="dandar:primary-button" onClick={newTask}>
              <IconPlus size={17} />
              Даалгавар нэмэх
            </button>
          </div>
        </header>
        <nav className="dandar:study-tabs" aria-label="Сургалтын хэсгүүд">
          <button
            aria-current={tab === "planner" ? "page" : undefined}
            onClick={() => setTab("planner")}
          >
            <IconCalendar size={18} />
            Миний төлөвлөгөө
          </button>
          <button
            aria-current={tab === "reminders" ? "page" : undefined}
            onClick={() => setTab("reminders")}
          >
            <IconBell size={18} />
            Сануулга{due.length > 0 && <span className="dandar:count-badge">{due.length}</span>}
          </button>
          <Link to="/dandar/settings">
            <IconSettings size={16} /> AI тохиргоо
          </Link>
        </nav>
        {(message || error) && (
          <div className="dandar:study-alert" role="alert">
            <IconBell size={18} />
            {message || error?.message}
            <button aria-label="Алдааг хаах" onClick={() => setMessage("")}>
              <IconX size={16} />
            </button>
          </div>
        )}
        <div className="dandar:study-layout">
          <div className="dandar:study-main">
            {tab === "planner" ? (
              <>
                <section className="dandar:planner-banner">
                  <div className="dandar:sparkle-tile">
                    <IconSparkles size={25} />
                  </div>
                  <div>
                    <div className="dandar:eyebrow">ЧИНИЙ ХЭМНЭЛД ТОХИРСОН</div>
                    <h2>Сурах цагаа ухаалгаар төлөвлөе</h2>
                    <p>Сул цаг, deadline-д чинь тааруулж Gemma төлөвлөгөө санал болгоно.</p>
                    <div className="dandar:banner-tags">
                      <span>
                        <IconCheck size={13} /> Давхцалгүй хуваарь
                      </span>
                      <span>
                        <IconClock size={13} /> Завсарлагатай сесс
                      </span>
                    </div>
                  </div>
                  <button className="dandar:primary-button" onClick={() => setModal("plan")}>
                    <IconSparkles size={16} />
                    Төлөвлөгөө гаргах
                    <IconArrowRight size={16} />
                  </button>
                </section>
                <section className="dandar:calendar-card">
                  <div className="dandar:card-toolbar">
                    <div>
                      <h2>
                        <IconCalendar size={19} />
                        Суралцах календарь
                      </h2>
                      <p>
                        {new Date(`${selected}T12:00:00`).toLocaleDateString("mn-MN", {
                          year: "numeric",
                          month: "long",
                        })}
                      </p>
                    </div>
                    <div className="dandar:calendar-controls">
                      <div className="dandar:view-switch">
                        <button aria-pressed={!weekly} onClick={() => setWeekly(false)}>
                          Өдөр
                        </button>
                        <button aria-pressed={weekly} onClick={() => setWeekly(true)}>
                          7 хоног
                        </button>
                      </div>
                      <button
                        className="dandar:icon-button"
                        aria-label="Өмнөх хугацаа"
                        onClick={() => changeDate(weekly ? -7 : -1)}
                      >
                        <IconChevronLeft size={17} />
                      </button>
                      <button
                        className="dandar:soft-button"
                        onClick={() => setSelected(day(new Date()))}
                      >
                        Өнөөдөр
                      </button>
                      <button
                        className="dandar:icon-button"
                        aria-label="Дараагийн хугацаа"
                        onClick={() => changeDate(weekly ? 7 : 1)}
                      >
                        <IconChevronRight size={17} />
                      </button>
                      <label className="dandar:sr-only">
                        Эхлэх өдөр
                        <input
                          type="date"
                          value={selected}
                          onChange={(e) => {
                            if (e.target.value) setSelected(e.target.value);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="dandar:calendar-scroll">
                    <div
                      className="dandar:week-grid"
                      style={{
                        gridTemplateColumns: `44px repeat(${days.length}, minmax(${weekly ? 100 : 260}px,1fr))`,
                      }}
                    >
                      <div className="dandar:timezone-label">ЦАГ</div>
                      {days.map((d) => (
                        <div
                          className={`dandar:day-heading ${d === day(new Date()) ? "dandar:is-today" : ""}`}
                          key={d}
                        >
                          <span>
                            {new Date(`${d}T12:00:00`).toLocaleDateString("mn-MN", {
                              weekday: "short",
                            })}
                          </span>
                          <strong>{new Date(`${d}T12:00:00`).getDate()}</strong>
                          <span className="dandar:day-count">
                            {
                              state.blocks.filter(
                                (b) => day(new Date(b.start)) === d && b.status !== "missed",
                              ).length
                            }{" "}
                            сесс
                          </span>
                        </div>
                      ))}
                      <div className="dandar:time-axis" style={{ height: hours.length * 64 }}>
                        {hours.map((h) => (
                          <span key={h} style={{ top: (h - startHour) * 64 }}>
                            {String(h).padStart(2, "0")}:00
                          </span>
                        ))}
                      </div>
                      {days.map((d) => (
                        <div
                          key={d}
                          className="dandar:day-track"
                          style={{ height: hours.length * 64 }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const b = state.blocks.find(
                              (x) => x.id === e.dataTransfer.getData("text/plain"),
                            );
                            if (b)
                              void save("move", {
                                id: b.id,
                                start: new Date(
                                  `${d}T${local(new Date(b.start)).slice(11)}`,
                                ).toISOString(),
                              });
                          }}
                        >
                          {state.blocks
                            .filter((b) => day(new Date(b.start)) === d)
                            .map((b) => {
                              const t = state.tasks.find((t) => t.id === b.taskId);
                              return (
                                <button
                                  key={b.id}
                                  className={`dandar:calendar-event dandar:tone-${(state.tasks.findIndex((t) => t.id === b.taskId) + 6) % 5} ${b.status === "completed" ? "dandar:event-done" : ""} ${b.status === "missed" ? "dandar:event-missed" : ""}`}
                                  style={{
                                    top:
                                      (((new Date(b.start).getHours() - startHour) * 60 +
                                        new Date(b.start).getMinutes()) *
                                        64) /
                                      60,
                                    height: Math.max(
                                      25,
                                      (((Date.parse(b.end) - Date.parse(b.start)) / 60000) * 64) /
                                        60,
                                    ),
                                  }}
                                  draggable={b.status === "planned"}
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", b.id)}
                                  onClick={() => {
                                    setActiveBlock(b.id);
                                    setModal("block");
                                  }}
                                  title={`${t?.title} · ${clock(b.start)}–${clock(b.end)} · Deadline: ${t ? time(t.deadline) : ""}`}
                                >
                                  <span>
                                    {b.status === "completed" ? (
                                      <IconCheck size={12} />
                                    ) : (
                                      <IconBook2 size={12} />
                                    )}{" "}
                                    {t?.title}
                                  </span>
                                  <small>
                                    {clock(b.start)} · {statusLabel(b.status)}
                                  </small>
                                </button>
                              );
                            })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="dandar:calendar-footer">
                    <span>
                      <span className="dandar:legend-dot" /> Суралцах сесс
                    </span>
                    <span>
                      <IconCheck size={14} />
                      Дууссан
                    </span>
                    <p>Сессээ чирж шилжүүлнэ. Дэлгэрэнгүйг дарж нээнэ.</p>
                  </div>
                  {!state.blocks.length && (
                    <div className="dandar:inline-empty">
                      <IconCalendar size={22} />
                      <span>Хуваарь одоохондоо хоосон байна.</span>
                      <button onClick={() => setModal("plan")}>
                        Эхний төлөвлөгөөгөө гаргах <IconArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <>
                <section className="dandar:reminder-banner">
                  <div className="dandar:sparkle-tile">
                    <IconBell size={25} />
                  </div>
                  <div>
                    <h2>Цагаа өөрөө сонго. Бид сануулъя.</h2>
                    <p>
                      Сесс эхлэхээс <strong>{lead} минутын өмнө</strong> мэдэгдэл ирнэ. Deadline-ийн
                      цагийг даалгавар бүр дээр тохируулна.
                    </p>
                  </div>
                  <button className="dandar:primary-button" onClick={() => setModal("preferences")}>
                    <IconSettings size={16} />
                    Тохируулах
                  </button>
                </section>
                <section className="dandar:surface-card">
                  <div className="dandar:card-toolbar">
                    <h2>
                      <IconBell size={19} />
                      Сануулгын хайрцаг <span className="dandar:count-badge">{due.length}</span>
                    </h2>
                    {due.length > 0 && (
                      <button
                        className="dandar:soft-button"
                        disabled={saving || quiet || !p.enabled}
                        onClick={() =>
                          save(
                            "claimReminders",
                            due.slice(0, 100).map((r) => r.id),
                          )
                        }
                      >
                        <IconCheck size={15} />
                        Бүгдийг уншсан
                      </button>
                    )}
                  </div>
                  {due.length ? (
                    due.map((r) => (
                      <div className="dandar:reminder-row" key={r.id}>
                        <span className="dandar:reminder-symbol">
                          <IconBell size={20} />
                        </span>
                        <div>
                          <strong>{r.task.title}</strong>
                          <p>
                            {r.id.startsWith("session:")
                              ? "Суралцах сесс удахгүй эхэлнэ"
                              : "Даалгаврын эцсийн хугацаа ойртлоо"}
                          </p>
                          <span className="dandar:deadline-label">
                            <IconFlag size={13} />
                            Deadline: {time(r.task.deadline)}
                          </span>
                        </div>
                        {voiceReady && (
                          <button
                            className="dandar:icon-button"
                            aria-label={`${r.task.title} сануулгыг чангаар унших`}
                            title="Чангаар унших"
                            disabled={speaking}
                            onClick={() =>
                              void speak(
                                `${r.task.title}. ${
                                  r.id.startsWith("session:")
                                    ? "Суралцах сесс удахгүй эхэлнэ"
                                    : "Даалгаврын эцсийн хугацаа ойртлоо"
                                }. Эцсийн хугацаа ${time(r.task.deadline)}.`,
                              )
                            }
                          >
                            <IconVolume size={18} />
                          </button>
                        )}
                        <button
                          className="dandar:icon-button"
                          aria-label={`${r.task.title} сануулгыг уншсан`}
                          disabled={saving || quiet || !p.enabled}
                          onClick={() => save("claimReminders", [r.id])}
                        >
                          <IconCheck size={18} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="dandar:study-empty">
                      <span className="dandar:empty-icon">
                        <IconBell size={32} />
                      </span>
                      <h3>Бүгдийг амжуулж байна!</h3>
                      <p>Одоогоор шинэ сануулга алга. Дараагийн ажлын өмнө энд мэдэгдэнэ.</p>
                    </div>
                  )}
                </section>
                <section className="dandar:surface-card">
                  <div className="dandar:card-toolbar">
                    <h2>
                      <IconClock size={19} />
                      Дараагийн сануулгууд
                    </h2>
                  </div>
                  {upcoming.length ? (
                    upcoming.slice(0, 8).map((b) => (
                      <div className="dandar:upcoming-row" key={b.id}>
                        <span className="dandar:mini-date">
                          <strong>{new Date(b.start).getDate()}</strong>
                          {new Date(b.start).toLocaleDateString("mn-MN", { month: "short" })}
                        </span>
                        <div>
                          <strong>{state.tasks.find((t) => t.id === b.taskId)?.title}</strong>
                          <p>Эхлэх: {time(b.start)}</p>
                        </div>
                        <span className="dandar:status-pill">
                          <IconBell size={13} />
                          {lead} мин өмнө
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="dandar:inline-empty">
                      <IconCalendar size={20} />
                      Төлөвлөгөө нэмэхэд сануулгууд энд харагдана.
                    </div>
                  )}
                </section>
              </>
            )}
            <section className="dandar:surface-card">
              <div className="dandar:card-toolbar">
                <div>
                  <h2>
                    <IconLayoutGrid size={19} />
                    Миний даалгаврууд
                  </h2>
                  <p>Эцсийн хугацаа болон сануулгаа нэг дор удирдаарай.</p>
                </div>
                <button className="dandar:soft-button" onClick={newTask}>
                  <IconPlus size={16} />
                  Нэмэх
                </button>
              </div>
              {state.tasks.length ? (
                state.tasks.map((t, i) => (
                  <div className="dandar:task-row" key={t.id}>
                    <button
                      className={`dandar:task-check ${t.status === "completed" ? "dandar:checked" : ""}`}
                      disabled={saving}
                      aria-label={`${t.title} ${t.status === "completed" ? "дахин нээх" : "дуусгах"}`}
                      onClick={() =>
                        save("task", {
                          ...t,
                          status: t.status === "completed" ? "todo" : "completed",
                        })
                      }
                    >
                      {t.status === "completed" && <IconCheck size={14} />}
                    </button>
                    <div className="dandar:task-copy">
                      <strong
                        style={{
                          textDecoration: t.status === "completed" ? "line-through" : undefined,
                        }}
                      >
                        {t.title}
                      </strong>
                      <div>
                        <span className={`dandar:subject-tag dandar:tone-${i % 5}`}>
                          {t.subject || "Бие даалт"}
                        </span>
                        <span>
                          <IconClock size={12} />
                          {t.minutes} мин
                        </span>
                        <span
                          className={
                            Date.parse(t.deadline) < now && t.status !== "completed"
                              ? "dandar:overdue"
                              : ""
                          }
                        >
                          <IconFlag size={12} />
                          Deadline: {time(t.deadline)}
                        </span>
                        <span>
                          <IconBell size={12} />
                          {t.reminders.length
                            ? t.reminders.map((m) => `${m} мин`).join(", ")
                            : "Унтраасан"}
                        </span>
                      </div>
                    </div>
                    <button
                      className="dandar:icon-button"
                      aria-label={`${t.title} засах`}
                      onClick={() => {
                        setTask(t);
                        setModal("task");
                      }}
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      className="dandar:icon-button"
                      aria-label={`${t.title} устгах`}
                      disabled={saving}
                      onClick={() => {
                        if (window.confirm("Даалгавар болон холбоотой сессийг устгах уу?"))
                          void save("deleteTask", t.id);
                      }}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="dandar:study-empty">
                  <span className="dandar:empty-icon">
                    <IconBook2 size={30} />
                  </span>
                  <h3>Жижиг ажлаас эхэлцгээе</h3>
                  <p>Даалгавар, deadline-аа нэмээд сурах цагаа төлөвлөөрэй.</p>
                  <button className="dandar:primary-button" onClick={newTask}>
                    <IconPlus size={16} />
                    Даалгавар нэмэх
                  </button>
                </div>
              )}
            </section>
          </div>
          <aside className="dandar:study-aside">
            <section className="dandar:focus-card">
              <div className="dandar:focus-top">
                <span>
                  <span className="dandar:live-dot" />
                  {running ? "ТӨВЛӨРӨЛ ЭХЭЛСЭН" : "ТӨВЛӨРӨХ ЦАГ"}
                </span>
                <IconClock size={19} />
              </div>
              <div className="dandar:focus-timer" role="timer">
                {running
                  ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                  : `${p.focus}:00`}
              </div>
              <p>{focusTitle || "Өнөөдрийн нэг зорилгоо сонгоорой"}</p>
              <div className="dandar:focus-chips">
                <span>{p.focus} мин төвлөрөл</span>
                <span>{p.focus === 25 ? 5 : 10} мин завсарлага</span>
              </div>
              {running ? (
                <>
                  <button
                    className="dandar:yellow-button"
                    disabled={saving}
                    onClick={() =>
                      save("block", {
                        id: running.id,
                        status: "completed",
                        actualMinutes: Math.min(480, elapsed(running)),
                      })
                    }
                  >
                    <IconCheck size={17} />
                    Сесс дуусгах
                  </button>
                  <button
                    className="dandar:focus-secondary"
                    disabled={saving}
                    onClick={() => save("block", { id: running.id, status: "missed" })}
                  >
                    Тасалдсан гэж тэмдэглэх
                  </button>
                </>
              ) : (
                <button
                  className="dandar:yellow-button"
                  disabled={saving}
                  onClick={() => {
                    if (focusBlock) void save("block", { id: focusBlock.id, status: "started" });
                    else setModal("plan");
                  }}
                >
                  <IconPlayerPlay size={17} />
                  {focusBlock ? "Төвлөрч эхлэх" : "Сесс төлөвлөх"}
                </button>
              )}
              {running && remaining === 0 && (
                <p role="status">Сессийн цаг дууслаа. Түр завсарлаарай.</p>
              )}
            </section>
            <section className="dandar:surface-card dandar:compact-card">
              <h2>
                Миний ахиц <span className="dandar:status-pill">Өнөөдрийг бүтээе</span>
              </h2>
              <div className="dandar:progress-stats">
                <div>
                  <strong>
                    {completed.length}
                    <small>сесс</small>
                  </strong>
                  <span>Амжилттай дууссан</span>
                </div>
                <div>
                  <strong>
                    {completed.reduce((n, b) => n + b.actualMinutes, 0)}
                    <small>мин</small>
                  </strong>
                  <span>Төвлөрсөн хугацаа</span>
                </div>
              </div>
              <div className="dandar:progress-track">
                <span
                  style={{
                    width: `${state.tasks.length ? (state.tasks.filter((t) => t.status === "completed").length / state.tasks.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <p>
                {state.tasks.filter((t) => t.status === "completed").length} / {state.tasks.length}{" "}
                даалгавар дууссан
              </p>
            </section>
            <section className="dandar:surface-card dandar:compact-card">
              <h2>
                <IconFlag size={17} />
                Ойрын deadline
              </h2>
              {openTasks.length ? (
                openTasks.slice(0, 4).map((t, i) => (
                  <button
                    className="dandar:deadline-item"
                    key={t.id}
                    onClick={() => {
                      setTask(t);
                      setModal("task");
                    }}
                  >
                    <span className={`dandar:small-dot dandar:tone-${i % 5}`} />
                    <span>
                      <strong>{t.title}</strong>
                      <small>{time(t.deadline)}</small>
                    </span>
                    <IconChevronRight size={15} />
                  </button>
                ))
              ) : (
                <p className="dandar:muted-copy">Нээлттэй даалгавар алга.</p>
              )}
            </section>
            <section className="dandar:surface-card dandar:compact-card">
              <h2>
                <IconBell size={17} />
                Мэдэгдлийн тохиргоо
                <button
                  className="dandar:icon-button"
                  aria-label="Мэдэгдлийн тохиргоо нээх"
                  onClick={() => setModal("preferences")}
                >
                  <IconSettings size={16} />
                </button>
              </h2>
              <div className="dandar:preference-row">
                <span>Сесс эхлэхээс өмнө</span>
                <strong>{lead} мин</strong>
              </div>
              <div className="dandar:preference-row">
                <span>
                  <IconMoon size={14} />
                  Чимээгүй цаг
                </span>
                <strong>
                  {String(p.quietStart).padStart(2, "0")}:00–{String(p.quietEnd).padStart(2, "0")}
                  :00
                </strong>
              </div>
              <div className="dandar:notification-state">
                <span className={`dandar:small-dot ${p.enabled ? "dandar:enabled-dot" : ""}`} />
                {!p.enabled
                  ? "Сануулга унтраалттай"
                  : quiet
                    ? "Чимээгүй цаг идэвхтэй"
                    : notification === "granted"
                      ? "Мэдэгдэл идэвхтэй"
                      : "Мэдэгдлийн зөвшөөрөл хэрэгтэй"}
              </div>
              <div className="dandar:preference-row">
                <span>
                  <IconVolume size={14} />
                  Дуут сануулга
                </span>
                {voiceReady ? (
                  <button
                    className="dandar:soft-button"
                    aria-pressed={voiceOn}
                    onClick={toggleVoice}
                  >
                    {voiceOn ? "Асаалттай" : "Унтраалттай"}
                  </button>
                ) : (
                  <strong title="Plugin-ий .env-д CHIMEGE_TOKEN тавина">Тохируулаагүй</strong>
                )}
              </div>
              <button className="dandar:full-soft-button" onClick={() => setModal("preferences")}>
                Хугацааг тохируулах
                <IconArrowRight size={15} />
              </button>
              <p className="dandar:tiny-copy">Мэдэгдэл апп нээлттэй үед ирнэ.</p>
            </section>
            <div className="dandar:study-tip">
              <IconSparkles size={20} />
              <div>
                <strong>Тогтмол бага алхам.</strong>
                <p>Өнөөдрийн нэг сесс ч маргаашийн том ахиц болно.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <dialog
        ref={dialogRef}
        className="dandar:study-dialog"
        onCancel={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const r = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }
        }}
        aria-labelledby="dandar-dialog-title"
      >
        <header>
          <span className="dandar:dialog-symbol">
            {modal === "task" ? (
              <IconBook2 size={22} />
            ) : modal === "plan" ? (
              <IconSparkles size={22} />
            ) : modal === "block" ? (
              <IconClock size={22} />
            ) : (
              <IconBell size={22} />
            )}
          </span>
          <div>
            <h2 id="dandar-dialog-title">
              {modal === "task"
                ? "Даалгавар ба deadline"
                : modal === "plan"
                  ? "Ухаалаг төлөвлөгөө"
                  : modal === "block"
                    ? "Суралцах сесс"
                    : "Сануулгын тохиргоо"}
            </h2>
            <p>
              {modal === "task"
                ? "Зорилгоо тодорхойлоод, сануулах цагаа сонгоорой."
                : modal === "plan"
                  ? "Сул цагаа нэмээд өөрийн хэмнэлээр суралцаарай."
                  : "Цаг хугацаагаа өөртөө тохируулаарай."}
            </p>
          </div>
          <button className="dandar:icon-button" aria-label="Цонх хаах" onClick={close}>
            <IconX size={20} />
          </button>
        </header>
        {message && (
          <p className="dandar:study-alert" role="alert">
            {message}
          </p>
        )}
        {modal === "task" && (
          <form
            className="dandar:study-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save("task", task)) {
                setTask(freshTask());
                setPreview([]);
                close();
              }
            }}
          >
            <label>
              Даалгаврын нэр
              <span className="dandar:voice-input">
                <input
                  autoFocus
                  required
                  placeholder="Жишээ: Математикийн давтлага"
                  maxLength={200}
                  value={task.title}
                  onChange={(e) => setTask({ ...task, title: e.target.value })}
                />
                {dictationReady && (
                  <MicButton
                    className="dandar:icon-button"
                    onText={(text) =>
                      setTask((current) => ({
                        ...current,
                        title: `${current.title ? `${current.title} ` : ""}${text}`.slice(0, 200),
                      }))
                    }
                    onError={setMessage}
                  />
                )}
              </span>
            </label>
            <label>
              Хичээл
              <input
                placeholder="Математик, Англи хэл…"
                maxLength={80}
                value={task.subject}
                onChange={(e) => setTask({ ...task, subject: e.target.value })}
              />
            </label>
            <label>
              <span>
                <IconFlag size={15} />
                Deadline — дуусгах эцсийн хугацаа
              </span>
              <input
                required
                type="datetime-local"
                value={local(new Date(task.deadline))}
                onChange={(e) => {
                  if (e.target.value)
                    setTask({ ...task, deadline: new Date(e.target.value).toISOString() });
                }}
              />
            </label>
            <div className="dandar:form-columns">
              <label>
                Суралцах минут
                <input
                  required
                  type="number"
                  min={5}
                  max={2400}
                  value={task.minutes}
                  onChange={(e) => setTask({ ...task, minutes: Number(e.target.value) })}
                />
              </label>
              <label>
                Ач холбогдол
                <select
                  value={task.priority}
                  onChange={(e) => setTask({ ...task, priority: Number(e.target.value) })}
                >
                  <option value={1}>Бага</option>
                  <option value={2}>Дунд</option>
                  <option value={3}>Өндөр</option>
                </select>
              </label>
            </div>
            <fieldset className="dandar:reminder-fields">
              <legend>
                <IconBell size={16} />
                Deadline-аас хэдэн минутын өмнө сануулах вэ?
              </legend>
              <p>0 = яг хугацаанд · 60 = 1 цаг · 1440 = 1 өдөр</p>
              {task.reminders.map((m, i) => (
                <div className="dandar:reminder-input" key={i}>
                  <input
                    type="number"
                    aria-label={`Deadline сануулга ${i + 1}, минут`}
                    min={0}
                    max={10080}
                    required
                    value={m}
                    onChange={(e) =>
                      setTask({
                        ...task,
                        reminders: task.reminders.map((x, j) =>
                          i === j ? Number(e.target.value) : x,
                        ),
                      })
                    }
                  />
                  <span>минутын өмнө</span>
                  <button
                    type="button"
                    className="dandar:icon-button"
                    aria-label="Сануулга хасах"
                    onClick={() =>
                      setTask({ ...task, reminders: task.reminders.filter((_, j) => j !== i) })
                    }
                  >
                    <IconX size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="dandar:soft-button"
                disabled={task.reminders.length >= 5}
                onClick={() => setTask({ ...task, reminders: [...task.reminders, 15] })}
              >
                <IconPlus size={15} />
                Сануулах цаг нэмэх
              </button>
            </fieldset>
            <footer>
              <button type="button" className="dandar:soft-button" onClick={close}>
                Болих
              </button>
              <button className="dandar:primary-button" disabled={saving}>
                <IconCheck size={16} />
                {saving ? "Хадгалж байна…" : "Даалгавар хадгалах"}
              </button>
            </footer>
          </form>
        )}
        {modal === "preferences" && (
          <form
            className="dandar:study-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save("preferences", prefs)) close();
            }}
          >
            <label className="dandar:toggle-row">
              <span>
                <strong>Сануулга идэвхтэй</strong>
                <small>Deadline болон суралцах сессийн мэдэгдэл</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={prefs.enabled}
                onChange={(e) => setPrefs({ ...prefs, enabled: e.target.checked })}
              />
            </label>
            <label>
              <span>
                <IconBell size={16} />
                Сесс эхлэхээс хэдэн минутын өмнө?
              </span>
              <input
                type="number"
                required
                min={0}
                max={10080}
                value={prefs.sessionReminderMinutes ?? 15}
                onChange={(e) =>
                  setPrefs({ ...prefs, sessionReminderMinutes: Number(e.target.value) })
                }
              />
              <small>Жишээ нь 10:00-д эхлэх ажилд 15 гэж сонговол 09:45-д сануулна.</small>
            </label>
            <div className="dandar:quick-options">
              {[0, 5, 10, 15, 30, 60].map((m) => (
                <button
                  type="button"
                  className={
                    (prefs.sessionReminderMinutes ?? 15) === m ? "dandar:selected-option" : ""
                  }
                  key={m}
                  onClick={() => setPrefs({ ...prefs, sessionReminderMinutes: m })}
                >
                  {m} мин
                </button>
              ))}
            </div>
            <div className="dandar:permission-box">
              <IconBell size={20} />
              <div>
                <strong>
                  {notification === "granted"
                    ? "Браузерын мэдэгдэл зөвшөөрөгдсөн"
                    : "Браузерын мэдэгдэл зөвшөөрөх"}
                </strong>
                <p>Апп нээлттэй үед сануулга хүлээн авна.</p>
              </div>
              <button
                type="button"
                className="dandar:soft-button"
                disabled={notification === "unsupported" || notification === "granted"}
                onClick={async () => {
                  try {
                    if (typeof Notification !== "undefined")
                      setNotification(await Notification.requestPermission());
                  } catch {
                    setMessage("Браузерын мэдэгдлийн тохиргоог шалгана уу.");
                  }
                }}
              >
                {notification === "granted" ? <IconCheck size={17} /> : "Зөвшөөрөх"}
              </button>
            </div>
            <div className="dandar:form-columns">
              <label>
                Чимээгүй цаг эхлэх
                <input
                  type="number"
                  required
                  min={0}
                  max={23}
                  value={prefs.quietStart}
                  onChange={(e) => setPrefs({ ...prefs, quietStart: Number(e.target.value) })}
                />
              </label>
              <label>
                Чимээгүй цаг дуусах
                <input
                  type="number"
                  required
                  min={0}
                  max={23}
                  value={prefs.quietEnd}
                  onChange={(e) => setPrefs({ ...prefs, quietEnd: Number(e.target.value) })}
                />
              </label>
            </div>
            <label>
              Цагийн бүс
              <input
                required
                value={prefs.timeZone}
                onChange={(e) => setPrefs({ ...prefs, timeZone: e.target.value })}
              />
            </label>
            <div className="dandar:form-columns">
              <label>
                Төвлөрөл / завсарлага
                <select
                  value={prefs.focus}
                  onChange={(e) => setPrefs({ ...prefs, focus: Number(e.target.value) as 25 | 45 })}
                >
                  <option value={25}>25 / 5 минут</option>
                  <option value={45}>45 / 10 минут</option>
                </select>
              </label>
              <label>
                Өдрийн дээд ачаалал, минут
                <input
                  type="number"
                  required
                  min={25}
                  max={480}
                  value={prefs.dailyLimit}
                  onChange={(e) => setPrefs({ ...prefs, dailyLimit: Number(e.target.value) })}
                />
              </label>
            </div>
            <footer>
              <button type="button" className="dandar:soft-button" onClick={close}>
                Болих
              </button>
              <button className="dandar:primary-button" disabled={saving}>
                <IconCheck size={16} />
                Тохиргоо хадгалах
              </button>
            </footer>
          </form>
        )}
        {modal === "plan" && (
          <div className="dandar:study-form">
            <div className="dandar:plan-note">
              <IconSparkles size={18} />
              Gemma ажлын дарааллыг санал болгоно. Хугацаа, завсарлага, ачааллыг шалгаад зөвхөн таны
              баталсан хуваарийг хадгална.
            </div>
            {windows.map((w, i) => (
              <div className="dandar:availability-row" key={i}>
                <span className="dandar:window-number">{i + 1}</span>
                <label>
                  Эхлэх
                  <input
                    type="datetime-local"
                    value={w.start}
                    onChange={(e) =>
                      setWindows(
                        windows.map((x, j) => (i === j ? { ...x, start: e.target.value } : x)),
                      )
                    }
                  />
                </label>
                <label>
                  Дуусах
                  <input
                    type="datetime-local"
                    value={w.end}
                    onChange={(e) =>
                      setWindows(
                        windows.map((x, j) => (i === j ? { ...x, end: e.target.value } : x)),
                      )
                    }
                  />
                </label>
                <button
                  className="dandar:icon-button"
                  aria-label="Сул цаг хасах"
                  disabled={windows.length === 1}
                  onClick={() => setWindows(windows.filter((_, j) => i !== j))}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
            <button
              className="dandar:soft-button"
              disabled={windows.length >= 28}
              onClick={() => {
                const w = windows[windows.length - 1]!;
                if (!w.start || !w.end) return;
                setWindows([
                  ...windows,
                  {
                    start: local(new Date(Date.parse(w.start) + 86400000)),
                    end: local(new Date(Date.parse(w.end) + 86400000)),
                  },
                ]);
              }}
            >
              <IconPlus size={15} />
              Дараагийн өдрийн сул цаг
            </button>
            <button
              className="dandar:primary-button"
              disabled={thinking || saving || !openTasks.length}
              onClick={generate}
            >
              <IconSparkles size={17} />
              {thinking ? "Төлөвлөж байна…" : "Төлөвлөгөө санал болгох"}
            </button>
            {!openTasks.length && <p>Эхлээд дуусаагүй даалгавар нэмнэ үү.</p>}
            {model && <p className="dandar:tiny-copy">Төлөвлөгөө: {model}</p>}
            {warnings.map((w, i) => (
              <p className="dandar:plan-warning" role="status" key={i}>
                {w}
              </p>
            ))}
            {preview.length > 0 && (
              <div className="dandar:plan-preview">
                <h3>
                  Чиний шинэ хуваарь{" "}
                  <span className="dandar:count-badge">{preview.length} сесс</span>
                </h3>
                {preview.map((b) => (
                  <div key={b.id}>
                    <IconBook2 size={17} />
                    <span>
                      <strong>{state.tasks.find((t) => t.id === b.taskId)?.title}</strong>
                      <small>
                        {time(b.start)}–{clock(b.end)}
                      </small>
                    </span>
                    <span className="dandar:status-pill">
                      {Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60000)} мин
                    </span>
                  </div>
                ))}
                <footer>
                  <button className="dandar:soft-button" onClick={() => setPreview([])}>
                    Болих
                  </button>
                  <button
                    className="dandar:primary-button"
                    disabled={saving}
                    onClick={async () => {
                      if (await save("confirm", preview)) {
                        setPreview([]);
                        close();
                      }
                    }}
                  >
                    <IconCheck size={16} />
                    Хуваарийг батлах
                  </button>
                </footer>
              </div>
            )}
          </div>
        )}
        {modal === "block" && selectedBlock && (
          <div className="dandar:study-form">
            <h3>{state.tasks.find((t) => t.id === selectedBlock.taskId)?.title}</h3>
            <div className="dandar:session-details">
              <span>
                <IconCalendar size={18} />
                {time(selectedBlock.start)}–{clock(selectedBlock.end)}
              </span>
              <span>
                <IconFlag size={18} />
                Deadline: {time(state.tasks.find((t) => t.id === selectedBlock.taskId)!.deadline)}
              </span>
              <span>
                <IconBell size={18} />
                Эхлэхээс {lead} минутын өмнө сануулна
              </span>
              <span className="dandar:status-pill">{statusLabel(selectedBlock.status)}</span>
            </div>
            {selectedBlock.status === "planned" && (
              <>
                <label>
                  Сессийг өөр цагт шилжүүлэх
                  <input
                    type="datetime-local"
                    defaultValue={local(new Date(selectedBlock.start))}
                    onBlur={(e) => {
                      if (
                        e.target.value &&
                        new Date(e.target.value).toISOString() !== selectedBlock.start
                      )
                        void save("move", {
                          id: selectedBlock.id,
                          start: new Date(e.target.value).toISOString(),
                        });
                    }}
                  />
                </label>
                <footer>
                  <button
                    className="dandar:soft-button"
                    disabled={saving}
                    onClick={async () => {
                      if (await save("block", { id: selectedBlock.id, status: "missed" })) close();
                    }}
                  >
                    Тасалдсан
                  </button>
                  <button
                    className="dandar:primary-button"
                    disabled={saving || !!running}
                    onClick={async () => {
                      if (await save("block", { id: selectedBlock.id, status: "started" })) close();
                    }}
                  >
                    <IconPlayerPlay size={17} />
                    Төвлөрч эхлэх
                  </button>
                </footer>
              </>
            )}
          </div>
        )}
      </dialog>
    </main>
  );
};
