import { useMutation } from "@apollo/client";
import { useState } from "react";
import { IconBook2, IconCheck, IconFlag, IconMicrophone, IconSparkles } from "@tabler/icons-react";
import { gql } from "~/gql";
import { MicButton } from "../voice/MicButton";

const PLAN_FROM_SPEECH = gql(
  `mutation dandarPlanFromSpeech($text: String!) { dandarPlanFromSpeech(text: $text) { tasks blocks warnings model } }`,
);

// Mirrors MAX_SPEECH_LENGTH in api/src/modules/planner/voicePlan.ts.
const MAX_SPEECH_LENGTH = 2000;

export type VoiceTask = {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  minutes: number;
  priority: number;
  status: "todo";
  reminders: number[];
};
export type VoiceBlock = {
  id: string;
  taskId: string;
  start: string;
  end: string;
  status: "planned";
  actualMinutes: number;
};

type Props = {
  useChimege: boolean;
  saving: boolean;
  time: (value: string) => string;
  onApply: (tasks: VoiceTask[], blocks: VoiceBlock[]) => Promise<boolean>;
};

// Speak (or type) a plan → Gemma 4 extracts tasks and free time → the
// planner engine schedules sessions → the student confirms before saving.
export const VoicePlan = ({ useChimege, saving, time, onApply }: Props) => {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState<VoiceTask[]>([]);
  const [blocks, setBlocks] = useState<VoiceBlock[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [plan, { loading }] = useMutation(PLAN_FROM_SPEECH);

  const reset = () => {
    setTasks([]);
    setBlocks([]);
    setWarnings([]);
    setModel("");
  };

  const generate = async () => {
    setError("");
    reset();
    try {
      const result = await plan({ variables: { text: text.trim() } });
      const data = result.data?.dandarPlanFromSpeech;
      if (data) {
        setTasks(JSON.parse(data.tasks) as VoiceTask[]);
        setBlocks(JSON.parse(data.blocks) as VoiceBlock[]);
        setWarnings(data.warnings);
        setModel(data.model);
      }
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Төлөвлөж чадсангүй");
    }
  };

  return (
    <div className="dandar:study-form">
      <div className="dandar:plan-note">
        <IconMicrophone size={18} />
        Юу хийх, хэзээ хийхээ монголоор хэлээрэй. Жишээ нь: "Маргааш 4 цагаас 6 цаг хүртэл
        математикаа давтана. Баасан гаригт физикийн шалгалттай."
      </div>
      <div className="dandar:voice-input">
        <MicButton
          className="dandar:primary-button"
          label="Ярих"
          useChimege={useChimege}
          onText={(spoken) =>
            setText((current) => `${current ? `${current} ` : ""}${spoken}`.slice(0, MAX_SPEECH_LENGTH))
          }
          onError={setError}
        />
        <span className="dandar:tiny-copy">Ярьж дуусаад дахин дарна. Текстийг засаж болно.</span>
      </div>
      <label>
        Таны хэлсэн
        <textarea
          rows={4}
          maxLength={MAX_SPEECH_LENGTH}
          placeholder="Энд таны яриа текст болж гарна…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {error && (
        <p className="dandar:plan-warning" role="alert">
          {error}
        </p>
      )}
      <button
        className="dandar:primary-button"
        disabled={loading || saving || !text.trim()}
        onClick={generate}
      >
        <IconSparkles size={17} />
        {loading ? "Gemma 4 төлөвлөж байна…" : "Gemma 4-өөр төлөвлөх"}
      </button>
      {model && <p className="dandar:tiny-copy">Төлөвлөгөө: {model}</p>}
      {warnings.map((w, i) => (
        <p className="dandar:plan-warning" role="status" key={i}>
          {w}
        </p>
      ))}
      {tasks.length > 0 && (
        <div className="dandar:plan-preview">
          <h3>
            Шинэ даалгавар <span className="dandar:count-badge">{tasks.length}</span>
            {blocks.length > 0 && <span className="dandar:count-badge">{blocks.length} сесс</span>}
          </h3>
          {tasks.map((t) => (
            <div key={t.id}>
              <IconFlag size={17} />
              <span>
                <strong>{t.title}</strong>
                <small>
                  {t.subject ? `${t.subject} · ` : ""}Deadline: {time(t.deadline)} · {t.minutes} мин
                </small>
              </span>
            </div>
          ))}
          {blocks.map((b) => (
            <div key={b.id}>
              <IconBook2 size={17} />
              <span>
                <strong>{tasks.find((t) => t.id === b.taskId)?.title}</strong>
                <small>{time(b.start)}</small>
              </span>
              <span className="dandar:status-pill">
                {Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60000)} мин
              </span>
            </div>
          ))}
          <footer>
            <button className="dandar:soft-button" onClick={reset}>
              Болих
            </button>
            <button
              className="dandar:primary-button"
              disabled={saving}
              onClick={async () => {
                if (await onApply(tasks, blocks)) {
                  setText("");
                  reset();
                }
              }}
            >
              <IconCheck size={16} />
              Төлөвлөгөөнд нэмэх
            </button>
          </footer>
        </div>
      )}
    </div>
  );
};
