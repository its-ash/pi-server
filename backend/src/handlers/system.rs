use axum::Json;
use sysinfo::{CpuRefreshKind, RefreshKind, System};

use crate::models::SystemStatsResponse;

pub async fn system_stats() -> Json<SystemStatsResponse> {
    // First pass: seed CPU measurement
    let mut system = System::new_with_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(sysinfo::MemoryRefreshKind::everything()),
    );
    system.refresh_all();
    // sysinfo requires a short sleep between two refreshes for accurate CPU %
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    system.refresh_cpu_all();

    let cpu_usage_percent = {
        let cpus = system.cpus();
        if cpus.is_empty() {
            0.0
        } else {
            let sum: f32 = cpus.iter().map(|c| c.cpu_usage()).sum();
            (sum / cpus.len() as f32) as f64
        }
    };

    system.refresh_memory();
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
        cpu_usage_percent,
    })
}
