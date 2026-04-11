mod config;
mod errors;
mod handlers;
mod models;
mod state;

use axum::{
    extract::DefaultBodyLimit,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use state::AppState;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::models::ErrorResponse;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::AppConfig::from_env();

    tokio::fs::create_dir_all(&config.upload_dir)
        .await
        .expect("failed to create upload dir");
    tokio::fs::create_dir_all(&config.ftp_dir)
        .await
        .expect("failed to create ftp dir");

    let app_state = AppState { config };

    let app = Router::new()
        .route("/upload", post(handlers::upload::upload_file))
        .route("/files", get(handlers::files::list_files))
        .route("/download", get(handlers::download::download_file))
        .route("/media", get(handlers::download::media_file))
        .route("/system", get(handlers::system::system_stats))
        .route("/apis", get(handlers::api::list_apis))
        .layer(DefaultBodyLimit::disable())
        .fallback(not_found)
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("failed to bind server");

    tracing::info!("backend listening on http://0.0.0.0:8080");

    axum::serve(listener, app)
        .await
        .expect("server exited unexpectedly");
}

async fn not_found() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorResponse {
            status: "error",
            error: "endpoint not found".to_string(),
        }),
    )
}
