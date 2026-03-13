use keyring::Entry;

const SERVICE: &str = "life.marlon.todo";
const ACCOUNT: &str = "auth_token";

#[tauri::command]
fn get_token() -> Option<String> {
    Entry::new(SERVICE, ACCOUNT)
        .ok()
        .and_then(|e| e.get_password().ok())
}

#[tauri::command]
fn set_token(token: String) -> Result<(), String> {
    Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&token)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        // 不存在也视为成功
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_token, set_token, remove_token])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
