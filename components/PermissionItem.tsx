import { Check } from "lucide-react";
import Toggle from "./Toggle";

export default function PermissionItem({
  hasPermission,
  idx,
  permissionTitle,
}: {
  hasPermission: boolean;
  idx: number;
  permissionTitle: string;
}) {
  return (
    <div className="flex items-center">
      {hasPermission ? <Check color="#25852C" className="size-5"/> : <p className="text-[#808082] pl-1.5">{idx}</p>}
      <p className={`ml-2 ${hasPermission ? "line-through text-[#748697]" : "text-[#374149] pl-1.5"}`}>
        {permissionTitle}
      </p>
      <Toggle isActive={hasPermission} />
    </div>
  );
}


