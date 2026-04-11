use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderValue, StatusCode},
    response::Response,
};
use serde::Deserialize;
use tokio_util::io::ReaderStream;

use crate::{errors::AppError, handlers::files::normalize_relative_path, state::AppState};

#[derive(Debug, Deserialize)]
pub struct FilePathQuery {
    pub path: String,
}

pub async fn download_file(
    State(state): State<AppState>,
    Query(query): Query<FilePathQuery>,
) -> Result<Response<Body>, AppError> {
    stream_from_ftp(&state, &query.path, true).await
}

pub async fn media_file(
    State(state): State<AppState>,
    Query(query): Query<FilePathQuery>,
) -> Result<Response<Body>, AppError> {
    stream_from_ftp(&state, &query.path, false).await
}

async fn stream_from_ftp(
    state: &AppState,
    relative_path: &str,
    as_attachment: bool,
) -> Result<Response<Body>, AppError> {
    let safe_rel = normalize_relative_path(relative_path)?;
    let file_path = state.config.ftp_dir.join(&safe_rel);

    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|_| AppError::not_found("file not found"))?;

    if !metadata.is_file() {
        return Err(AppError::bad_request("path must be a file"));
    }

    let file = tokio::fs::File::open(&file_path).await?;
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
    let content_type = HeaderValue::from_str(mime.as_ref())
        .map_err(|_| AppError::new(StatusCode::INTERNAL_SERVER_ERROR, "invalid content type"))?;

    let fallback_name = file_path
        .file_name()
        .map(|v| v.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());

    let disposition_value = if as_attachment {
        format!("attachment; filename=\"{}\"", fallback_name)
    } else {
        format!("inline; filename=\"{}\"", fallback_name)
    };

    let disposition = HeaderValue::from_str(&disposition_value)
        .map_err(|_| AppError::bad_request("invalid filename"))?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, disposition)
        .body(body)
        .map_err(|e| AppError::internal(e.to_string()))?;

    Ok(response)
}
