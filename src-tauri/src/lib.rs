use serde_json::Value;
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{Mutex, mpsc},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
struct RecorderProcesses(Mutex<Processes>);

#[derive(Default)]
struct Processes {
    recorder: Option<Child>,
    induction: Option<Child>,
}

#[tauri::command]
fn start_recording(app: AppHandle, state: State<'_, RecorderProcesses>) -> Result<(), String> {
    let mut processes = state
        .0
        .lock()
        .map_err(|error| format!("Could not access recording state: {error}"))?;

    if process_is_running(&mut processes.recorder)? || process_is_running(&mut processes.induction)?
    {
        return Err("Recording is already running.".to_string());
    }
    processes.recorder.take();
    processes.induction.take();

    let bridge_path = resolve_bridge_path(&app)?;
    let python = std::env::var("WORKFLOW_INDUCTION_PYTHON").unwrap_or_else(|_| "python3".into());

    let mut induction = Command::new(python)
        .arg(bridge_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| format!("Could not start workflow induction: {error}"))?;

    let (startup_sender, startup_receiver) = mpsc::channel();
    if let Some(stdout) = induction.stdout.take() {
        let event_app = app.clone();
        thread::spawn(move || {
            let mut startup_sender = Some(startup_sender);
            for line in BufReader::new(stdout).lines() {
                let Ok(line) = line else {
                    break;
                };
                let Ok(payload) = serde_json::from_str::<Value>(&line) else {
                    eprintln!("Ignoring invalid workflow-induction output: {line}");
                    continue;
                };

                match payload.get("type").and_then(Value::as_str) {
                    Some("workflow") => {
                        if let Err(error) = event_app.emit("workflow-update", payload) {
                            eprintln!("Could not send workflow update to the app: {error}");
                        }
                    }
                    Some("status") => {
                        if let Some(sender) = startup_sender.take() {
                            let _ = sender.send(Ok(()));
                        }
                        if let Err(error) = event_app.emit("workflow-status", payload) {
                            eprintln!("Could not send workflow status to the app: {error}");
                        }
                    }
                    Some("trace") => {
                        if let Err(error) = event_app.emit("workflow-trace", payload) {
                            eprintln!("Could not send workflow trace to the app: {error}");
                        }
                    }
                    Some("error") => {
                        let message = payload["message"]
                            .as_str()
                            .unwrap_or("Workflow induction failed")
                            .to_string();
                        if let Some(sender) = startup_sender.take() {
                            let _ = sender.send(Err(message.clone()));
                        }
                        if let Err(error) = event_app.emit("workflow-error", message) {
                            eprintln!("Could not send workflow error to the app: {error}");
                        }
                    }
                    _ => eprintln!("Ignoring unknown workflow-induction message: {payload}"),
                }
            }
        });
    }

    match startup_receiver.recv_timeout(Duration::from_secs(30)) {
        Ok(Ok(())) => {}
        Ok(Err(error)) => {
            let _ = stop_process(&mut induction, "workflow induction");
            return Err(error);
        }
        Err(error) => {
            let _ = stop_process(&mut induction, "workflow induction");
            return Err(format!("Workflow induction did not start: {error}"));
        }
    }

    let child = Command::new("crec")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            let _ = stop_process(&mut induction, "workflow induction");
            format!("Could not start `crec`: {error}. Ensure it is installed and available on the app's PATH.")
        })?;

    processes.recorder = Some(child);
    processes.induction = Some(induction);
    Ok(())
}

#[tauri::command]
fn stop_recording(state: State<'_, RecorderProcesses>) -> Result<(), String> {
    stop_processes(&state)
}

fn resolve_bridge_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let development_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("scripts/workflow_induction_bridge.py");
    if development_path.is_file() {
        return Ok(development_path);
    }

    app.path()
        .resolve(
            "scripts/workflow_induction_bridge.py",
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|error| format!("Could not locate workflow-induction bridge: {error}"))
}

fn process_is_running(process: &mut Option<Child>) -> Result<bool, String> {
    process
        .as_mut()
        .map(|child| {
            child
                .try_wait()
                .map(|status| status.is_none())
                .map_err(|error| format!("Could not check recording process status: {error}"))
        })
        .unwrap_or(Ok(false))
}

fn stop_process(child: &mut Child, name: &str) -> Result<(), String> {
    if child
        .try_wait()
        .map_err(|error| format!("Could not check {name} status: {error}"))?
        .is_none()
    {
        #[cfg(unix)]
        {
            let result = unsafe { libc::kill(child.id() as libc::pid_t, libc::SIGINT) };
            if result != 0 {
                child
                    .kill()
                    .map_err(|error| format!("Could not stop {name}: {error}"))?;
            }
        }

        #[cfg(not(unix))]
        child
            .kill()
            .map_err(|error| format!("Could not stop {name}: {error}"))?;

        child
            .wait()
            .map_err(|error| format!("Could not wait for {name} to stop: {error}"))?;
    }
    Ok(())
}

fn stop_processes(state: &RecorderProcesses) -> Result<(), String> {
    let mut recorder = state
        .0
        .lock()
        .map_err(|error| format!("Could not access recording state: {error}"))?;

    let recorder_result = recorder
        .recorder
        .as_mut()
        .map(|child| stop_process(child, "`crec`"))
        .unwrap_or(Ok(()));
    if recorder_result.is_ok() {
        recorder.recorder.take();
    }

    let induction_result = recorder
        .induction
        .as_mut()
        .map(|child| stop_process(child, "workflow induction"))
        .unwrap_or(Ok(()));
    if induction_result.is_ok() {
        recorder.induction.take();
    }

    recorder_result.and(induction_result)
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RecorderProcesses::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_recording,
            stop_recording
        ])
        .on_window_event(|window, event| {
            if window.label() == "main"
                && matches!(event, tauri::WindowEvent::CloseRequested { .. })
            {
                if let Err(error) = stop_processes(&window.state::<RecorderProcesses>()) {
                    eprintln!("Failed to stop recording processes when closing the app: {error}");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
