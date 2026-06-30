use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

fn main() {
    println!("cargo:rerun-if-changed=../../Cargo.toml");
    println!("cargo:rerun-if-changed=../../Cargo.lock");
    println!("cargo:rerun-if-env-changed=SKIP_FRONTEND");
    println!("cargo:rerun-if-env-changed=MC_TRACKER_EMBED_BUILD");
    println!("cargo:rerun-if-changed=../../www/package.json");
    println!("cargo:rerun-if-changed=../../www/bun.lock");
    println!("cargo:rerun-if-changed=../../www/vite.config.ts");
    println!("cargo:rerun-if-changed=../../www/src");
    println!("cargo:rerun-if-changed=../../www/public");

    let www_dir = Path::new("../../www");
    let client_dir = www_dir.join("dist/client");
    let shell = client_dir.join("_shell.html");

    if std::env::var("SKIP_FRONTEND").ok().as_deref() == Some("1") {
        ensure_minimal_frontend(&client_dir, &shell);
        return;
    }

    if shell.exists() && !frontend_inputs_newer_than(&shell) {
        return;
    }

    run_bun_install_if_needed(www_dir);

    let mut command = Command::new("bun");
    command.args(["run", "build"]).current_dir(www_dir);

    command.env("MC_TRACKER_EMBED_BUILD", "1");
    command.env("VITE_MC_TRACKER_API_URL", "");
    command.env("VITE_MC_TRACKER_UI_BASEPATH", "/ui");

    let status = command
        .status()
        .unwrap_or_else(|err| panic!("failed to run bun: {err}"));

    if !status.success() {
        panic!("bun run build failed with {status}");
    }
}

fn run_bun_install_if_needed(www_dir: &Path) {
    let node_modules = www_dir.join("node_modules");
    let package_json = www_dir.join("package.json");
    let bun_lock = www_dir.join("bun.lock");

    let needs_install = !node_modules.exists()
        || mtime(&package_json) > mtime(&node_modules)
        || mtime(&bun_lock) > mtime(&node_modules);

    if needs_install {
        let status = Command::new("bun")
            .args(["install", "--frozen-lockfile"])
            .current_dir(www_dir)
            .status()
            .unwrap_or_else(|err| panic!("failed to run bun install: {err}"));

        if !status.success() {
            panic!("bun install failed with {status}");
        }
    }
}

fn frontend_inputs_newer_than(artifact: &Path) -> bool {
    let artifact_mtime = mtime(artifact);
    let roots = [
        PathBuf::from("../../www/package.json"),
        PathBuf::from("../../www/bun.lock"),
        PathBuf::from("../../www/vite.config.ts"),
        PathBuf::from("../../www/src"),
        PathBuf::from("../../www/public"),
    ];

    roots.iter().any(|path| newest_mtime(path) > artifact_mtime)
}

fn newest_mtime(path: &Path) -> SystemTime {
    if path.is_dir() {
        fs::read_dir(path)
            .ok()
            .into_iter()
            .flatten()
            .filter_map(|entry| entry.ok())
            .map(|entry| newest_mtime(&entry.path()))
            .max()
            .unwrap_or(SystemTime::UNIX_EPOCH)
    } else {
        mtime(path)
    }
}

fn mtime(path: &Path) -> SystemTime {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
}

fn ensure_minimal_frontend(client_dir: &Path, shell: &Path) {
    fs::create_dir_all(client_dir).expect("create www/dist/client for SKIP_FRONTEND");
    if !shell.exists() {
        fs::write(
            shell,
            "<!doctype html><title>mc-tracker</title><body>UI build skipped</body>",
        )
        .expect("write minimal www/dist/client/_shell.html");
    }
}
