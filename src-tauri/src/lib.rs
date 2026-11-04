use std::{
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{Manager, State};

#[derive(Default)]
struct RecorderState(Mutex<Option<Child>>);

#[tauri::command]
fn start_recording(state: State<'_, RecorderState>) -> Result<(), String> {
    let mut recorder = state
        .0
        .lock()
        .map_err(|error| format!("Could not access recorder state: {error}"))?;

    if let Some(child) = recorder.as_mut() {
        if child
            .try_wait()
            .map_err(|error| format!("Could not check recorder status: {error}"))?
            .is_none()
        {
            return Err("Recording is already running.".to_string());
        }
        recorder.take();
    }

    let child = Command::new("crec")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            format!("Could not start `crec`: {error}. Ensure it is installed and available on the app's PATH.")
        })?;

    *recorder = Some(child);
    Ok(())
}

#[tauri::command]
fn stop_recording(state: State<'_, RecorderState>) -> Result<(), String> {
    stop_recorder(&state)
}

fn stop_recorder(state: &RecorderState) -> Result<(), String> {
    let mut recorder = state
        .0
        .lock()
        .map_err(|error| format!("Could not access recorder state: {error}"))?;

    let Some(child) = recorder.as_mut() else {
        return Ok(());
    };

    if child
        .try_wait()
        .map_err(|error| format!("Could not check recorder status: {error}"))?
        .is_none()
    {
        #[cfg(unix)]
        {
            let result = unsafe { libc::kill(child.id() as libc::pid_t, libc::SIGINT) };
            if result != 0 {
                return Err(format!(
                    "Could not send an interrupt to `crec`: {}",
                    std::io::Error::last_os_error()
                ));
            }
        }

        #[cfg(not(unix))]
        child
            .kill()
            .map_err(|error| format!("Could not stop `crec`: {error}"))?;

        child
            .wait()
            .map_err(|error| format!("Could not wait for `crec` to stop: {error}"))?;
    }

    recorder.take();
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RecorderState::default())
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
                if let Err(error) = stop_recorder(&window.state::<RecorderState>()) {
                    eprintln!("Failed to stop recorder when closing the app: {error}");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
