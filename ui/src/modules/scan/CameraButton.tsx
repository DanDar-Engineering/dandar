import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { IconCamera, IconCameraRotate, IconCapture } from "@tabler/icons-react";
import { Button, Dialog } from "erxes-ui";

type Props = {
  onCapture: (file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

// Browsers allow a live camera only on localhost or HTTPS. Phones that open
// erxes over plain http on the local network get the native camera app
// through <input capture> instead.
const liveCameraAvailable = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  Boolean(navigator.mediaDevices?.getUserMedia);

const CAMERA_ERRORS: Record<string, string> = {
  NotAllowedError: "Камерын зөвшөөрөл өгөөгүй байна. Хөтчийн тохиргооноос зөвшөөрнө үү.",
  NotFoundError: "Камер олдсонгүй.",
  NotReadableError: "Камерыг өөр програм ашиглаж байна.",
};

const cameraError = (error: unknown) =>
  (error instanceof DOMException && CAMERA_ERRORS[error.name]) ||
  (error instanceof Error ? error.message : "Камерыг нээж чадсангүй");

const LiveCamera = ({
  onCapture,
  onError,
  onClose,
}: {
  onCapture: (file: File) => void;
  onError: (message: string) => void;
  onClose: () => void;
}) => {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  // Callbacks change identity every render; the stream must restart only
  // when the camera side changes.
  const callbacks = useRef({ onError, onClose });
  callbacks.current = { onError, onClose };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play().then(() => setReady(true));
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        callbacks.current.onError(cameraError(error));
        callbacks.current.onClose();
      });

    // The camera light must go off as soon as the dialog closes.
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

  const capture = () => {
    const source = video.current;
    if (!source?.videoWidth) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onError("Зургийг хадгалж чадсангүй");
          return;
        }
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onClose();
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="dandar:flex dandar:flex-col dandar:gap-3">
      <div className="dandar:relative dandar:overflow-hidden dandar:rounded-lg dandar:bg-black">
        <video
          ref={video}
          playsInline
          muted
          className="dandar:aspect-[4/3] dandar:w-full dandar:object-contain"
        />
        {!ready ? (
          <p
            role="status"
            className="dandar:absolute dandar:inset-0 dandar:flex dandar:items-center dandar:justify-center dandar:text-sm dandar:text-white"
          >
            Камерыг асааж байна…
          </p>
        ) : null}
      </div>
      <p className="dandar:text-xs dandar:text-muted-foreground">
        Хуудсыг бүтнээр нь, гэрэлтэй газар, сүүдэргүй барина уу.
      </p>
      <div className="dandar:flex dandar:flex-wrap dandar:justify-between dandar:gap-2">
        <Button
          variant="outline"
          onClick={() => setFacing((current) => (current === "environment" ? "user" : "environment"))}
        >
          <IconCameraRotate />
          Камер солих
        </Button>
        <Button disabled={!ready} onClick={capture}>
          <IconCapture />
          Зураг авах
        </Button>
      </div>
    </div>
  );
};

// "Камераар авах": a live preview where the browser allows it, otherwise the
// device camera app. Either way the photo arrives as a File like an upload.
export const CameraButton = ({ onCapture, onError, disabled, className }: Props) => {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const live = liveCameraAvailable();

  const onNativeCapture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onCapture(file);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        disabled={disabled}
        onClick={() => (live ? setOpen(true) : input.current?.click())}
      >
        <IconCamera />
        Камераар авах
      </Button>
      {live ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <Dialog.Content className="dandar:max-w-2xl">
            <Dialog.HeaderCombined
              title="Камераар зураг авах"
              description="Тэмдэглэл эсвэл материалын хуудсыг камерт харуулна уу."
            />
            {/* Mounted only while open, so the camera runs only then. */}
            {open ? (
              <LiveCamera onCapture={onCapture} onError={onError} onClose={() => setOpen(false)} />
            ) : null}
          </Dialog.Content>
        </Dialog>
      ) : (
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="dandar:sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onNativeCapture}
        />
      )}
    </>
  );
};
