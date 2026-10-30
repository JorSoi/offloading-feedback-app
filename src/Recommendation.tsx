import { Brain } from "lucide-react";

function Recommendation({ recommendation }: { recommendation: string }) {
  return (
    <div className="p-2.5 bg-[#DDF0FA] mt-2 rounded-xl">
      <p className="flex gap-1 text-sm font-semibold text-[#2A70AD] items-center">
        <Brain className="size-4.5" />Your Recommendation
      </p>
      <p className="text-[#11144E]/80 text-sm mt-1">{recommendation}</p>
    </div>
  );
}

export default Recommendation;
