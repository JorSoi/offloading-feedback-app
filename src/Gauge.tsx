import NumberFlow from "@number-flow/react";

export default function Gauge({ score }: { score: number }) {
  const rotation = score <= 50 ? 240 + (score / 50) * 120 : 360 + ((score - 50) / 50) * 110;

  return (
    <div className="relative ">
      <img src="/gauge.svg" alt="AI usage gauge" className="block h-auto w-50" />
      <div className="absolute inset-0 flex justify-center items-center">
        <div className="bg-black/20 rounded-full size-10 relative flex justify-center items-center">
          <div
            className="absolute left-1/2 bottom-1/2 w-2.5 h-14 origin-bottom transition-transform duration-1000"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <svg viewBox="0 0 10 56" className="block h-full w-full" aria-hidden="true">
              <path d="M0 56 2.5 3.5C2.5 1.57 3.62 0 5 0s2.5 1.57 2.5 3.5L10 56Z" fill="black" />
            </svg>
          </div>
          <div className="rounded-full size-5 bg-black"></div>
        </div>
        <div className="absolute bottom-2 ">
          <p className="text-[14px] font-medium opacity-50">Offloading Score</p>
          <p className="text-center text-2xl font-bold">
            <NumberFlow value={score} transformTiming={{ duration: 800 }} />
            /100
          </p>
        </div>
      </div>
    </div>
  );
}
