use axum::Json;
use serde_json::json;

use crate::models::{ApiDescriptor, ApiListResponse, ApiPayloadField, ApiPayloadSpec};

pub async fn list_apis() -> Json<ApiListResponse> {
    Json(ApiListResponse {
        status: "success",
        apis: vec![
            ApiDescriptor {
                method: "POST",
                path: "/api/upload",
                description: "Upload one file via multipart/form-data",
                payload: Some(ApiPayloadSpec {
                    content_type: "multipart/form-data",
                    fields: vec![
                        ApiPayloadField {
                            name: "file",
                            field_type: "binary",
                            required: true,
                            description: "Single file payload",
                        },
                        ApiPayloadField {
                            name: "filename",
                            field_type: "string",
                            required: false,
                            description: "Optional destination filename override",
                        },
                    ],
                }),
                response_example: json!({
                    "status": "success",
                    "filename": "saved_name.ext",
                    "size": 1024
                }),
            },
            ApiDescriptor {
                method: "GET",
                path: "/api/files?path=<folder>",
                description: "List files/folders from ftp/ at the provided relative path",
                payload: None,
                response_example: json!({
                    "status": "success",
                    "directory": "ftp",
                    "current_path": "movies",
                    "parent_path": "",
                    "files": [
                        { "name": "clips", "path": "movies/clips", "size": 0, "is_dir": true },
                        { "name": "intro.mp4", "path": "movies/intro.mp4", "size": 1234, "is_dir": false }
                    ]
                }),
            },
            ApiDescriptor {
                method: "GET",
                path: "/api/download?path=<file>",
                description: "Download a file from ftp/ as attachment",
                payload: None,
                response_example: json!({
                    "status": "binary_stream",
                    "content_disposition": "attachment; filename=example.txt"
                }),
            },
            ApiDescriptor {
                method: "GET",
                path: "/api/play?path=<file>",
                description: "Play/stream media inline from ftp/",
                payload: None,
                response_example: json!({
                    "status": "binary_stream",
                    "content_disposition": "inline; filename=video.mp4"
                }),
            },
            ApiDescriptor {
                method: "GET",
                path: "/api/system",
                description: "Get process count and RAM load",
                payload: None,
                response_example: json!({
                    "status": "success",
                    "process_count": 256,
                    "used_memory_kib": 1200000,
                    "total_memory_kib": 8000000,
                    "ram_usage_percent": 15.0
                }),
            },
            ApiDescriptor {
                method: "GET",
                path: "/api/apis",
                description: "List all available API endpoints",
                payload: None,
                response_example: json!({
                    "status": "success",
                    "apis": []
                }),
            },
        ],
    })
}
