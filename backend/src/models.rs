use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub status: &'static str,
    pub filename: String,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct ApiPayloadField {
    pub name: &'static str,
    pub field_type: &'static str,
    pub required: bool,
    pub description: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ApiPayloadSpec {
    pub content_type: &'static str,
    pub fields: Vec<ApiPayloadField>,
}

#[derive(Debug, Serialize)]
pub struct ApiDescriptor {
    pub method: &'static str,
    pub path: &'static str,
    pub description: &'static str,
    pub payload: Option<ApiPayloadSpec>,
    pub response_example: Value,
}

#[derive(Debug, Serialize)]
pub struct ApiListResponse {
    pub status: &'static str,
    pub apis: Vec<ApiDescriptor>,
}

#[derive(Debug, Serialize)]
pub struct FileDescriptor {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
}

#[derive(Debug, Serialize)]
pub struct FilesListResponse {
    pub status: &'static str,
    pub directory: &'static str,
    pub current_path: String,
    pub parent_path: Option<String>,
    pub files: Vec<FileDescriptor>,
}

#[derive(Debug, Serialize)]
pub struct SystemStatsResponse {
    pub status: &'static str,
    pub process_count: u64,
    pub used_memory_kib: u64,
    pub total_memory_kib: u64,
    pub ram_usage_percent: f64,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub status: &'static str,
    pub error: String,
}
