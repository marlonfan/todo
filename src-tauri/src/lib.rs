#[cfg(not(target_os = "android"))]
mod token_store {
    use keyring::Entry;

    const SERVICE: &str = "life.marlon.todo";
    const ACCOUNT: &str = "auth_token";

    pub fn get_token() -> Option<String> {
        Entry::new(SERVICE, ACCOUNT)
            .ok()
            .and_then(|e| e.get_password().ok())
    }

    pub fn set_token(token: String) -> Result<(), String> {
        Entry::new(SERVICE, ACCOUNT)
            .map_err(|e| e.to_string())?
            .set_password(&token)
            .map_err(|e| e.to_string())
    }

    pub fn remove_token() -> Result<(), String> {
        let entry = Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            // 不存在也视为成功
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[cfg(target_os = "android")]
mod token_store {
    use std::{fs, path::PathBuf};
    use tauri::{AppHandle, Manager};

    const TOKEN_FILE: &str = "auth_token";

    fn token_path(app: &AppHandle) -> Result<PathBuf, String> {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir.join(TOKEN_FILE))
    }

    pub fn get_token(app: AppHandle) -> Option<String> {
        let path = token_path(&app).ok()?;
        fs::read_to_string(path).ok().map(|token| token.trim().to_string())
    }

    pub fn set_token(app: AppHandle, token: String) -> Result<(), String> {
        let path = token_path(&app)?;
        fs::write(path, token).map_err(|e| e.to_string())
    }

    pub fn remove_token(app: AppHandle) -> Result<(), String> {
        let path = token_path(&app)?;
        match fs::remove_file(path) {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn get_token() -> Option<String> {
    token_store::get_token()
}

#[cfg(target_os = "android")]
#[tauri::command]
fn get_token(app: tauri::AppHandle) -> Option<String> {
    token_store::get_token(app)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn set_token(token: String) -> Result<(), String> {
    token_store::set_token(token)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn set_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    token_store::set_token(app, token)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn remove_token() -> Result<(), String> {
    token_store::remove_token()
}

#[cfg(target_os = "android")]
#[tauri::command]
fn remove_token(app: tauri::AppHandle) -> Result<(), String> {
    token_store::remove_token(app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_token, set_token, remove_token])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
