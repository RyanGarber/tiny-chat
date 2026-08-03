use crate::Error;
use crate::utils::should_include_file;
use base64::Engine;

fn expand_path(path: &str, accept_parent: bool) -> Result<std::path::PathBuf, Error> {
    let expanded =
        shellexpand::full(path).map_err(|e| Error::Other(format!("Path expansion failed: {e}")))?;
    let p = std::path::PathBuf::from(expanded.as_ref());
    let canonical = if accept_parent && let Some(parent) = p.parent() {
        let resolved_parent = parent.canonicalize().map_err(|e| {
            Error::Io(format!(
                "Cannot resolve parent dir '{}': {e}",
                parent.display()
            ))
        })?;
        resolved_parent.join(p.file_name().ok_or("Invalid filename")?)
    } else {
        p.canonicalize()
            .map_err(|e| Error::Io(format!("Cannot resolve path '{}': {e}", p.display())))?
    };
    Ok(canonical)
}

#[tauri::command]
pub fn is_dir(path: &str) -> Result<bool, Error> {
    let dir = expand_path(path, false)?;
    Ok(dir.is_dir())
}

#[tauri::command]
pub fn make_dir(path: &str) -> Result<(), Error> {
    let dir = expand_path(path, true)?;
    std::fs::create_dir_all(&dir)?;
    Ok(())
}

#[tauri::command]
pub fn read_dir(path: &str) -> Result<Vec<FileInfo>, Error> {
    let dir = expand_path(path, false)?;
    let entries = std::fs::read_dir(&dir)?;
    let outputs = entries
        .map(|e| {
            e.map(|e| FileInfo {
                path: e.path().to_string_lossy().to_string(),
                is_dir: e.file_type().map(|ft| ft.is_dir()).unwrap_or(false),
            })
            .map_err(Error::from)
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(outputs)
}

#[tauri::command]
pub fn read_file(path: &str) -> Result<FileData, Error> {
    let path = expand_path(path, false)?;
    let bytes = std::fs::read(&path).map_err(|e| Error::Io(format!("Cannot read file: {e}")))?;
    let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(FileData {
        path: path.to_string_lossy().to_string(),
        data,
    })
}

#[tauri::command]
pub fn write_file(path: &str, content: &str) -> Result<(), Error> {
    let path = expand_path(path, true)?;

    let canonical = if let Some(parent) = path.parent() {
        let resolved_parent = parent.canonicalize().map_err(|e| {
            Error::Io(format!(
                "Cannot resolve parent dir '{}': {e}",
                parent.display()
            ))
        })?;
        resolved_parent.join(path.file_name().ok_or("Invalid filename")?)
    } else {
        path
    };

    std::fs::write(
        &canonical,
        base64::engine::general_purpose::STANDARD
            .decode(content)
            .expect("Invalid base64"),
    )?;
    Ok(())
}

/// A line of a file, with the byte offsets it spans, excluding its line break.
struct Line<'a> {
    value: &'a str,
    start: usize,
    end: usize,
}

/// A located occurrence of the text an edit is replacing.
struct Match {
    start: usize,
    end: usize,
    /// Leading whitespace of the first matched line, as it appears in the file.
    indent: String,
}

/// Fuzzy line comparisons, tried in order from strictest to loosest.
enum Strategy {
    /// Ignores leading and trailing whitespace on every line.
    Trimmed,
    /// Also reduces every run of whitespace inside a line to one space.
    Whitespace,
    /// Only the first and last line have to match, so a block whose middle has
    /// drifted (reformatted, recommented) can still be located.
    Anchor,
}

fn indent_of(line: &str) -> &str {
    &line[..line.len() - line.trim_start_matches([' ', '\t']).len()]
}

fn collapse(line: &str) -> String {
    line.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn lines_of(content: &str) -> Vec<Line<'_>> {
    let mut lines = Vec::new();
    let mut start = 0;
    loop {
        match content[start..].find('\n') {
            Some(offset) => {
                let end = start + offset;
                lines.push(Line {
                    value: &content[start..end],
                    start,
                    end,
                });
                start = end + 1;
            }
            None => {
                lines.push(Line {
                    value: &content[start..],
                    start,
                    end: content.len(),
                });
                return lines;
            }
        }
    }
}

fn find_exact(content: &str, search: &str) -> Vec<Match> {
    let mut matches = Vec::new();
    let mut from = 0;
    while let Some(offset) = content[from..].find(search) {
        let start = from + offset;
        let end = start + search.len();
        let line = content[..start].rfind('\n').map_or(0, |index| index + 1);
        matches.push(Match {
            start,
            end,
            indent: indent_of(&content[line..start]).to_string(),
        });
        from = end;
    }
    matches
}

fn find_fuzzy(content: &str, search: &str, strategy: &Strategy, min_lines: usize) -> Vec<Match> {
    let compare = |line: &str, search: &str, index: usize, count: usize| match strategy {
        Strategy::Trimmed => line.trim() == search.trim(),
        Strategy::Whitespace => collapse(line) == collapse(search),
        Strategy::Anchor => {
            if index > 0 && index < count - 1 {
                true
            } else {
                !search.trim().is_empty() && line.trim() == search.trim()
            }
        }
    };

    let lines = lines_of(content);
    let mut searches: Vec<&str> = search.split('\n').collect();

    // A search ending in a line break covers the break of the last line it matches.
    let trailing = searches.len() > 1 && searches.last() == Some(&"");
    if trailing {
        searches.pop();
    }

    let count = searches.len();
    if count < min_lines || !searches.iter().any(|search| !search.trim().is_empty()) {
        return Vec::new();
    }

    let mut matches = Vec::new();
    let mut index = 0;

    while index + count <= lines.len() {
        let matched = (0..count)
            .all(|offset| compare(lines[index + offset].value, searches[offset], offset, count));
        if !matched {
            index += 1;
            continue;
        }
        let first = &lines[index];
        let last = &lines[index + count - 1];
        matches.push(Match {
            start: first.start,
            end: if trailing && last.end < content.len() {
                last.end + 1
            } else {
                last.end
            },
            indent: indent_of(first.value).to_string(),
        });
        index += count;
    }

    matches
}

/// Moves text from one indentation level to another, leaving the relative
/// indentation of its own lines alone.
fn reindent(text: &str, from: &str, to: &str) -> String {
    if from == to {
        return text.to_string();
    }
    text.split('\n')
        .map(|line| {
            if line.trim().is_empty() {
                return line.to_string();
            }
            let rest = line.strip_prefix(from).unwrap_or_else(|| line.trim_start());
            format!("{to}{rest}")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Replaces `old_string` with `new_string`, falling back to progressively
/// looser line comparisons so that whitespace drift in a model's copy of the
/// file does not sink the edit.
fn apply_edit(
    content: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
) -> Result<(String, usize), Error> {
    if old_string.is_empty() {
        return Err(Error::Other(
            "old_string is empty. Use write_file to create a file or fill in the text to replace."
                .to_string(),
        ));
    }
    if old_string == new_string {
        return Err(Error::Other(
            "No changes to make: old_string and new_string are exactly the same.".to_string(),
        ));
    }

    let exact = find_exact(content, old_string);
    let (matches, is_exact) = if exact.is_empty() {
        let mut fuzzy = Vec::new();
        for (strategy, min_lines) in [
            (Strategy::Trimmed, 1),
            (Strategy::Whitespace, 1),
            (Strategy::Anchor, 3),
        ] {
            fuzzy = find_fuzzy(content, old_string, &strategy, min_lines);
            if !fuzzy.is_empty() {
                break;
            }
        }
        (fuzzy, false)
    } else {
        (exact, true)
    };

    if matches.is_empty() {
        return Err(Error::Other(
            "String to replace not found in file. Read the file again and copy old_string from it verbatim."
                .to_string(),
        ));
    }
    if matches.len() > 1 && !replace_all {
        return Err(Error::Other(format!(
            "Found {} matches of the string to replace, but replace_all is false. Add surrounding context to old_string so it identifies one instance, or set replace_all to true.",
            matches.len()
        )));
    }

    // Keep the file's own line endings rather than mixing in the model's.
    let eol = if content.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let indent = indent_of(old_string.split('\n').next().unwrap_or_default());

    let mut edited = String::new();
    let mut cursor = 0;

    for matched in &matches {
        let replacement = if is_exact {
            new_string.to_string()
        } else {
            reindent(new_string, indent, &matched.indent)
        };
        edited.push_str(&content[cursor..matched.start]);
        edited.push_str(&replacement.replace("\r\n", "\n").replace('\n', eol));
        cursor = matched.end;
    }

    edited.push_str(&content[cursor..]);

    Ok((edited, matches.len()))
}

#[tauri::command]
pub fn edit_file(
    path: &str,
    old_string: &str,
    new_string: &str,
    replace_all: Option<bool>,
) -> Result<FileEdit, Error> {
    let path = expand_path(path, false)?;
    let content = std::fs::read_to_string(&path)
        .map_err(|e| Error::Io(format!("Cannot read file as text: {e}")))?;

    let (edited, replacements) = apply_edit(
        &content,
        old_string,
        new_string,
        replace_all.unwrap_or(false),
    )?;
    std::fs::write(&path, edited)?;

    Ok(FileEdit {
        path: path.to_string_lossy().to_string(),
        replacements,
    })
}

#[derive(serde::Serialize, Debug)]
pub struct FileInfo {
    path: String,
    is_dir: bool,
}

#[derive(serde::Serialize, Debug)]
pub struct FileEdit {
    path: String,
    replacements: usize,
}

#[derive(serde::Serialize, Debug)]
pub struct FileData {
    path: String,
    data: String,
}

#[derive(serde::Serialize, Debug)]
pub struct ShellOutput {
    code: Option<i32>,
    stderr: String,
    stdout: String,
}

#[tauri::command]
pub fn shell_exec(command: &str) -> Result<ShellOutput, Error> {
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(command)
        .output()?;
    Ok(ShellOutput {
        code: output.status.code(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
    })
}

#[tauri::command]
pub fn search_files(
    path: &str,
    pattern: &str,
    mode: Option<&str>,
    max_results: Option<usize>,
) -> Result<Vec<FileData>, Error> {
    use regex::Regex;
    use std::io::{BufRead, BufReader};

    let root = expand_path(path, false)?;
    let mode = mode.unwrap_or("grep");
    if mode != "grep" {
        return Err(Error::Other(
            "only grep mode is supported for now".to_string(),
        ));
    }

    let re = Regex::new(pattern).map_err(|e| Error::Other(format!("invalid regex: {e}")))?;
    let limit = max_results.unwrap_or(25);

    let mut results: Vec<FileData> = Vec::new();

    // Iterative directory walk using a stack to avoid deep recursion.
    let mut stack: Vec<std::path::PathBuf> = vec![root];

    'outer: while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue, // skip unreadable dirs silently
        };

        for entry in entries.flatten() {
            let entry_path = entry.path();
            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                stack.push(entry_path);
                continue;
            }

            if !file_type.is_file() {
                continue; // skip symlinks, pipes, etc.
            }

            if !should_include_file(&entry_path.to_string_lossy(), true) {
                continue; // skip excluded files
            }

            let file = match std::fs::File::open(&entry_path) {
                Ok(f) => f,
                Err(_) => continue, // skip unreadable files
            };

            let reader = BufReader::new(file);
            let path_str = entry_path.to_string_lossy().to_string();

            let lines = reader.lines();
            for line_result in lines {
                let line = match line_result {
                    Ok(l) => l,
                    Err(_) => break, // stop at first unreadable line (e.g. binary file)
                };

                if re.is_match(&line) {
                    results.push(read_file(&path_str)?);

                    if results.len() >= limit {
                        break 'outer;
                    }
                }
            }
        }
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expand_path() {
        let path = "~";
        let expanded = expand_path(path, false).unwrap();
        assert!(expanded.is_absolute());
    }

    #[test]
    fn test_is_dir() {
        let path = ".";
        let is_dir = is_dir(path).unwrap();
        assert!(is_dir);
    }

    #[test]
    fn test_read_dir() {
        let path = ".";
        let files = read_dir(path).unwrap();
        assert!(!files.is_empty());
    }

    #[test]
    fn test_apply_edit_exact() {
        let (edited, replacements) = apply_edit(
            "const a = 1;\nconst b = 2;\n",
            "const b = 2;",
            "const b = 3;",
            false,
        )
        .unwrap();
        assert_eq!(edited, "const a = 1;\nconst b = 3;\n");
        assert_eq!(replacements, 1);
    }

    #[test]
    fn test_apply_edit_ambiguous() {
        let content = "a();\nb();\na();\n";
        assert!(apply_edit(content, "a();", "c();", false).is_err());

        let (edited, replacements) = apply_edit(content, "a();", "c();", true).unwrap();
        assert_eq!(edited, "c();\nb();\nc();\n");
        assert_eq!(replacements, 2);
    }

    #[test]
    fn test_apply_edit_whitespace() {
        let (edited, _) = apply_edit(
            "const f = () => {\n    if (x) {\n        return 1;\n    }\n};\n",
            "if (x) {\n    return 1;\n}",
            "if (y) {\n    return 2;\n}",
            false,
        )
        .unwrap();
        assert_eq!(
            edited,
            "const f = () => {\n    if (y) {\n        return 2;\n    }\n};\n"
        );

        let (edited, _) =
            apply_edit("const  x   =  1;\n", "const x = 1;", "const x = 2;", false).unwrap();
        assert_eq!(edited, "const x = 2;\n");
    }

    #[test]
    fn test_apply_edit_anchor() {
        let (edited, _) = apply_edit(
            "function a() {\n\t// current comment\n\treturn 1;\n}\n",
            "function a() {\n\t// stale comment\n\treturn 1;\n}",
            "function a() {\n\treturn 2;\n}",
            false,
        )
        .unwrap();
        assert_eq!(edited, "function a() {\n\treturn 2;\n}\n");
    }

    #[test]
    fn test_apply_edit_line_endings() {
        let (edited, _) = apply_edit("a\nb\nc\n", "b\n", "", false).unwrap();
        assert_eq!(edited, "a\nc\n");

        let (edited, _) = apply_edit("a\r\nb\r\nc\r\n", "b", "b1\nb2", false).unwrap();
        assert_eq!(edited, "a\r\nb1\r\nb2\r\nc\r\n");
    }

    #[test]
    fn test_apply_edit_rejections() {
        assert!(apply_edit("a\n", "z", "y", false).is_err());
        assert!(apply_edit("a\n", "a", "a", false).is_err());
        assert!(apply_edit("a\n", "", "b", false).is_err());
    }

    #[test]
    fn test_search_files() {
        let path = ".";
        let pattern = "test";
        let matches = search_files(path, pattern, None, None).unwrap();
        println!("{:?}", matches);
        assert!(!matches.is_empty());
    }
}
