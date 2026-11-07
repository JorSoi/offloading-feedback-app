"""Segment recorded actions when screenshots show a substantial state change."""

from __future__ import annotations

MAX_DIFF = 100000.0
SEGMENT_THRESHOLD = 8000.0


def screenshot_diff(before: str | None, after: str | None) -> float:
    if not before or not after:
        return 0.0

    import cv2
    import numpy as np

    image_before = cv2.imread(before)
    image_after = cv2.imread(after)
    if image_before is None or image_after is None:
        return 0.0
    if image_before.shape != image_after.shape:
        return MAX_DIFF
    difference = image_before.astype("float32") - image_after.astype("float32")
    return float(
        np.sum(difference * difference)
        / (image_before.shape[0] * image_before.shape[1])
    )
