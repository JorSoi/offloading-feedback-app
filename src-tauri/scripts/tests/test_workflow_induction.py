import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from workflow_induction.get_human_trajectory import ActionBuffer, take_screenshots
from workflow_induction.induce import (
    annotate_segment,
    get_step_goals,
    parse_workflow_steps,
)
from workflow_induction.language import (
    ActionNode,
    SequenceNode,
    SequenceStatus,
    annotate_high_level_nodes,
)

ANNOTATION_PROMPT = (
    Path(__file__).resolve().parents[1]
    / "workflow_induction"
    / "prompts"
    / "annotate_node.txt"
)


class WorkflowInductionTests(unittest.TestCase):
    def test_action_semantic_representation_returns_action_when_unlabeled(self):
        node = ActionNode(
            action="key_press('Buy groceries')",
            state={"before": None, "after": None},
        )

        self.assertEqual(node.get_semantic_repr(), "key_press('Buy groceries')")
        self.assertEqual(
            get_step_goals([node]), "[0] key_press('Buy groceries')"
        )

    def test_annotation_retries_invalid_response_before_assigning_goal(self):
        root = SequenceNode(
            nodes=[
                ActionNode(
                    action="click_left(10, 20)",
                    state={"before": None, "after": None},
                )
            ]
        )
        with patch(
            "workflow_induction.language.call_llm",
            side_effect=["not a chunk", "[0-0] Open the new task form"],
        ) as call_llm:
            result = annotate_high_level_nodes(root, prompt_path=str(ANNOTATION_PROMPT))

        self.assertEqual(call_llm.call_count, 2)
        self.assertEqual(result.goal, "Open the new task form")

    def test_annotation_fails_after_three_invalid_responses(self):
        root = SequenceNode(
            nodes=[
                ActionNode(
                    action="click_left(10, 20)",
                    state={"before": None, "after": None},
                )
            ]
        )
        with patch(
            "workflow_induction.language.call_llm",
            return_value="not a chunk",
        ) as call_llm:
            with self.assertRaisesRegex(RuntimeError, "after 3 attempts"):
                annotate_high_level_nodes(root, prompt_path=str(ANNOTATION_PROMPT))

        self.assertEqual(call_llm.call_count, 3)

    def test_annotation_failure_keeps_unclassified_actions_without_generic_goal(self):
        node = ActionNode(
            action="key_press('Buy groceries')",
            state={"before": None, "after": None},
        )
        with patch(
            "workflow_induction.language.call_llm",
            return_value="not a chunk",
        ):
            fallback_nodes, error = annotate_segment([node])

        self.assertIsNotNone(error)
        self.assertIsNone(fallback_nodes[0].goal)
        self.assertEqual(fallback_nodes[0].status, SequenceStatus.UNKNOWN)
        self.assertIn("Buy groceries", fallback_nodes[0].get_semantic_repr())

    def test_final_single_node_range_keeps_induced_goal(self):
        node = ActionNode(
            action="click_left(10, 20)",
            state={"before": None, "after": None},
        )

        result = parse_workflow_steps(
            [(0, 0, "Open the new task form")], [node], SequenceNode
        )

        self.assertIs(result.nodes[0], node)
        self.assertEqual(node.goal, "Open the new task form")

    def test_keyboard_buffer_keeps_enter_out_of_typed_text(self):
        buffer = ActionBuffer()
        buffer.push("key_press(Key.shift)", 1.0)
        buffer.push("key_press('Buy')", 1.1)
        buffer.push("key_press(Key.space)", 1.2)
        buffer.push("key_press('groceries')", 1.3)
        buffer.push("key_press(Key.enter)", 1.4)

        self.assertEqual(
            buffer.flush(),
            [
                {
                    "before": "key_press(Key.shift)",
                    "after": "key_press(Key.enter)",
                    "action": "key_press('Buy groceries') then press Enter",
                }
            ],
        )

    def test_used_screenshots_are_not_returned_for_a_later_action(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            screenshot = Path(temp_dir) / "1_click_before.jpg"
            screenshot.touch()

            self.assertEqual(take_screenshots(Path(temp_dir), 0, set()), [screenshot])
            self.assertEqual(
                take_screenshots(Path(temp_dir), 0, {screenshot}), []
            )


if __name__ == "__main__":
    unittest.main()
