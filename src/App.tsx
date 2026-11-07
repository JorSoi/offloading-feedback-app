import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Toast, { type OffloadingData } from "../components/Toast";
import "./App.css";
import { useEffect, useState } from "react";

type WorkflowStep = {
  goal: string;
  actions: number;
  status: string;
};

type WorkflowUpdate = {
  steps: WorkflowStep[];
  final?: boolean;
};

type WorkflowStatus = {
  message: string;
};

type WorkflowTrace = {
  observations: number;
  matched_actions: number;
  waiting_for_screenshots: number;
  buffered_actions: number;
  latest_action_type: string | null;
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

function showToast() {
  const width = 330;
  const height = 510;
  const margin = 16;

  const toastWindow = new WebviewWindow(`toast-${Date.now()}`, {
    url: "index.html?toast=1",
    width,
    height,
    x: window.screen.width - width - margin,
    y: window.screen.availHeight - height - margin,
    decorations: false,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    resizable: false,
    focus: false,
    transparent: true,
    shadow: true,
  });

  void toastWindow.once("tauri://error", (error) => {
    console.error("Failed to create toast window:", error);
  });
}

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
    <main className="m-0 flex flex-col items-center pt-[10vh] text-center ">
      <div>Offloading & AI Feedback</div>
      <button
        className="mt-4 cursor-pointer rounded-lg border border-transparent bg-white px-[1.2em] py-[0.6em] font-medium text-[#0f0f0f] shadow-sm transition hover:border-[#396cd8] active:border-[#396cd8] active:bg-[#e8e8e8]"
        onClick={showToast}
      >
        Show toast
      </button>

      <button
        className="flex gap-2 mt-4 cursor-pointer rounded-lg border border-transparent bg-white px-[1.2em] py-[0.6em] font-medium text-[#0f0f0f] shadow-sm transition hover:border-[#396cd8] active:border-[#396cd8] active:bg-[#e8e8e8] items-center"
        onClick={handleRecording}
        disabled={isRecordingBusy}
      >
        {isRecording && <div className="size-2 bg-red-500 rounded-full"></div>}
        {isRecordingBusy
          ? isRecording
            ? "Finalizing…"
            : "Starting…"
          : `${isRecording ? "Stop" : "Start"} Recording`}
      </button>
      {recordingError && (
        <p role="alert" className="mt-2 max-w-md text-sm text-red-600">
          {recordingError}
        </p>
      )}
      <section
        aria-label="Current induced workflow"
        aria-live="polite"
        className="mt-4 w-[min(90vw,32rem)] rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Workflow debug</h2>
          <span className="text-xs text-gray-500">{workflowStatus}</span>
        </div>
        {workflowTrace && (
          <p className="mt-1 text-xs text-gray-500">
            {workflowTrace.observations} recorded · {workflowTrace.matched_actions} matched to
            screenshots · {workflowTrace.waiting_for_screenshots} waiting for screenshots ·{" "}
            {workflowTrace.buffered_actions} buffered
            {workflowTrace.latest_action_type && ` · latest: ${workflowTrace.latest_action_type}`}
          </p>
        )}
        {workflowError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {workflowError}
          </p>
        )}
        {workflowSteps.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No workflow steps yet.</p>
        ) : (
          <ol className="mt-2 max-h-52 list-decimal space-y-1 overflow-y-auto pl-5 text-sm">
            {workflowSteps.map((step, index) => (
              <li key={`${index}-${step.goal}`}>
                <span>{step.goal}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {step.actions} action{step.actions === 1 ? "" : "s"} · {step.status}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

export default App;
