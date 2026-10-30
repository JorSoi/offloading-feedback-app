import { useState } from "react";

function Accordion({ title, description }: { title: string; description: string }) {
  const [isOpen, setOpen] = useState(false);

  return (
    <div
      className="bg-[#eaeee9] rounded-xl px-3 py-2 cursor-pointer hover:bg-[#d7dbd6] transition-colors"
      onClick={() => setOpen(!isOpen)}
    >
      <div className="flex items-center gap-2">
        <img
          src="/chevron.svg"
          alt="AI usage gauge"
          className={`block h-auto w-1.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className={`text-sm pl-4 text-[#505B6D] overflow-hidden ${isOpen ? "h-auto" : "h-0"}`}>
        {description}
      </p>
    </div>
  );
}

export default Accordion;
