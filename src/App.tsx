import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import Toast, { type OffloadingData } from "./Toast";
import "./App.css";

const offloadingExamples: OffloadingData[] = [
  {
    score: 20,
    explanation: {
      title: "You do most of the thinking",
      description: "You use AI for occasional support while making the key decisions yourself.",
    },
    consequences: {
      title: "You stay actively engaged",
      description: "You build your own skills, though doing everything yourself can take more time.",
    },
  },
  {
    score: 50,
    explanation: {
      title: "You share the thinking with AI",
      description: "You use AI for meaningful parts of your work while staying involved in the outcome.",
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
    score: 85,
    explanation: {
      title: "AI does most of the thinking",
      description: "You rely on AI for most of the reasoning and accept its output with little review.",
    },
    consequences: {
      title: "You may miss errors and lose practice",
      description: "Unreviewed output can contain mistakes, and relying on it may weaken your own skills.",
    },
    recommendation: {
      title: "Verify before you rely on it",
      description: "Check important claims and redo key reasoning yourself before using the result.",
    },
  },
];

function showToast() {
  const width = 320;
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
  });

  void toastWindow.once("tauri://error", (error) => {
    console.error("Failed to create toast window:", error);
  });
}

function App() {
  const isToast = new URLSearchParams(window.location.search).has("toast");
  if (isToast) return <Toast offloadingData={offloadingExamples[2]} />;

  return (
    <main className="m-0 flex flex-col items-center pt-[10vh] text-center ">
      <div>Offloading & AI Feedback</div>
      <button
        className="mt-4 cursor-pointer rounded-lg border border-transparent bg-white px-[1.2em] py-[0.6em] font-medium text-[#0f0f0f] shadow-sm transition hover:border-[#396cd8] active:border-[#396cd8] active:bg-[#e8e8e8]"
        onClick={showToast}
      >
        Show toast
      </button>
    </main>
  );
}

export default App;