use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use tokio::fs;

use crate::{errors::AppError, models::{ApkEntry, ApksResponse}, state::AppState};

pub async fn list_apps(State(state): State<AppState>) -> Result<Json<ApksResponse>, AppError> {
    fs::create_dir_all(&state.config.apps_dir).await?;

    let mut read_dir = fs::read_dir(&state.config.apps_dir).await?;
    let mut entries: Vec<(String, u64)> = Vec::new();

    while let Some(entry) = read_dir.next_entry().await? {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.to_lowercase().ends_with(".apk") {
            continue;
        }
        let meta = entry.metadata().await?;
        entries.push((name, meta.len()));
    }

    entries.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));

    let apps_dir = state.config.apps_dir.clone();
    let apps = tokio::task::spawn_blocking(move || {
        entries
            .into_iter()
            .map(|(filename, size)| {
                let path = apps_dir.join(&filename);
                let meta = crate::apk_meta::extract(&path);
                ApkEntry {
                    filename,
                    size,
                    app_name: meta.as_ref().and_then(|m| m.app_name.clone()),
                    app_icon_b64: meta.as_ref().and_then(|m| m.app_icon_b64.clone()),
                    app_icon_mime: meta.as_ref().and_then(|m| m.app_icon_mime.clone()),
                }
            })
            .collect::<Vec<_>>()
    })
    .await
    .map_err(|_| AppError::internal("apk parsing task failed"))?;

    Ok(Json(ApksResponse { status: "success", apps }))
}

#[derive(Deserialize)]
pub struct DownloadQuery {
    pub filename: String,
}

pub async fn download_app(
    State(state): State<AppState>,
    Query(params): Query<DownloadQuery>,
) -> Result<impl IntoResponse, AppError> {
    let safe: String = params
        .filename
        .chars()
        .filter(|&c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ' | '(' | ')'))
        .collect();
    let safe = safe.trim().to_string();

    if safe.is_empty() || !safe.to_lowercase().ends_with(".apk") {
        return Err(AppError::bad_request("invalid filename"));
    }

    let path = state.config.apps_dir.join(&safe);

    if !path.starts_with(&state.config.apps_dir) {
        return Err(AppError::bad_request("invalid path"));
    }

    if !tokio::fs::try_exists(&path).await? {
        return Err(AppError::not_found("app not found"));
    }

    let file = tokio::fs::File::open(&path).await?;
    let stream = tokio_util::io::ReaderStream::new(file);
    let body = axum::body::Body::from_stream(stream);

    let encoded = urlencoding_encode(&safe);
    let disposition = format!("attachment; filename=\"{safe}\"; filename*=UTF-8''{encoded}");

    Ok((
        [
            ("content-type", "application/vnd.android.package-archive".to_string()),
            ("content-disposition", disposition),
        ],
        body,
    ))
}

fn urlencoding_encode(s: &str) -> String {
    s.bytes()
        .flat_map(|b| {
            if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
                vec![b as char]
            } else {
                format!("%{:02X}", b).chars().collect()
            }
        })
        .collect()
}
