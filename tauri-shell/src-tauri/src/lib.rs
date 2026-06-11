use std::fs::OpenOptions;
use std::io::Write;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[derive(serde::Serialize)]
struct SecureStorageConfig {
    #[serde(rename = "vaultPath")]
    vault_path: String,
    passphrase: String,
    #[serde(rename = "legacyPassphrases")]
    legacy_passphrases: Vec<String>,
    #[serde(rename = "recoveryVaultPath")]
    recovery_vault_path: String,
}

/// Write a message to the event log file in the data directory.
fn write_crash_log(app_data_dir: &std::path::Path, message: &str) {
    let log_path = app_data_dir.join("event.log");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let _ = writeln!(file, "[{}] {}", timestamp, message);
    }
}

/// Check if portable.marker exists next to the executable.
fn is_portable() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("portable.marker").exists()))
        .unwrap_or(false)
}

/// Resolve the data directory based on mode:
/// - Portable (portable.marker exists): {exe_parent}/data/
/// - Installed (no marker): appDataDir (%APPDATA%/com.woofychatty.app/)
fn resolve_data_dir(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    if is_portable() {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                return parent.join("data");
            }
        }
    }
    // Installed mode: use Tauri's appDataDir
    // NEVER fall back to a relative path — it would resolve against CWD
    // and land outside the Tauri fs scope (forbidden).
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| {
            // Last resort: use a known absolute path under user profile
            let home = std::env::var("APPDATA")
                .or_else(|_| std::env::var("HOME"))
                .unwrap_or_else(|_| ".".to_string());
            std::path::PathBuf::from(home).join("WoofyChatty").join("data")
        })
}

#[tauri::command]
fn get_data_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let data_dir = resolve_data_dir(&app_handle);
    data_dir
        .to_str()
        .map(|s| s.replace('\\', "/"))
        .ok_or_else(|| "Failed to convert data dir path to string".to_string())
}

fn get_or_create_vault_passphrase(data_dir: &std::path::Path) -> Result<String, String> {
    let key_path = data_dir.join("vault.key");
    let _ = std::fs::create_dir_all(data_dir);

    if key_path.exists() {
        let stored = std::fs::read_to_string(&key_path)
            .map_err(|e| format!("Failed to read vault.key: {}", e))?;
        if stored.len() >= 16 {
            return Ok(stored);
        }
    }

    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let passphrase = bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>();
    std::fs::write(&key_path, &passphrase)
        .map_err(|e| format!("Failed to write vault.key: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(passphrase)
}

fn base36(mut value: u64) -> String {
    if value == 0 {
        return "0".to_string();
    }

    let mut chars = Vec::new();
    while value > 0 {
        let digit = (value % 36) as u8;
        chars.push(match digit {
            0..=9 => (b'0' + digit) as char,
            _ => (b'a' + (digit - 10)) as char,
        });
        value /= 36;
    }
    chars.iter().rev().collect()
}

fn legacy_js_hash_passphrase(data_dir: &str) -> String {
    let mut hash: i32 = 0;
    for unit in data_dir.encode_utf16() {
        hash = hash
            .wrapping_shl(5)
            .wrapping_sub(hash)
            .wrapping_add(i32::from(unit));
    }

    let magnitude = if hash == i32::MIN {
        2_147_483_648_u64
    } else {
        i64::from(hash).abs() as u64
    };
    format!("dogechat-vault-{}", base36(magnitude))
}

#[tauri::command]
fn get_secure_storage_config(app_handle: tauri::AppHandle) -> Result<SecureStorageConfig, String> {
    let data_dir = resolve_data_dir(&app_handle);
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data dir: {}", e))?;
    let passphrase = get_or_create_vault_passphrase(&data_dir)?;
    let data_dir_string = data_dir
        .to_str()
        .map(|s| s.replace('\\', "/"))
        .ok_or_else(|| "Failed to convert data dir path to string".to_string())?;
    let legacy_passphrase = legacy_js_hash_passphrase(&data_dir_string);
    let legacy_passphrases = if legacy_passphrase == passphrase {
        Vec::new()
    } else {
        vec![legacy_passphrase]
    };
    let vault_path = data_dir.join("dogechat-vault.hold");
    let vault_path = vault_path
        .to_str()
        .map(|s| s.replace('\\', "/"))
        .ok_or_else(|| "Failed to convert vault path to string".to_string())?;
    let recovery_vault_path = data_dir.join("dogechat-vault-recovered.hold");
    let recovery_vault_path = recovery_vault_path
        .to_str()
        .map(|s| s.replace('\\', "/"))
        .ok_or_else(|| "Failed to convert recovery vault path to string".to_string())?;

    Ok(SecureStorageConfig {
        vault_path,
        passphrase,
        legacy_passphrases,
        recovery_vault_path,
    })
}

#[tauri::command]
fn log_crash(app_handle: tauri::AppHandle, level: String, message: String) {
    let data_dir = resolve_data_dir(&app_handle);
    let _ = std::fs::create_dir_all(&data_dir);
    let entry = format!("[JS:{}] {}", level, message);
    write_crash_log(&data_dir, &entry);
}

#[tauri::command]
fn is_portable_mode() -> bool {
    is_portable()
}

#[tauri::command]
fn open_data_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let data_dir = resolve_data_dir(&app_handle);
    let _ = std::fs::create_dir_all(&data_dir);
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    Ok(())
}

/// Read or generate a per-installation random salt for Stronghold key derivation.
fn get_or_create_salt(data_dir: &std::path::Path) -> Result<Vec<u8>, String> {
    let salt_path = data_dir.join("vault.salt");
    if salt_path.exists() {
        std::fs::read(&salt_path).map_err(|e| format!("Failed to read vault.salt: {}", e))
    } else {
        use rand::Rng;
        let salt: [u8; 16] = rand::thread_rng().gen();
        let _ = std::fs::create_dir_all(data_dir);
        std::fs::write(&salt_path, &salt)
            .map_err(|e| format!("Failed to write vault.salt: {}", e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&salt_path, std::fs::Permissions::from_mode(0o600));
        }
        Ok(salt.to_vec())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Portable mode: redirect WebView2 user data to {exe_dir}/data/webview2/
    // Must be set BEFORE Tauri/WebView2 initializes.
    let portable = is_portable();
    if portable {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                let webview_data = parent.join("data").join("webview2");
                if let Some(path_str) = webview_data.to_str() {
                    std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", path_str);
                }
            }
        }
    }

    // Set up panic hook to write to crash log
    // Resolve data dir early for the panic hook (before Tauri setup)
    let panic_data_dir = if portable {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("data")))
            .unwrap_or_else(|| {
                dirs::data_dir()
                    .unwrap_or_else(|| std::path::PathBuf::from("."))
                    .join("com.woofychatty.app")
            })
    } else {
        dirs::data_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("com.woofychatty.app")
    };

    let panic_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let _ = std::fs::create_dir_all(&panic_data_dir);
        let message = format!("PANIC: {}", info);
        write_crash_log(&panic_data_dir, &message);
        panic_hook(info);
    }));

    // Pre-resolve data dir and salt for Stronghold builder
    let stronghold_salt = {
        let data_dir = if portable {
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join("data")))
                .unwrap_or_else(|| {
                    dirs::data_dir()
                        .unwrap_or_else(|| std::path::PathBuf::from("."))
                        .join("com.woofychatty.app")
                })
        } else {
            dirs::data_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("com.woofychatty.app")
        };
        get_or_create_salt(&data_dir).unwrap_or_else(|e| {
            eprintln!("[setup] Failed to get/create vault salt: {e}, using fallback");
            b"dogechat-stronghold-salt".to_vec()
        })
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    // Restore size, position, maximized, fullscreen — but NOT visibility.
                    // Our close handler hides to tray, which causes window-state to
                    // save visible=false and never show the window on next launch.
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED
                        | tauri_plugin_window_state::StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_stronghold::Builder::new(move |password| {
            use argon2::{Argon2, Algorithm, Version, Params};
            let params = Params::new(10_000, 10, 4, Some(32))
                .unwrap_or_else(|e| panic!("argon2 params: {e}"));
            let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
            let mut key = vec![0u8; 32];
            argon2.hash_password_into(password.as_ref(), &stronghold_salt, &mut key)
                .unwrap_or_else(|e| panic!("argon2 hash: {e}"));
            key
        }).build())
        .invoke_handler(tauri::generate_handler![
            log_crash,
            get_data_dir,
            get_secure_storage_config,
            is_portable_mode,
            open_data_folder
        ])
        .setup(|app| {
            // Resolve the portable data directory and add it to the FS scope
            // so the @tauri-apps/plugin-fs can read/write there.
            let data_dir = resolve_data_dir(&app.handle());
            let _ = std::fs::create_dir_all(&data_dir);
            // Add to both the core FS scope and the plugin-fs scope
            if let Err(e) = app.fs_scope().allow_directory(&data_dir, true) {
                eprintln!("[setup] Failed to add data dir to core FS scope: {}", e);
            }
            // plugin-fs v2 has its own scope — use FsExt to add there too
            if let Some(fs_scope) = app.try_fs_scope() {
                if let Err(e) = fs_scope.allow_directory(&data_dir, true) {
                    eprintln!("[setup] Failed to add data dir to plugin FS scope: {}", e);
                }
            }
            write_crash_log(&data_dir, "APP_START: WoofyChatty starting up");

            // Enable devtools (F12) in production builds for debugging
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }

            // ---- System Tray ----
            let show =
                MenuItem::with_id(app, "show", "Show WoofyChatty", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap_or_else(|| {
                    tauri::image::Image::new(&[], 0, 0)
                }))
                .tooltip("WoofyChatty")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Safety timeout: force-show main window after 15 seconds
            // in case JS init fails before calling show()
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(15));
                if let Some(window) = app_handle.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(true) {
                        if let Ok(data_dir) = app_handle.path().app_data_dir() {
                            write_crash_log(
                                &data_dir,
                                "SAFETY_SHOW: Main window not visible after 15s — force-showing",
                            );
                        }
                        let _ = window.show();
                        let _ = window.set_focus();
                        // Close splash if still open
                        if let Some(splash) = app_handle.get_webview_window("splash") {
                            let _ = splash.close();
                        }
                    }
                }
            });

            Ok(())
        })
        // Default: closing the window quits the app.
        // TODO: add optional "minimize to tray on close" setting
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
