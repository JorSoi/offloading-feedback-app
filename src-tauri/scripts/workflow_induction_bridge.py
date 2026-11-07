#!/usr/bin/env python3
"""Adapt the workflow-induction toolkit's Python models to the Tauri event stream."""

from __future__ import annotations

import json
import os
import signal
import sqlite3
import sys
import time
import traceback
from pathlib import Path
from typing import Any


POLL_INTERVAL = 0.5
SEGMENT_IDLE_SECONDS = 4.0
MIN_SEGMENT_ACTIONS = 1
MAX_SEGMENT_ACTIONS = 10

stopping = False


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def handle_stop(_signum: int, _frame: Any) -> None:
    global stopping
    stopping = True


def main() -> None:
    workflow_dir = Path(__file__).resolve().parent / "workflow_induction"
    data_dir = Path.home() / "Downloads" / "records"
    database_path = data_dir / "actions.db"
    screenshots_dir = data_dir / "screenshots"
    session_started_at = time.time()

    if not (workflow_dir / "language.py").is_file():
        raise FileNotFoundError(f"Vendored workflow induction code not found at {workflow_dir}")

    from dotenv import load_dotenv

    app_env = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(app_env)
    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError(
            f"OPENAI_API_KEY is missing. Set it in {app_env} or the app environment."
        )

    os.chdir(workflow_dir)

    from workflow_induction.language import ActionNode, SequenceNode
    from workflow_induction.utils import call_llm
    from workflow_induction.get_human_trajectory import (
        ActionBuffer,
        action_type,
        create_action_node,
        parse_action_time,
        take_screenshots,
    )
    from workflow_induction.induce import (
        annotate_segment,
        induce_final_workflow,
        node_action_count,
        persist_workflow,
    )
    from workflow_induction.segment import SEGMENT_THRESHOLD, screenshot_diff

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    data_dir.mkdir(parents=True, exist_ok=True)
    screenshots_dir.mkdir(parents=True, exist_ok=True)
    buffer = ActionBuffer()
    pending_segment: list[Any] = []
    pending_actions: list[dict[str, str]] = []
    used_screenshots: set[Path] = set()
    workflow_nodes: list[Any] = []
    workflow: list[dict[str, Any]] = []
    last_segment_at = time.monotonic()
    last_state: str | None = None
    last_id = 0
    has_initial_id = False
    observation_count = 0
    matched_action_count = 0
    latest_action_type: str | None = None
    last_trace: tuple[int, int, int, int, str | None] | None = None

    def connect() -> sqlite3.Connection:
        connection = sqlite3.connect(database_path, timeout=5)
        connection.row_factory = sqlite3.Row
        return connection

    if database_path.exists():
        with connect() as connection:
            has_observations = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='observations'"
            ).fetchone()
            if has_observations:
                row = connection.execute("SELECT COALESCE(MAX(id), 0) FROM observations").fetchone()
                last_id = int(row[0])
                has_initial_id = True

    def induce_segment(nodes: list[Any]) -> None:
        nonlocal workflow, workflow_nodes
        if not nodes:
            return
        emit({"type": "status", "message": f"Inducing workflow from {len(nodes)} actions"})
        steps, annotation_error = annotate_segment(nodes)
        workflow_nodes.extend(steps)
        first_index = len(workflow)
        for node in steps:
            goal = node.goal or node.get_semantic_repr()
            workflow.append(
                {
                    "goal": goal or "Workflow step",
                    "actions": node_action_count(node),
                    "status": node.status.value,
                }
            )
        persist_workflow(
            data_dir,
            workflow_nodes,
            SequenceNode,
            json_name="workflow_live.json",
            text_name="workflow_live.txt",
        )
        emit({"type": "workflow", "steps": workflow, "new_steps": len(workflow) - first_index})
        if annotation_error:
            emit({"type": "error", "message": annotation_error})

    persist_workflow(
        data_dir,
        workflow_nodes,
        SequenceNode,
        json_name="workflow_live.json",
        text_name="workflow_live.txt",
    )
    emit({"type": "status", "message": "Monitoring recording database"})
    while not stopping:
        if not database_path.exists():
            time.sleep(POLL_INTERVAL)
            continue

        with connect() as connection:
            tables = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='observations'"
            ).fetchone()
            if not tables:
                time.sleep(POLL_INTERVAL)
                continue
            if not has_initial_id:
                last_id = 0
                has_initial_id = True
            rows = connection.execute(
                "SELECT id, content, created_at FROM observations "
                "WHERE id > ? AND content_type = 'input_text' ORDER BY id",
                (last_id,),
            ).fetchall()
        now = time.monotonic()
        for row in rows:
            last_id = int(row["id"])
            observation_count += 1
            latest_action_type = action_type(str(row["content"]))
            for action in buffer.push(str(row["content"]), parse_action_time(row["created_at"])):
                pending_actions.append(action)

        for action in buffer.flush_if_idle(time.time()):
            pending_actions.append(action)

        screenshots = take_screenshots(
            screenshots_dir, session_started_at, used_screenshots
        )
        unmatched_actions: list[dict[str, str]] = []
        for action in pending_actions:
            node = create_action_node(action, screenshots, ActionNode)
            if node is None:
                unmatched_actions.append(action)
                continue
            used_screenshots.add(Path(node.state.before))
            if node.state.after:
                used_screenshots.add(Path(node.state.after))
            current_state = node.state.before
            if pending_segment and screenshot_diff(last_state, current_state) > SEGMENT_THRESHOLD:
                induce_segment(pending_segment)
                pending_segment = []
            pending_segment.append(node)
            last_state = node.state.after or current_state
            last_segment_at = now
            matched_action_count += 1
        pending_actions = unmatched_actions

        trace = (
            observation_count,
            matched_action_count,
            len(pending_actions),
            len(buffer.actions),
            latest_action_type,
        )
        if trace != last_trace:
            emit(
                {
                    "type": "trace",
                    "observations": observation_count,
                    "matched_actions": matched_action_count,
                    "waiting_for_screenshots": len(pending_actions),
                    "buffered_actions": len(buffer.actions),
                    "latest_action_type": latest_action_type,
                }
            )
            last_trace = trace

        if pending_segment and (
            len(pending_segment) >= MAX_SEGMENT_ACTIONS
            or (
                len(pending_segment) >= MIN_SEGMENT_ACTIONS
                and now - last_segment_at >= SEGMENT_IDLE_SECONDS
            )
        ):
            induce_segment(pending_segment)
            pending_segment = []
            last_state = None

        time.sleep(POLL_INTERVAL)

    for action in buffer.flush():
        node = create_action_node(
            action,
            take_screenshots(
                screenshots_dir, session_started_at, used_screenshots
            ),
            ActionNode,
        )
        if node is not None:
            used_screenshots.add(Path(node.state.before))
            if node.state.after:
                used_screenshots.add(Path(node.state.after))
            pending_segment.append(node)
    if pending_segment:
        induce_segment(pending_segment)

    if workflow_nodes:
        emit(
            {
                "type": "status",
                "message": f"Finalizing {len(workflow_nodes)} induced workflow steps",
            }
        )
        prompt_path = workflow_dir / "prompts" / "induce.txt"
        try:
            final_root = induce_final_workflow(
                workflow_nodes,
                SequenceNode,
                call_llm,
                prompt_path.read_text(encoding="utf-8"),
                emit,
            )
        except Exception:
            emit({"type": "status", "message": "Final workflow induction failed; live preview preserved"})
            raise
        persist_workflow(
            data_dir,
            final_root.nodes,
            SequenceNode,
            json_name="workflow.json",
            text_name="workflow.txt",
        )
        final_steps = [
            {
                "goal": node.goal or "Workflow step",
                "actions": node_action_count(node),
                "status": node.status.value,
            }
            for node in final_root.nodes
        ]
        emit({"type": "workflow", "steps": final_steps, "final": True})
        emit(
            {
                "type": "status",
                "message": f"Final workflow saved to {data_dir / 'workflow.json'}",
            }
        )
    else:
        emit({"type": "status", "message": "Recording stopped; no workflow steps were induced"})


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit({"type": "error", "message": str(error)})
        traceback.print_exc(file=sys.stderr)
        raise SystemExit(1) from error
