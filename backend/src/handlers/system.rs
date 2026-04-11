use axum::Json;
use sysinfo::System;

use crate::models::SystemStatsResponse;

pub async fn system_stats() -> Json<SystemStatsResponse> {
    let mut system = System::new_all();
    system.refresh_all();

    let process_count = system.processes().len() as u64;
    let total_memory_kib = system.total_memory();
    let used_memory_kib = system.used_memory();

    let ram_usage_percent = if total_memory_kib == 0 {
        0.0
    } else {
        (used_memory_kib as f64 / total_memory_kib as f64) * 100.0
    };

    Json(SystemStatsResponse {
        status: "success",
        process_count,
        used_memory_kib,
        total_memory_kib,
        ram_usage_percent,
    })
}
