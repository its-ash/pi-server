use std::io::SeekFrom;

use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::Response,
};
use serde::Deserialize;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use crate::{errors::AppError, handlers::files::normalize_relative_path, state::AppState};

#[derive(Debug, Deserialize)]
pub struct FilePathQuery {
    pub path: String,
}

#[derive(Debug, Clone, Copy)]
struct ByteRange {
    start: u64,
    end: u64,
}

impl ByteRange {
    fn len(self) -> u64 {
        self.end - self.start + 1
    }
}

pub async fn download_file(
    State(state): State<AppState>,
    Query(query): Query<FilePathQuery>,
    headers: HeaderMap,
) -> Result<Response<Body>, AppError> {
    let range_header = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok());

    stream_from_ftp(&state, &query.path, true, range_header, true).await
}

pub async fn media_file(
    State(state): State<AppState>,
    Query(query): Query<FilePathQuery>,
    headers: HeaderMap,
) -> Result<Response<Body>, AppError> {
    let range_header = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok());

    stream_from_ftp(&state, &query.path, false, range_header, true).await
}

async fn stream_from_ftp(
    state: &AppState,
    relative_path: &str,
    as_attachment: bool,
    range_header: Option<&str>,
    allow_range: bool,
) -> Result<Response<Body>, AppError> {
    let safe_rel = normalize_relative_path(relative_path)?;
    let file_path = state.config.ftp_dir.join(&safe_rel);

    // Canonicalize to resolve any symlinks and ensure the path is within ftp_dir.
    let canonical = tokio::fs::canonicalize(&file_path)
        .await
        .map_err(|_| AppError::not_found("file not found"))?;
    let canonical_root = tokio::fs::canonicalize(&state.config.ftp_dir)
        .await
        .map_err(|_| AppError::internal("ftp dir unavailable"))?;
    if !canonical.starts_with(&canonical_root) {
        return Err(AppError::bad_request("invalid path"));
    }

    let metadata = tokio::fs::metadata(&canonical)
        .await
        .map_err(|_| AppError::not_found("file not found"))?;

    if !metadata.is_file() {
        return Err(AppError::bad_request("path must be a file"));
    }

    let file_size = metadata.len();
    let parsed_range = if allow_range {
        parse_range_header(range_header, file_size)?
    } else {
        None
    };

    let mut file = tokio::fs::File::open(&canonical).await?;

    let (status, content_length, content_range, body) = if let Some(range) = parsed_range {
        file.seek(SeekFrom::Start(range.start)).await?;
        let limited = file.take(range.len());
        let stream = ReaderStream::new(limited);
        (
            StatusCode::PARTIAL_CONTENT,
            range.len(),
            Some(format!("bytes {}-{}/{}", range.start, range.end, file_size)),
            Body::from_stream(stream),
        )
    } else {
        let stream = ReaderStream::new(file);
        (StatusCode::OK, file_size, None, Body::from_stream(stream))
    };

    let mime = mime_guess::from_path(&canonical).first_or_octet_stream();
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

    let mut builder = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, disposition)
        .header(header::CONTENT_LENGTH, content_length.to_string());

    if allow_range {
        builder = builder.header(header::ACCEPT_RANGES, "bytes");
    }

    if let Some(content_range_value) = content_range {
        builder = builder.header(header::CONTENT_RANGE, content_range_value);
    }

    let response = builder
        .body(body)
        .map_err(|e| AppError::internal(e.to_string()))?;

    Ok(response)
}

fn parse_range_header(
    header_value: Option<&str>,
    file_size: u64,
) -> Result<Option<ByteRange>, AppError> {
    let Some(raw) = header_value else {
        return Ok(None);
    };

    if file_size == 0 {
        return Err(range_not_satisfiable());
    }

    let value = raw.trim();
    let bytes = value
        .strip_prefix("bytes=")
        .ok_or_else(range_not_satisfiable)?;

    if bytes.contains(',') {
        return Err(range_not_satisfiable());
    }

    let (start_part, end_part) = bytes.split_once('-').ok_or_else(range_not_satisfiable)?;

    if start_part.is_empty() {
        let suffix_len = end_part
            .parse::<u64>()
            .map_err(|_| range_not_satisfiable())?;

        if suffix_len == 0 {
            return Err(range_not_satisfiable());
        }

        let start = file_size.saturating_sub(suffix_len);
        let end = file_size - 1;
        return Ok(Some(ByteRange { start, end }));
    }

    let start = start_part
        .parse::<u64>()
        .map_err(|_| range_not_satisfiable())?;

    if start >= file_size {
        return Err(range_not_satisfiable());
    }

    let end = if end_part.is_empty() {
        file_size - 1
    } else {
        let requested_end = end_part
            .parse::<u64>()
            .map_err(|_| range_not_satisfiable())?;
        requested_end.min(file_size - 1)
    };

    if end < start {
        return Err(range_not_satisfiable());
    }

    Ok(Some(ByteRange { start, end }))
}

fn range_not_satisfiable() -> AppError {
    AppError::new(StatusCode::RANGE_NOT_SATISFIABLE, "invalid range header")
}
