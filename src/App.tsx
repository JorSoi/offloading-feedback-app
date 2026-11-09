import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Toast, { type OffloadingData } from "../components/Toast";
import PermissionItem from "../components/PermissionItem";
import DebugPanel, {
  type WorkflowStep,
  type WorkflowTrace,
} from "../components/DebugPanel";
import "./App.css";
import { useEffect, useState } from "react";

type WorkflowUpdate = {
  steps: WorkflowStep[];
  final?: boolean;
};

type WorkflowStatus = {
  message: string;
};

const offloadingExamples: OffloadingData[] = [
  {
    score: 25,
    explanation: {
      title: "You do most of the thinking",
      description: "You use AI for occasional support while making the key decisions yourself.",
    },
    consequences: {
      title: "You stay actively engaged",
      description:
        "You build your own skills, though doing everything yourself can take more time.",
    },
  },
  {
    score: 51,
    explanation: {
      title: "You share the thinking with AI",
      description:
        "You use AI for meaningful parts of your work while staying involved in the outcome.",
    },
    consequences: {
      title: "You balance help and practice",
      description: "AI can save time while you continue to develop your own understanding.",
    },
    recommendation: {
      title: "Review AI output yourself",
      description: "Check AI's work for accuracy and make the important decisions yourself.",
    },
  },
  {
    score: 88,
    explanation: {
      title: "AI does most of the thinking",
      description:
        "You rely on AI for most of the reasoning and accept its output with little review.",
    },
    consequences: {
      title: "You may miss errors and lose practice",
      description:
        "Unreviewed output can contain mistakes, and relying on it may weaken your own skills.",
    },
    recommendation: {
      title: "Verify before you rely on it",
      description:
        "Check important claims and redo key reasoning yourself before using the result.",
    },
  },
];

const permissions = [
  { title: "Downloads Folder", hasPermission: true },
  { title: "Screen Capture", hasPermission: true },
  { title: "Accessibility", hasPermission: true },
  { title: "Input Monitoring", hasPermission: true },
];

function App() {
  const isToast = new URLSearchParams(window.location.search).has("toast");
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState("Start recording to induce a workflow.");
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [workflowTrace, setWorkflowTrace] = useState<WorkflowTrace | null>(null);

  useEffect(() => {
    if (isToast) return;
    let active = true;
    let unlisteners: (() => void)[] = [];
    void Promise.all([
      listen<WorkflowUpdate>("workflow-update", (event) => {
        setWorkflowSteps(event.payload.steps);
        if (event.payload.final) {
          setWorkflowStatus("Final induced workflow ready.");
        }
        setWorkflowError(null);
      }),
      listen<WorkflowStatus>("workflow-status", (event) => {
        setWorkflowStatus(event.payload.message);
      }),
      listen<WorkflowTrace>("workflow-trace", (event) => {
        setWorkflowTrace(event.payload);
      }),
      listen<string>("workflow-error", (event) => {
        setWorkflowError(event.payload);
      }),
    ])
      .then((listeners) => {
        if (active) {
          unlisteners = listeners;
        } else {
          listeners.forEach((stop) => stop());
        }
      })
      .catch((error: unknown) => setWorkflowError(String(error)));

    return () => {
      active = false;
      unlisteners.forEach((stop) => stop());
    };
  }, [isToast]);

  if (isToast) return <Toast offloadingData={offloadingExamples[2]} />;

  const handleRecording = async () => {
    if (isRecordingBusy) return;
    setIsRecordingBusy(true);
    setRecordingError(null);
    setWorkflowError(null);
    if (!isRecording) {
      setWorkflowStatus("Starting workflow induction...");
      setWorkflowSteps([]);
      setWorkflowTrace(null);
    }
    try {
      await invoke(isRecording ? "stop_recording" : "start_recording");
      setIsRecording(!isRecording);
    } catch (error) {
      setRecordingError(String(error));
    } finally {
      setIsRecordingBusy(false);
    }
  };

  return (
    <main className="m-0 bg-[#F6F6F6] pt-[10vh] p-[3%]">
      <h1 className="text-xl font-medium">Realtime AI Feedback</h1>
      <p className="text-[#383B47]">
        Press start, work as usual, and get feedback on your AI usage when you stop.
      </p>

      <div className="p-7 bg-white border border-[#e4e4e4] rounded-2xl mt-10">
        <p className=" font-medium">Getting started</p>
        <p className="text-[#383B47]">Complete these 4 steps to enable feedback</p>
        <div className="mt-4 flex flex-col gap-5">
          {permissions.map((permission, idx) => (
            <PermissionItem
              key={permission.title}
              hasPermission={permission.hasPermission}
              idx={idx + 1}
              permissionTitle={permission.title}
            />
          ))}
        </div>
      </div>

      <div className="p-7  bg-white border border-[#e4e4e4] rounded-2xl mt-4 relative gap-4 overflow-hidden flex justify-between items-center">
        <div>
          <p className=" font-medium">Start Observing </p>
          <p className="text-[#383B47] max-w-100">
            Press start, work as usual, and get feedback on your AI usage.
          </p>
        </div>
        <button
          className="shrink-0 whitespace-nowrap bg-[#2F69FF] px-3 py-2 relative z-2 rounded-xl font-medium text-white mr-10 cursor-pointer hover:bg-[#2855b7] active:bg-[#396cd8] transition"
          onClick={handleRecording}
          disabled={isRecordingBusy}
        >
          {isRecordingBusy
            ? isRecording
              ? "Finalizing…"
              : "Starting…"
            : `${isRecording ? "Stop" : "Start"} Observing`}
        </button>
        <div className="absolute -top-80 -right-50 z-0 size-150 bg-radial-[closest-side] from-[#2FC1FF]/40 via-[#2FC1FF]/30 to-transparent"></div>
        <img
          src="/gauge-decoration.png"
          alt="AI usage gauge"
          className="block h-auto w-42 absolute -top-1.5 -right-8 z-1"
        />
        {recordingError && (
          <p role="alert" className="absolute bottom-3 left-7 text-sm text-red-600">
            {recordingError}
          </p>
        )}
      </div>

      {isRecording && (
        <DebugPanel
          workflowStatus={workflowStatus}
          workflowSteps={workflowSteps}
          workflowTrace={workflowTrace}
          workflowError={workflowError}
        />
      )}
    </main>
  );
}

export default App;
