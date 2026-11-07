"""Annotate action segments and induce a higher-level workflow."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Callable

from .language import SequenceNode, SequenceStatus, annotate_high_level_nodes


def node_action_count(node: Any) -> int:
    return int(node.get_num_actions())


def persist_workflow(
    data_dir: Path,
    nodes: list[Any],
    sequence_node_type: Any,
    json_name: str,
    text_name: str | None = None,
) -> None:
    root = sequence_node_type(nodes=nodes)
    workflow_path = data_dir / json_name
    temporary_path = data_dir / f"{json_name}.tmp"
    with temporary_path.open("w", encoding="utf-8") as workflow_file:
        json.dump(root.to_json(), workflow_file, ensure_ascii=False, indent=2)
    os.replace(temporary_path, workflow_path)

    if text_name:
        text_path = data_dir / text_name
        temporary_text_path = data_dir / f"{text_name}.tmp"
        with temporary_text_path.open("w", encoding="utf-8") as workflow_file:
            for node in nodes:
                workflow_file.write(
                    f"{node.goal or node.get_semantic_repr() or 'Unlabeled step'} "
                    f"| Status: {node.status.value}\n"
                )
        os.replace(temporary_text_path, text_path)


def annotate_segment(nodes: list[Any]) -> tuple[list[Any], str | None]:
    root = SequenceNode(nodes=nodes)
    try:
        annotated = annotate_high_level_nodes(root, verbose=False)
        steps = annotated.nodes if isinstance(annotated, SequenceNode) else [annotated]
        return steps, None
    except Exception as error:
        fallback = SequenceNode(
            nodes=nodes
        )
        fallback.status = SequenceStatus.UNKNOWN
        return [fallback], f"Could not annotate this segment: {error}"


def get_step_goals(nodes: list[Any]) -> str:
    goals = []
    for index, node in enumerate(nodes):
        goal = node.goal or node.get_semantic_repr() or "Recorded actions"
        if node.status.value == "failure":
            goal = f"(Attempted Failure) {goal}"
        goals.append(f"[{index}] {goal}")
    return "\n".join(goals)


def parse_workflow_response(
    response: str, node_count: int
) -> list[tuple[int, int, str]]:
    steps = []
    next_index = 0
    for line in response.strip().strip("`").splitlines():
        line = line.strip()
        match = re.match(r"^\[(\d+)(?:\s*-\s*(\d+))?\]\s*(.+)$", line)
        if not match:
            continue
        start = int(match.group(1))
        end = int(match.group(2) or start)
        goal = match.group(3).strip()
        if start != next_index or end < start or end >= node_count or not goal:
            raise ValueError(f"Invalid or incomplete workflow range: {line}")
        steps.append((start, end, goal))
        next_index = end + 1

    if not steps or next_index != node_count:
        raise ValueError(
            f"Workflow response covered {next_index} of {node_count} input steps."
        )
    return steps


def parse_workflow_steps(
    steps: list[tuple[int, int, str]],
    nodes: list[Any],
    sequence_node_type: Any,
) -> Any:
    workflow_root = sequence_node_type(nodes=[])
    for start, end, goal in steps:
        if start == end:
            workflow_node = nodes[start]
            workflow_node.goal = goal
            if (
                workflow_node.node_type.value == "sequence"
                and workflow_node.status.value == "unknown"
            ):
                workflow_node.get_status()
        else:
            workflow_node = sequence_node_type(nodes=nodes[start : end + 1], goal=goal)
            workflow_node.get_status()
        workflow_root.nodes.append(workflow_node)
    return workflow_root


def induce_final_workflow(
    nodes: list[Any],
    sequence_node_type: Any,
    call_llm: Callable[..., str],
    prompt: str,
    emit: Callable[[dict[str, str]], None],
    max_iterations: int = 5,
) -> Any:
    if not nodes:
        raise ValueError("No induced segment steps are available to finalize.")

    previous_root = sequence_node_type(nodes=nodes)
    current_nodes = nodes
    for iteration in range(max_iterations):
        emit(
            {
                "type": "status",
                "message": f"Final workflow induction pass {iteration + 1}/{max_iterations}",
            }
        )
        goals = get_step_goals(current_nodes)
        last_error: Exception | None = None
        for _ in range(3):
            response = call_llm(prompt=prompt, content=goals)
            try:
                ranges = parse_workflow_response(response, len(current_nodes))
                current_root = parse_workflow_steps(
                    ranges, current_nodes, sequence_node_type
                )
                last_error = None
                break
            except (ValueError, IndexError) as error:
                last_error = error
        if last_error:
            raise RuntimeError(
                f"Could not parse final workflow induction response: {last_error}"
            ) from last_error

        if len(previous_root.nodes) <= len(current_root.nodes) + 2:
            return current_root
        previous_root = current_root
        current_nodes = current_root.nodes

    return current_root
