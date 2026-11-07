# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Computer activity recording

The Start Recording button launches [`crec`](https://github.com/zorazrw/workflow-induction-toolkit/tree/main/computer-recorder), which captures system-wide keystrokes, clicks, and screenshots. Install the toolkit's `computer-recorder` package separately (`pip install -e .` from that directory) and make sure `crec` is available on the environment PATH used to launch the app. Recorded data is saved under `~/Downloads/records`.

On macOS, grant the app Accessibility and Screen Recording permissions as needed by `crec`. Use this feature only with the recorded user's informed consent; recordings may contain sensitive information. Stop Recording (or close the app) to end a session.

## Real-time workflow induction

The app also starts its Python workflow induction bridge while recording. The required induction logic and prompts are vendored under `src-tauri/scripts/workflow_induction`, so the induction process does not depend on a separate toolkit checkout. Their upstream Apache 2.0 license and attribution are included alongside the code.

Install the bridge's Python dependencies:

```sh
python3 -m pip install -r src-tauri/scripts/workflow_induction/requirements.txt
```

Provide your OpenAI API key through the environment or an untracked `.env` file in the app root:

```sh
export OPENAI_API_KEY="your-api-key"
# Optional: select the Python environment containing the toolkit dependencies.
export WORKFLOW_INDUCTION_PYTHON="python3"
npm run tauri dev
```

`crec` remains a separate recorder executable and must be installed and available on `PATH`. Induced steps and errors appear below the recorder button. The app stops both processes when recording ends.

During recording, segment-level previews are saved to `~/Downloads/records/workflow_live.json` and `workflow_live.txt`. When recording stops, the app runs the toolkit's final iterative workflow-merging pass and saves the completed, hierarchical workflow to `~/Downloads/records/workflow.json`, with a readable summary in `workflow.txt`. The final files are written only after final induction succeeds; the live preview remains available if finalization fails. Action and screenshot data remains alongside them in the same `records` directory.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
