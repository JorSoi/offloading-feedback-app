"""Convert recorded input observations and screenshots into action nodes."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ACTION_IDLE_SECONDS = 2.5
KEY_ACTION_LABELS = {
    "Key.enter": "press Enter",
    "Key.tab": "press Tab",
    "Key.esc": "press Escape",
}


def action_type(action: str) -> str:
    if "press" in action:
        return "keyboard"
    if "scroll" in action:
        return "scroll"
    return "action"


class ActionBuffer:
    def __init__(self) -> None:
        from .utils import compose_key_input, get_key_input

        self._compose_key_input = compose_key_input
        self._get_key_input = get_key_input
        self.actions: list[str] = []
        self.kind: str | None = None
        self.last_action_at = 0.0

    def _flush(self) -> list[dict[str, str]]:
        if not self.actions:
            return []
        actions = self.actions
        kind = self.kind
        self.actions = []
        self.kind = None

        if kind == "keyboard":
            keys = [self._get_key_input(action) for action in actions]
            key_actions: list[str] = []
            text_keys: list[str] = []

            def flush_text() -> None:
                if text_keys:
                    text = self._compose_key_input(text_keys).replace("'", "\\'")
                    if text:
                        key_actions.append(f"key_press('{text}')")
                    text_keys.clear()

            for key in keys:
                key_name = key.removesuffix("+")
                label = KEY_ACTION_LABELS.get(key_name)
                if label:
                    flush_text()
                    key_actions.append(label)
                else:
                    text_keys.append(key)
            flush_text()
            if not key_actions:
                key_actions.append("key_press('')")
            return [
                {
                    "before": actions[0],
                    "after": actions[-1],
                    "action": " then ".join(key_actions),
                }
            ]
        if kind == "scroll":
            return [
                {"before": action, "after": action, "action": action}
                for action in actions
            ]
        return [
            {"before": actions[0], "after": actions[-1], "action": actions[0]}
        ]

    def push(self, action: str, now: float) -> list[dict[str, str]]:
        kind = action_type(action)
        finished: list[dict[str, str]] = []
        if self.actions and now - self.last_action_at >= ACTION_IDLE_SECONDS:
            finished.extend(self._flush())
        if self.actions and kind != self.kind:
            finished.extend(self._flush())

        if kind == "action":
            finished.append({"before": action, "after": action, "action": action})
        else:
            self.kind = kind
            self.actions.append(action)
            self.last_action_at = now
        return finished

    def flush_if_idle(self, now: float) -> list[dict[str, str]]:
        if self.actions and now - self.last_action_at >= ACTION_IDLE_SECONDS:
            return self._flush()
        return []

    def flush(self) -> list[dict[str, str]]:
        return self._flush()


def match_screenshot(
    screenshots: list[Path], action: str, suffix: str
) -> Path | None:
    for index, screenshot in enumerate(screenshots):
        if action in screenshot.name and screenshot.name.endswith(suffix):
            return screenshots.pop(index)
    return None


def create_action_node(
    action: dict[str, str], screenshots: list[Path], action_node_type: Any
) -> Any | None:
    is_keyboard = action_type(action["before"]) == "keyboard"
    before_suffix = "_first.jpg" if is_keyboard else "_before.jpg"
    after_suffix = "_final.jpg" if is_keyboard else "_after.jpg"
    before = match_screenshot(screenshots, action["before"], before_suffix)
    after = match_screenshot(screenshots, action["after"], after_suffix)
    if before is None:
        return None
    return action_node_type(
        action=action["action"],
        state={"before": str(before), "after": str(after) if after else None},
    )


def parse_action_time(value: str | None) -> float:
    if not value:
        return time.time()
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        return timestamp.timestamp()
    except ValueError:
        return time.time()


def take_screenshots(
    screenshots_dir: Path,
    session_started_at: float,
    used_screenshots: set[Path],
) -> list[Path]:
    return sorted(
        (
            path
            for path in screenshots_dir.glob("*.jpg")
            if float(path.name.split("_", 1)[0]) >= session_started_at
            and path not in used_screenshots
        ),
        key=lambda path: float(path.name.split("_", 1)[0]),
    )
