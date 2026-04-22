use std::{
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::{Multipart, State},
    Json,
};
use tokio::io::AsyncWriteExt;

use crate::{errors::AppError, models::UploadResponse, state::AppState};

pub async fn upload_file(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    tokio::fs::create_dir_all(&state.config.upload_dir).await?;

    let mut custom_filename: Option<String> = None;
    let mut original_filename: Option<String> = None;
    let mut temp_path = None;
    let mut total_size: u64 = 0;
    let mut file_count = 0_u8;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(format!("invalid multipart body: {e}")))?
    {
        match field.name() {
            Some("filename") => {
                if custom_filename.is_some() {
                    cleanup_temp(&temp_path).await;
                    return Err(AppError::bad_request("filename field must appear once"));
                }

                let value = field
                    .text()
                    .await
                    .map_err(|e| AppError::bad_request(format!("invalid filename field: {e}")))?;
                let sanitized = sanitize_filename(&value);
                if sanitized.is_empty() {
                    cleanup_temp(&temp_path).await;
                    return Err(AppError::bad_request("filename cannot be empty"));
                }

                custom_filename = Some(sanitized);
            }
            Some("file") => {
                file_count += 1;
                if file_count > 1 {
                    cleanup_temp(&temp_path).await;
                    return Err(AppError::bad_request(
                        "only one file is allowed per request",
                    ));
                }

                original_filename = field
                    .file_name()
                    .map(sanitize_filename)
                    .filter(|v| !v.is_empty());

                let tmp_name = format!(
                    ".upload_{}_{}",
                    std::process::id(),
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_nanos())
                        .unwrap_or_default()
                );
                let tmp_path = state.config.upload_dir.join(tmp_name);
                let mut output = tokio::fs::File::create(&tmp_path).await?;

                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|e| AppError::bad_request(format!("invalid file stream: {e}")))?
                {
                    output.write_all(&chunk).await?;
                    total_size += chunk.len() as u64;
                }

                output.flush().await?;
                temp_path = Some(tmp_path);
            }
            _ => {}
        }
    }

    if file_count == 0 {
        cleanup_temp(&temp_path).await;
        return Err(AppError::bad_request("file field is required"));
    }

    let requested_name = custom_filename.or(original_filename).ok_or_else(|| {
        AppError::bad_request("filename is missing and uploaded file has no original name")
    })?;

    let final_name = next_available_name(&state.config.upload_dir, &requested_name).await?;
    let final_path = state.config.upload_dir.join(&final_name);

    if let Some(tmp) = temp_path {
        tokio::fs::rename(&tmp, &final_path).await?;
    }

    let apk_meta = if final_name.to_lowercase().ends_with(".apk") {
        let path = final_path.clone();
        tokio::task::spawn_blocking(move || {
            crate::apk_meta::extract(&path).map(|m| crate::models::ApkMeta {
                app_name: m.app_name,
                app_icon_b64: m.app_icon_b64,
                app_icon_mime: m.app_icon_mime,
            })
        })
        .await
        .ok()
        .flatten()
    } else {
        None
    };

    Ok(Json(UploadResponse {
        status: "success",
        filename: final_name,
        size: total_size,
        apk_meta,
    }))
}

async fn next_available_name(dir: &Path, preferred: &str) -> Result<String, AppError> {
    let preferred = sanitize_filename(preferred);
    if preferred.is_empty() {
        return Err(AppError::bad_request("invalid filename"));
    }

    let candidate_path = dir.join(&preferred);
    if tokio::fs::try_exists(&candidate_path).await? == false {
        return Ok(preferred);
    }

    let (stem, ext) = split_filename(&preferred);
    let mut index = 1_u32;

    loop {
        let candidate = if ext.is_empty() {
            format!("{}({})", stem, index)
        } else {
            format!("{}({}).{}", stem, index, ext)
        };

        let candidate_path = dir.join(&candidate);
        if tokio::fs::try_exists(&candidate_path).await? == false {
            return Ok(candidate);
        }

        index += 1;
    }
}

fn split_filename(name: &str) -> (String, String) {
    match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() && !ext.is_empty() => {
            (stem.to_string(), ext.to_string())
        }
        _ => (name.to_string(), String::new()),
    }
}

fn sanitize_filename(input: &str) -> String {
    let filtered: String = input
        .chars()
        .filter_map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_' | ' ' | '(' | ')') {
                Some(ch)
            } else {
                None
            }
        })
        .collect();

    filtered.trim().trim_matches('.').to_string()
}

async fn cleanup_temp(path: &Option<std::path::PathBuf>) {
    if let Some(path) = path {
        let _ = tokio::fs::remove_file(path).await;
    }
}
