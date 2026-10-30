import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const scoreTagVariants = cva("rounded-lg px-2 py-1 text-sm font-medium transition-all duration-800", {
  variants: {
    status: {
      green: "bg-green-500/15 text-green-700",
      yellow: "bg-yellow-500/20 text-yellow-800",
      red: "bg-red-500/15 text-red-700",
    },
  },
});

type ScoreTagStatus = NonNullable<VariantProps<typeof scoreTagVariants>["status"]>;
type ScoreTagProps = Omit<ComponentProps<"p">, "children"> & {
  score: number;
};

const statusLabels: Record<ScoreTagStatus, string> = {
  green: "Looking good!",
  yellow: "Be careful!",
  red: "That's too much!",
};

function ScoreTag({ className, score, ...props }: ScoreTagProps) {
  const status: ScoreTagStatus =
    score < 40 ? "green" : score < 70 ? "yellow" : "red";

  return (
    <p className={scoreTagVariants({ status, className })} {...props}>
      {statusLabels[status]}
    </p>
  );
}

export default ScoreTag;
