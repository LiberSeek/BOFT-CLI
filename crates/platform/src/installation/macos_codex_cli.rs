//! Resolve the official Codex CLI inside a macOS Desktop bundle.
//!
//! Desktop 26.924 ships the CLI as a package at `Contents/Resources/codex-cli`:
//! `codex-package.json` names entrypoint `bin/codex`, and that wrapper executes
//! `CodexCLI.app/Contents/MacOS/codex`. Earlier Desktops keep a single Mach-O at
//! `Contents/Resources/codex`. The Shim executes the resolved Mach-O.

use std::fs;
use std::path::{Path, PathBuf};

use super::{canonical_macho_executable, canonical_unix_executable};
use crate::PlatformError;

const PACKAGE_DIRECTORY: &str = "Contents/Resources/codex-cli";
const LEGACY_CLI: &str = "Contents/Resources/codex";
const PACKAGE_MANIFEST: &str = "codex-package.json";
const PACKAGE_ENTRYPOINT: &str = "bin/codex";
const PACKAGE_EXECUTABLE: &str = "CodexCLI.app/Contents/MacOS/codex";
const PACKAGE_LAYOUT_VERSION: u64 = 1;
const MANIFEST_LIMIT: u64 = 64 * 1024;

pub(super) fn resolve_packaged_codex_cli(bundle: &Path) -> Result<PathBuf, PlatformError> {
    let bundle = bundle.canonicalize().map_err(|error| {
        PlatformError::NotFound(format!(
            "Codex App bundle '{}' is unavailable: {error}",
            bundle.display()
        ))
    })?;
    let package_root = bundle.join(PACKAGE_DIRECTORY);
    let manifest = package_root.join(PACKAGE_MANIFEST);
    if manifest.is_file() {
        return resolve_codex_cli_package(&bundle, &package_root, &manifest);
    }
    let cli = canonical_macho_executable(&bundle.join(LEGACY_CLI), "Codex CLI")?;
    ensure_inside(&bundle, &cli, "Codex CLI")?;
    Ok(cli)
}

fn resolve_codex_cli_package(
    bundle: &Path,
    package_root: &Path,
    manifest: &Path,
) -> Result<PathBuf, PlatformError> {
    let package_root = package_root.canonicalize().map_err(|error| {
        PlatformError::NotFound(format!(
            "Codex CLI package '{}' is unavailable: {error}",
            package_root.display()
        ))
    })?;
    ensure_inside(bundle, &package_root, "Codex CLI package")?;
    let text = read_manifest(manifest)?;
    let layout_version = json_u64_field(&text, "layoutVersion").map_err(|error| {
        PlatformError::Invalid(format!(
            "Codex CLI package manifest '{}' is invalid: {error}",
            manifest.display()
        ))
    })?;
    if layout_version != PACKAGE_LAYOUT_VERSION {
        return Err(PlatformError::Invalid(format!(
            "Codex CLI package '{}' has unsupported layoutVersion {layout_version}",
            package_root.display()
        )));
    }
    let entrypoint = json_string_field(&text, "entrypoint").map_err(|error| {
        PlatformError::Invalid(format!(
            "Codex CLI package manifest '{}' is invalid: {error}",
            manifest.display()
        ))
    })?;
    if entrypoint != PACKAGE_ENTRYPOINT {
        return Err(PlatformError::Invalid(format!(
            "Codex CLI package '{}' has unsupported entrypoint '{entrypoint}'",
            package_root.display()
        )));
    }

    let entrypoint = canonical_unix_executable(
        &package_root.join(PACKAGE_ENTRYPOINT),
        "Codex CLI entrypoint",
    )?;
    ensure_inside(&package_root, &entrypoint, "Codex CLI entrypoint")?;
    let executable =
        canonical_macho_executable(&package_root.join(PACKAGE_EXECUTABLE), "Codex CLI")?;
    ensure_inside(bundle, &executable, "Codex CLI")?;
    Ok(executable)
}

fn read_manifest(path: &Path) -> Result<String, PlatformError> {
    let metadata = path.metadata().map_err(|error| {
        PlatformError::NotFound(format!(
            "Codex CLI package manifest '{}' is unavailable: {error}",
            path.display()
        ))
    })?;
    if !metadata.is_file() || metadata.len() > MANIFEST_LIMIT {
        return Err(PlatformError::Invalid(format!(
            "Codex CLI package manifest '{}' is not a readable package manifest",
            path.display()
        )));
    }
    fs::read_to_string(path).map_err(|error| {
        PlatformError::Invalid(format!(
            "Codex CLI package manifest '{}' is invalid: {error}",
            path.display()
        ))
    })
}

fn json_string_field(text: &str, key: &str) -> Result<String, String> {
    let value = json_field(text, key)?;
    let value = value
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .ok_or_else(|| format!("'{key}' is not a string"))?;
    if value.contains('\\') {
        return Err(format!("'{key}' contains an unsupported escape"));
    }
    Ok(value.to_owned())
}

fn json_u64_field(text: &str, key: &str) -> Result<u64, String> {
    let value = json_field(text, key)?;
    value
        .parse()
        .map_err(|_| format!("'{key}' is not an integer"))
}

fn json_field<'a>(text: &'a str, key: &str) -> Result<&'a str, String> {
    let pattern = format!("\"{key}\"");
    let Some(start) = text.find(&pattern) else {
        return Err(format!("missing '{key}'"));
    };
    let rest = text[start + pattern.len()..].trim_start();
    let rest = rest
        .strip_prefix(':')
        .ok_or_else(|| format!("'{key}' has no value"))?
        .trim_start();
    if let Some(value) = rest.strip_prefix('"') {
        let end = value
            .find('"')
            .ok_or_else(|| format!("'{key}' is not a string"))?;
        return Ok(&rest[..=end + 1]);
    }
    let end = rest
        .find(|character: char| !character.is_ascii_digit())
        .unwrap_or(rest.len());
    if end == 0 {
        return Err(format!("'{key}' has no value"));
    }
    Ok(&rest[..end])
}

fn ensure_inside(root: &Path, path: &Path, label: &str) -> Result<(), PlatformError> {
    if path.starts_with(root) {
        return Ok(());
    }
    Err(PlatformError::Invalid(format!(
        "{label} '{}' resolves outside '{}'",
        path.display(),
        root.display()
    )))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::os::unix::fs::{PermissionsExt, symlink};

    use super::resolve_packaged_codex_cli;
    use crate::temporary_directory;

    fn executable(path: &std::path::Path, bytes: &[u8]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent");
        }
        fs::write(path, bytes).expect("write executable");
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).expect("mark executable");
    }

    fn macho(path: &std::path::Path) {
        executable(path, &[0xcf, 0xfa, 0xed, 0xfe]);
    }

    fn package(bundle: &std::path::Path, manifest: &str) {
        let root = bundle.join("Contents/Resources/codex-cli");
        fs::create_dir_all(&root).expect("create package");
        fs::write(root.join("codex-package.json"), manifest).expect("write manifest");
        executable(&root.join("bin/codex"), b"#!/bin/sh\nexit 0\n");
        macho(&root.join("CodexCLI.app/Contents/MacOS/codex"));
    }

    #[test]
    fn resolves_the_packaged_mach_o_inside_the_bundle() {
        let bundle = temporary_directory("codexhost-codex-cli").join("ChatGPT.app");
        package(&bundle, r#"{"layoutVersion":1,"entrypoint":"bin/codex"}"#);
        let cli = resolve_packaged_codex_cli(&bundle).expect("packaged cli");
        assert_eq!(
            cli,
            bundle
                .join("Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex")
                .canonicalize()
                .expect("canonical cli")
        );
        fs::remove_dir_all(bundle.parent().expect("temp root")).expect("cleanup");
    }

    #[test]
    fn prefers_a_valid_package_over_the_legacy_cli() {
        let bundle = temporary_directory("codexhost-codex-cli").join("ChatGPT.app");
        macho(&bundle.join("Contents/Resources/codex"));
        package(
            &bundle,
            r#"{"layoutVersion": 1, "entrypoint": "bin/codex"}"#,
        );
        let cli = resolve_packaged_codex_cli(&bundle).expect("packaged cli");
        assert!(cli.ends_with("CodexCLI.app/Contents/MacOS/codex"));
        fs::remove_dir_all(bundle.parent().expect("temp root")).expect("cleanup");
    }

    #[test]
    fn keeps_the_legacy_cli_when_the_package_manifest_is_absent() {
        let bundle = temporary_directory("codexhost-codex-cli").join("ChatGPT.app");
        macho(&bundle.join("Contents/Resources/codex"));
        let cli = resolve_packaged_codex_cli(&bundle).expect("legacy cli");
        assert!(cli.ends_with("Contents/Resources/codex"));
        fs::remove_dir_all(bundle.parent().expect("temp root")).expect("cleanup");
    }

    #[test]
    fn rejects_an_unsupported_package_without_using_the_legacy_cli() {
        let bundle = temporary_directory("codexhost-codex-cli").join("ChatGPT.app");
        macho(&bundle.join("Contents/Resources/codex"));
        package(&bundle, r#"{"layoutVersion":2,"entrypoint":"bin/codex"}"#);
        let error = resolve_packaged_codex_cli(&bundle).expect_err("unsupported layout");
        assert!(error.to_string().contains("unsupported layoutVersion 2"));
        fs::remove_dir_all(bundle.parent().expect("temp root")).expect("cleanup");
    }

    #[test]
    fn rejects_a_packaged_cli_symlink_outside_the_bundle() {
        let root = temporary_directory("codexhost-codex-cli");
        let bundle = root.join("ChatGPT.app");
        package(&bundle, r#"{"layoutVersion":1,"entrypoint":"bin/codex"}"#);
        let external = root.join("external-codex");
        macho(&external);
        let packaged =
            bundle.join("Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex");
        fs::remove_file(&packaged).expect("remove packaged cli");
        symlink(&external, &packaged).expect("link external cli");
        assert!(resolve_packaged_codex_cli(&bundle).is_err());
        fs::remove_dir_all(root).expect("cleanup");
    }
}
