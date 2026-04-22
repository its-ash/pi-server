use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub upload_dir: PathBuf,
    pub ftp_dir: PathBuf,
    pub apps_dir: PathBuf,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let project_root = detect_project_root();

        let upload_dir = std::env::var("UPLOAD_DIR")
            .map(|path| project_root.join(path))
            .unwrap_or_else(|_| project_root.join("../files"));


        let ftp_dir = std::env::var("FTP_DIR")
            .map(|path| project_root.join(path))
            .unwrap_or_else(|_| project_root.join("../ftp"));

        let apps_dir = std::env::var("APPS_DIR")
            .map(|path| project_root.join(path))
            .unwrap_or_else(|_| project_root.join("../apps"));

        Self {
            upload_dir,
            ftp_dir,
            apps_dir,
        }
    }
}

fn detect_project_root() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    for ancestor in cwd.ancestors() {
        if is_project_root(ancestor) {
            return ancestor.to_path_buf();
        }
    }

    cwd
}

fn is_project_root(path: &Path) -> bool {
    path.join("docker-compose.yml").exists() && path.join("backend").is_dir()
}
