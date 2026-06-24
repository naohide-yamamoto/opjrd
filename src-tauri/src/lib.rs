use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use base64::{engine::general_purpose, Engine as _};

#[cfg(target_os = "macos")]
use tauri::menu::{
    AboutMetadata, Menu, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
};

#[cfg(target_os = "macos")]
const FULL_APP_NAME: &str = "Object Placement and Judgement of Relative Direction Program (OPJRD)";

#[cfg(target_os = "macos")]
fn macos_app_menu(app_handle: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let version = app_handle.package_info().version.to_string();
    let about_metadata = AboutMetadata {
        name: Some(FULL_APP_NAME.to_string()),
        version: Some(version),
        copyright: Some("Copyright \u{00a9} 2026 Naohide Yamamoto".to_string()),
        ..Default::default()
    };

    let app_menu = Submenu::with_items(
        app_handle,
        "OPJRD",
        true,
        &[
            &PredefinedMenuItem::about(app_handle, None, Some(about_metadata))?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::services(app_handle, None)?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::hide(app_handle, None)?,
            &PredefinedMenuItem::hide_others(app_handle, None)?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::quit(app_handle, None)?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app_handle,
        "File",
        true,
        &[&PredefinedMenuItem::close_window(app_handle, None)?],
    )?;

    let edit_menu = Submenu::with_items(
        app_handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app_handle, None)?,
            &PredefinedMenuItem::redo(app_handle, None)?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::cut(app_handle, None)?,
            &PredefinedMenuItem::copy(app_handle, None)?,
            &PredefinedMenuItem::paste(app_handle, None)?,
            &PredefinedMenuItem::select_all(app_handle, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app_handle,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(app_handle, None)?],
    )?;

    let window_menu = Submenu::with_id_and_items(
        app_handle,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app_handle, None)?,
            &PredefinedMenuItem::maximize(app_handle, None)?,
        ],
    )?;

    let help_menu = Submenu::with_id_and_items(app_handle, HELP_SUBMENU_ID, "Help", true, &[])?;

    Menu::with_items(
        app_handle,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )
}

fn canonical_config_path(config_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(config_path)
        .canonicalize()
        .map_err(|error| format!("Could not resolve experiment config path: {error}"))?;

    if !path.is_file() {
        return Err("Experiment config path must point to a file.".into());
    }

    Ok(path)
}

fn config_folder_from_config_path(config_path: &Path) -> Result<PathBuf, String> {
    config_path
        .parent()
        .ok_or_else(|| "Could not resolve experiment config folder.".to_string())?
        .canonicalize()
        .map_err(|error| format!("Could not resolve experiment config folder: {error}"))
}

fn canonical_experiment_config_folder(config_path: &str) -> Result<PathBuf, String> {
    let config_path = canonical_config_path(config_path)?;
    config_folder_from_config_path(&config_path)
}

fn canonical_experiment_folder_path(folder_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder_path)
        .canonicalize()
        .map_err(|error| format!("Could not resolve experiment config folder: {error}"))?;

    if !path.is_dir() {
        return Err("Experiment config folder path must point to a folder.".into());
    }

    Ok(path)
}

fn resolve_relative_experiment_file_path(
    base_dir: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let relative_path = Path::new(relative_path);

    if relative_path.is_absolute() {
        return Err(
            "Experiment file paths must be relative to the experiment config folder.".into(),
        );
    }
    if relative_path
        .components()
        .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)))
    {
        return Err("Experiment file paths must stay inside the config folder.".into());
    }

    let target_path = base_dir
        .join(relative_path)
        .canonicalize()
        .map_err(|error| format!("Could not resolve experiment file path: {error}"))?;

    if !target_path.starts_with(base_dir) {
        return Err("Experiment file paths must stay inside the config folder.".into());
    }
    if !target_path.is_file() {
        return Err("Experiment file path must point to a file.".into());
    }

    Ok(target_path)
}

fn resolve_experiment_file_path(
    config_path: &str,
    relative_path: Option<&str>,
) -> Result<PathBuf, String> {
    let config_path = canonical_config_path(config_path)?;
    let Some(relative_path) = relative_path.filter(|path| !path.trim().is_empty()) else {
        return Ok(config_path);
    };

    let base_dir = config_folder_from_config_path(&config_path)?;
    resolve_relative_experiment_file_path(&base_dir, relative_path)
}

#[tauri::command]
fn read_experiment_text_file(
    config_path: String,
    relative_path: Option<String>,
) -> Result<String, String> {
    let path = resolve_experiment_file_path(&config_path, relative_path.as_deref())?;
    fs::read_to_string(path).map_err(|error| format!("Could not read experiment file: {error}"))
}

fn image_mime_type(path: &Path) -> Result<&'static str, String> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("svg") => Ok("image/svg+xml"),
        Some("png") => Ok("image/png"),
        Some("jpg") | Some("jpeg") => Ok("image/jpeg"),
        Some("webp") => Ok("image/webp"),
        Some("gif") => Ok("image/gif"),
        Some("bmp") => Ok("image/bmp"),
        _ => Err("Experiment asset path must point to a supported image file.".into()),
    }
}

fn validate_csv_file_extension(path: &Path) -> Result<(), String> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("csv") => Ok(()),
        _ => Err("Experiment data path must point to a CSV file.".into()),
    }
}

fn relative_path_inside_base(base_dir: &Path, file_path: &str) -> Result<String, String> {
    let target_path = PathBuf::from(file_path)
        .canonicalize()
        .map_err(|error| format!("Could not resolve selected file path: {error}"))?;

    if !target_path.starts_with(base_dir) {
        return Err("Selected image must be inside the experiment config folder.".into());
    }
    if !target_path.is_file() {
        return Err("Selected image path must point to a file.".into());
    }
    image_mime_type(&target_path)?;

    let relative = target_path
        .strip_prefix(base_dir)
        .map_err(|error| format!("Could not calculate relative image path: {error}"))?;
    let mut parts = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => {
                let Some(part) = part.to_str() else {
                    return Err("Selected image path must be valid Unicode.".into());
                };
                parts.push(part.to_string());
            }
            _ => return Err("Selected image path must stay inside the config folder.".into()),
        }
    }

    Ok(parts.join("/"))
}

fn relative_experiment_path(config_path: &str, file_path: &str) -> Result<String, String> {
    let base_dir = canonical_experiment_config_folder(config_path)?;
    relative_path_inside_base(&base_dir, file_path)
}

#[tauri::command]
fn relative_experiment_file_path(config_path: String, file_path: String) -> Result<String, String> {
    relative_experiment_path(&config_path, &file_path)
}

#[tauri::command]
fn relative_experiment_folder_file_path(
    folder_path: String,
    file_path: String,
) -> Result<String, String> {
    let base_dir = canonical_experiment_folder_path(&folder_path)?;
    relative_path_inside_base(&base_dir, &file_path)
}

#[tauri::command]
fn validate_experiment_asset_file(
    config_path: String,
    relative_path: String,
) -> Result<(), String> {
    let path = resolve_experiment_file_path(&config_path, Some(&relative_path))?;
    image_mime_type(&path)?;

    Ok(())
}

#[tauri::command]
fn validate_experiment_data_file(config_path: String, relative_path: String) -> Result<(), String> {
    let path = resolve_experiment_file_path(&config_path, Some(&relative_path))?;
    validate_csv_file_extension(&path)?;

    Ok(())
}

#[tauri::command]
fn validate_experiment_folder_asset_file(
    folder_path: String,
    relative_path: String,
) -> Result<(), String> {
    let base_dir = canonical_experiment_folder_path(&folder_path)?;
    let path = resolve_relative_experiment_file_path(&base_dir, &relative_path)?;
    image_mime_type(&path)?;

    Ok(())
}

#[tauri::command]
fn validate_experiment_folder_data_file(
    folder_path: String,
    relative_path: String,
) -> Result<(), String> {
    let base_dir = canonical_experiment_folder_path(&folder_path)?;
    let path = resolve_relative_experiment_file_path(&base_dir, &relative_path)?;
    validate_csv_file_extension(&path)?;

    Ok(())
}

#[tauri::command]
fn read_experiment_asset_file(
    config_path: String,
    relative_path: String,
) -> Result<String, String> {
    let path = resolve_experiment_file_path(&config_path, Some(&relative_path))?;
    let mime_type = image_mime_type(&path)?;
    let bytes =
        fs::read(path).map_err(|error| format!("Could not read experiment asset: {error}"))?;
    let encoded = general_purpose::STANDARD.encode(bytes);

    Ok(format!("data:{mime_type};base64,{encoded}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(target_os = "macos")]
    let builder = builder.menu(macos_app_menu);

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_experiment_text_file,
            relative_experiment_file_path,
            relative_experiment_folder_file_path,
            validate_experiment_asset_file,
            validate_experiment_data_file,
            validate_experiment_folder_asset_file,
            validate_experiment_folder_data_file,
            read_experiment_asset_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running OPJRD");
}
