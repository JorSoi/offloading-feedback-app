import { getCurrentWindow } from "@tauri-apps/api/window";
import { Info, X } from "lucide-react";
import { useEffect } from "react";
import Gauge from "./Gauge";
import Accordion from "./Accordion";
import ScoreTag from "./ScoreTag";
import Recommendation from "./Recommendation";

export type OffloadingData = {
  score: number;
  explanation: {
    title: string;
    description: string;
  };
  consequences: {
    title: string;
    description: string;
  };
  recommendation?: {
    title: string;
    description: string;
  };
};

export default function Toast({ offloadingData }: { offloadingData: OffloadingData }) {
  const close = () => getCurrentWindow().close();
  const offloadingScore = offloadingData.score;

  useEffect(() => {
    document.documentElement.classList.add("toast-window");
    const t = setTimeout(close, 1000000); // auto dismiss
    return () => {
      clearTimeout(t);
      document.documentElement.classList.remove("toast-window");
    };
  }, []);

  return (
    <div className="toast-content max-h-full overflow-y-auto rounded-2xl bg-white p-5 relative border-slate-300 border-1">
      <div className="flex justify-between fixed z-10 bg-linear-to-b from-white to transparent top-px left-px right-px rounded-tl-2xl rounded-tr-2xl pt-3 px-4 pl-4 pb-5 via-80% via-white/50 from-70%">
        <div className="flex gap-2 items-center">
          <h1 className="font-semibold text-[15px]">Your AI usage</h1>
          <Info className="size-4 opacity-70 cursor-pointer" />
        </div>

        <button
          onClick={close}
          className="p-1.5 border-[#d3d3d3] border rounded-xl cursor-pointer hover:bg-slate-100"
        >
          <X className="size-4.5 opacity-50" />
        </button>
      </div>

      <div className="flex justify-center mt-5 pt-7">
        <Gauge score={offloadingScore} />
      </div>
      <div className="flex justify-center mb-4">
        <ScoreTag score={offloadingScore} />
      </div>
      <div className="space-y-2">
        <Accordion
          title={offloadingData.explanation.title}
          description={offloadingData.explanation.description}
        />
        <Accordion
          title={offloadingData.consequences.title}
          description={offloadingData.consequences.description}
        />
      </div>

      {offloadingData.recommendation && (
        <Recommendation recommendation={offloadingData.recommendation.description} />
      )}
    </div>
  );
}
