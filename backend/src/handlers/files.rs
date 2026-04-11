use std::path::PathBuf;

use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    errors::AppError,
    models::{FileDescriptor, FilesListResponse},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct FilesQuery {
    pub path: Option<String>,
}

pub async fn list_files(
    State(state): State<AppState>,
    Query(query): Query<FilesQuery>,
) -> Result<Json<FilesListResponse>, AppError> {
    tokio::fs::create_dir_all(&state.config.ftp_dir).await?;

    let relative = normalize_relative_path(query.path.as_deref().unwrap_or(""))?;
    let current_path = pathbuf_to_string(&relative);
    let target_dir = state.config.ftp_dir.join(&relative);

    let metadata = tokio::fs::metadata(&target_dir)
        .await
        .map_err(|_| AppError::not_found("directory not found"))?;

    if !metadata.is_dir() {
        return Err(AppError::bad_request("path must be a directory"));
    }

    let mut entries = tokio::fs::read_dir(&target_dir).await?;
    let mut files = Vec::new();

    while let Some(entry) = entries.next_entry().await? {
        let file_type = entry.file_type().await?;
        let metadata = entry.metadata().await?;
        let name = entry.file_name().to_string_lossy().to_string();

        let item_path = if current_path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", current_path, name)
        };

        files.push(FileDescriptor {
            name,
            path: item_path,
            size: if file_type.is_file() {
                metadata.len()
            } else {
                0
            },
            is_dir: file_type.is_dir(),
        });
    }

    files.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    let parent_path = relative.parent().and_then(|p| {
        let as_str = pathbuf_to_string(p);
        if as_str.is_empty() {
            Some(String::new())
        } else {
            Some(as_str)
        }
    });

    Ok(Json(FilesListResponse {
        status: "success",
        directory: "ftp",
        current_path,
        parent_path,
        files,
    }))
}

pub fn normalize_relative_path(input: &str) -> Result<PathBuf, AppError> {
    let mut normalized = PathBuf::new();
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Ok(normalized);
    }

    if trimmed.starts_with('/') || trimmed.starts_with('\\') {
        return Err(AppError::bad_request("absolute paths are not allowed"));
    }

    for part in trimmed.split(['/', '\\']) {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(AppError::bad_request("invalid path"));
        }

        if !part
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_' | ' ' | '(' | ')'))
        {
            return Err(AppError::bad_request("invalid path"));
        }

        normalized.push(part);
    }

    Ok(normalized)
}

pub fn pathbuf_to_string(path: &std::path::Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
