export type WorkflowStep = {
  goal: string;
  actions: number;
  status: string;
};

export type WorkflowTrace = {
  observations: number;
  matched_actions: number;
  waiting_for_screenshots: number;
  buffered_actions: number;
  latest_action_type: string | null;
};

type DebugPanelProps = {
  workflowStatus: string;
  workflowSteps: WorkflowStep[];
  workflowTrace: WorkflowTrace | null;
  workflowError: string | null;
};

function DebugPanel({
  workflowStatus,
  workflowSteps,
  workflowTrace,
  workflowError,
}: DebugPanelProps) {
  return (
    <section
      aria-label="Current induced workflow"
      aria-live="polite"
      className="mt-4 overflow-hidden rounded-2xl border border-[#e4e4e4] bg-white text-left text-[#374149] shadow-sm"
    >
      <div className="space-y-4 p-5 font-mono text-xs">
        <p className="text-[#748697]">
          <span className="text-[#2F69FF]">status</span>
          <span className="mx-2 text-[#b8bdc6]">-&gt;</span>
          <span className="text-[#374149]">{workflowStatus}</span>
        </p>
        {workflowTrace && (
          <div className="grid grid-cols-2 gap-2 text-[#748697] sm:grid-cols-4">
            <span><b className="font-normal text-[#374149]">{workflowTrace.observations}</b> observations</span>
            <span><b className="font-normal text-[#374149]">{workflowTrace.matched_actions}</b> matched</span>
            <span><b className="font-normal text-[#374149]">{workflowTrace.waiting_for_screenshots}</b> waiting</span>
            <span><b className="font-normal text-[#374149]">{workflowTrace.buffered_actions}</b> buffered</span>
          </div>
        )}
        {workflowError && (
          <p role="alert" className="border-l-2 border-[#d93025] pl-3 text-[#b42318]">
            error: {workflowError}
          </p>
        )}
        <div className="max-h-52 overflow-y-auto rounded-lg border border-[#e4e4e4] bg-[#fafafa] p-3">
          {workflowSteps.length === 0 ? (
            <p className="text-[#748697]">
              <span className="mr-2 text-[#2F69FF]">$</span>
              awaiting workflow steps...
            </p>
          ) : (
            <ol className="space-y-2">
              {workflowSteps.map((step, index) => (
                <li key={`${index}-${step.goal}`} className="flex gap-3">
                  <span className="shrink-0 text-[#a0a6b0]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 text-[#374149]">
                    {step.goal}
                    <span className="ml-2 text-[#748697]">
                      [{step.actions} action{step.actions === 1 ? "" : "s"} · {step.status}]
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {workflowTrace?.latest_action_type && (
          <p className="text-[#748697]">
            latest action: <span className="text-[#374149]">{workflowTrace.latest_action_type}</span>
          </p>
        )}
      </div>
    </section>
  );
}

export default DebugPanel;
