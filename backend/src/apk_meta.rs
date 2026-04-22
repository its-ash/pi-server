use std::{io::Read, path::Path};
use zip::ZipArchive;

// ──────────────────────────── public surface ────────────────────────────────

#[derive(Debug)]
pub struct ApkMeta {
    pub app_name: Option<String>,
    pub app_icon_b64: Option<String>,
    pub app_icon_mime: Option<String>,
}

pub fn extract(apk_path: &Path) -> Option<ApkMeta> {
    let file = std::fs::File::open(apk_path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;

    let manifest_data = read_entry(&mut archive, "AndroidManifest.xml")?;
    let attrs = parse_axml(&manifest_data)?;

    let arsc_data = read_entry(&mut archive, "resources.arsc");

    let app_name = match (&attrs.label_string, attrs.label_res_id) {
        (Some(s), _) => Some(s.clone()),
        (None, Some(rid)) => arsc_data.as_deref().and_then(|a| resolve_res(a, rid)),
        _ => None,
    };

    let app_icon = attrs.icon_res_id.and_then(|rid| {
        let path = arsc_data.as_deref().and_then(|a| resolve_res(a, rid))?;
        extract_icon(&mut archive, &path)
    });

    let (app_icon_b64, app_icon_mime) = match app_icon {
        Some((bytes, mime)) => (
            Some(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)),
            Some(mime),
        ),
        None => (None, None),
    };

    Some(ApkMeta {
        app_name,
        app_icon_b64,
        app_icon_mime,
    })
}

// ──────────────────────────── zip helpers ───────────────────────────────────

fn read_entry<R: Read + std::io::Seek>(archive: &mut ZipArchive<R>, name: &str) -> Option<Vec<u8>> {
    let mut entry = archive.by_name(name).ok()?;
    let mut buf = Vec::new();
    entry.read_to_end(&mut buf).ok()?;
    Some(buf)
}

fn extract_icon<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    path: &str,
) -> Option<(Vec<u8>, String)> {
    // If resource path is a raster image, use it directly.
    if let Some(bytes) = read_entry(archive, path) {
        let mime = mime_for(path);
        if !path.ends_with(".xml") {
            return Some((bytes, mime));
        }
    }

    // Adaptive icon XML or missing — try raster densities for same base name.
    let base = Path::new(path).file_stem()?.to_str()?;
    let densities = [
        "mipmap-xxxhdpi-v4",
        "mipmap-xxhdpi-v4",
        "mipmap-xhdpi-v4",
        "mipmap-hdpi-v4",
        "mipmap-mdpi-v4",
        "drawable-xxxhdpi-v4",
        "drawable-xxhdpi-v4",
        "drawable-xhdpi-v4",
        "drawable-hdpi-v4",
    ];
    for density in &densities {
        for ext in &["png", "webp"] {
            let candidate = format!("res/{density}/{base}.{ext}");
            if let Some(bytes) = read_entry(archive, &candidate) {
                return Some((bytes, mime_for(&candidate)));
            }
        }
    }
    None
}

fn mime_for(path: &str) -> String {
    if path.ends_with(".webp") {
        "image/webp".to_string()
    } else {
        "image/png".to_string()
    }
}

// ──────────────────────────── binary-reading helpers ────────────────────────

fn r8(data: &[u8], pos: usize) -> Option<u8> {
    data.get(pos).copied()
}

fn r16(data: &[u8], pos: usize) -> Option<u16> {
    data.get(pos..pos + 2)
        .and_then(|b| b.try_into().ok())
        .map(u16::from_le_bytes)
}

fn r32(data: &[u8], pos: usize) -> Option<u32> {
    data.get(pos..pos + 4)
        .and_then(|b| b.try_into().ok())
        .map(u32::from_le_bytes)
}

// ──────────────────────────── string pool ───────────────────────────────────

fn parse_string_pool(data: &[u8], offset: usize) -> Option<Vec<String>> {
    if r16(data, offset)? != 0x0001 {
        return None;
    }
    let string_count = r32(data, offset + 8)? as usize;
    let flags = r32(data, offset + 16)?;
    let strings_start = r32(data, offset + 20)? as usize;
    let is_utf8 = (flags & (1 << 8)) != 0;

    // Offsets array begins right after the 28-byte ResStringPool_header.
    let offsets_base = offset + 28;
    let data_base = offset + strings_start;

    let mut out = Vec::with_capacity(string_count);
    for i in 0..string_count {
        let str_off = r32(data, offsets_base + i * 4)? as usize;
        let s = if is_utf8 {
            read_utf8_str(data, data_base + str_off).unwrap_or_default()
        } else {
            read_utf16_str(data, data_base + str_off).unwrap_or_default()
        };
        out.push(s);
    }
    Some(out)
}

fn read_utf8_str(data: &[u8], pos: usize) -> Option<String> {
    let mut p = pos;
    // Skip character-count field (1 or 2 bytes).
    let b = r8(data, p)?;
    p += if b & 0x80 != 0 { 2 } else { 1 };
    // Read byte-length (1 or 2 bytes).
    let b = r8(data, p)?;
    p += 1;
    let byte_len = if b & 0x80 != 0 {
        let b2 = r8(data, p)? as usize;
        p += 1;
        ((b as usize & 0x7F) << 8) | b2
    } else {
        b as usize
    };
    String::from_utf8(data.get(p..p + byte_len)?.to_vec()).ok()
}

fn read_utf16_str(data: &[u8], pos: usize) -> Option<String> {
    let mut len = r16(data, pos)? as usize;
    let mut p = pos + 2;
    if len & 0x8000 != 0 {
        let lo = r16(data, p)? as usize;
        p += 2;
        len = ((len & 0x7FFF) << 16) | lo;
    }
    let chars: Option<Vec<u16>> = (0..len).map(|i| r16(data, p + i * 2)).collect();
    String::from_utf16(&chars?).ok()
}

// ──────────────────────────── AXML parser ───────────────────────────────────

#[derive(Default)]
struct ManifestAttrs {
    label_string: Option<String>,
    label_res_id: Option<u32>,
    icon_res_id: Option<u32>,
}

fn parse_axml(data: &[u8]) -> Option<ManifestAttrs> {
    // Outer RES_XML_TYPE chunk (0x0003), 8-byte header.
    if r16(data, 0)? != 0x0003 {
        return None;
    }

    let mut pos = 8usize;
    let mut pool: Vec<String> = Vec::new();
    let mut attrs = ManifestAttrs::default();
    let mut found = false;

    while pos + 8 <= data.len() {
        let chunk_type = r16(data, pos)?;
        let chunk_size = r32(data, pos + 4)? as usize;
        if chunk_size == 0 || pos + chunk_size > data.len() {
            break;
        }

        match chunk_type {
            0x0001 => {
                pool = parse_string_pool(data, pos).unwrap_or_default();
            }
            0x0102 => {
                // RES_XML_START_ELEMENT_TYPE
                // ResXMLTree_node (16 bytes) + ResXMLTree_attrExt starts at pos+16
                let name_idx = r32(data, pos + 20)? as usize;
                let elem = pool.get(name_idx).map(|s| s.as_str()).unwrap_or("");

                if elem == "application" {
                    let attr_start = r16(data, pos + 24)? as usize;
                    let attr_size = r16(data, pos + 26)? as usize;
                    let attr_count = r16(data, pos + 28)? as usize;
                    // Attributes start at: start of ResXMLTree_attrExt (pos+16) + attr_start
                    let attrs_base = pos + 16 + attr_start;

                    for i in 0..attr_count {
                        let ap = attrs_base + i * attr_size;
                        let name_idx = r32(data, ap + 4)? as usize;
                        let data_type = r8(data, ap + 15)?;
                        let val = r32(data, ap + 16)?;

                        let name = pool.get(name_idx).map(|s| s.as_str()).unwrap_or("");
                        match name {
                            "label" => {
                                if data_type == 0x03 {
                                    attrs.label_string =
                                        pool.get(val as usize).cloned();
                                } else if data_type == 0x01 {
                                    attrs.label_res_id = Some(val);
                                }
                            }
                            "icon" | "roundIcon" if attrs.icon_res_id.is_none() => {
                                if data_type == 0x01 {
                                    attrs.icon_res_id = Some(val);
                                }
                            }
                            _ => {}
                        }
                    }
                    found = true;
                }
            }
            0x0103 if found => break, // RES_XML_END_ELEMENT_TYPE after application
            _ => {}
        }

        pos += chunk_size;
    }

    Some(attrs)
}

// ──────────────────────────── resources.arsc ────────────────────────────────

/// Resolves a resource ID (e.g. 0x7F040001) to its default-config string value.
fn resolve_res(arsc: &[u8], res_id: u32) -> Option<String> {
    let pkg_id = (res_id >> 24) as u8;
    let type_id = ((res_id >> 16) & 0xFF) as u8; // 1-based
    let entry_idx = (res_id & 0xFFFF) as usize;

    // TABLE chunk (0x0002), header is 12 bytes.
    if r16(arsc, 0)? != 0x0002 {
        return None;
    }
    let table_header_size = r16(arsc, 2)? as usize;

    // Global string pool immediately follows the TABLE header.
    let mut pos = table_header_size;
    if r16(arsc, pos)? != 0x0001 {
        return None;
    }
    let global_strings = parse_string_pool(arsc, pos)?;
    let sp_size = r32(arsc, pos + 4)? as usize;
    pos += sp_size;

    // Scan PACKAGE chunks.
    while pos + 8 <= arsc.len() {
        let ct = r16(arsc, pos)?;
        let cs = r32(arsc, pos + 4)? as usize;
        if cs == 0 || pos + cs > arsc.len() {
            break;
        }
        if ct != 0x0200 {
            pos += cs;
            continue;
        }

        // RES_TABLE_PACKAGE_TYPE: id is at pos+8.
        let this_pkg = r32(arsc, pos + 8)? as u8;
        if this_pkg != pkg_id {
            pos += cs;
            continue;
        }

        let pkg_header_size = r16(arsc, pos + 2)? as usize;
        let pkg_end = pos + cs;
        let mut sub = pos + pkg_header_size;

        while sub + 8 <= pkg_end {
            let sct = r16(arsc, sub)?;
            let scs = r32(arsc, sub + 4)? as usize;
            if scs == 0 || sub + scs > pkg_end {
                break;
            }

            if sct == 0x0201 {
                // RES_TABLE_TYPE_TYPE
                let this_type = r8(arsc, sub + 8)?;
                if this_type == type_id {
                    let entry_count = r32(arsc, sub + 12)? as usize;
                    let entries_start = r32(arsc, sub + 16)? as usize;
                    let type_header_size = r16(arsc, sub + 2)? as usize;

                    if entry_idx < entry_count {
                        let off_pos = sub + type_header_size + entry_idx * 4;
                        let entry_off = r32(arsc, off_pos)?;
                        if entry_off != 0xFFFF_FFFF {
                            let ep = sub + entries_start + entry_off as usize;
                            let flags = r16(arsc, ep + 2)?;
                            // Skip complex entries.
                            if flags & 0x0001 == 0 {
                                // Simple entry: ResTable_entry (8 bytes) + Res_value (8 bytes).
                                let vp = ep + 8;
                                let data_type = r8(arsc, vp + 3)?;
                                let data = r32(arsc, vp + 4)?;
                                if data_type == 0x03 {
                                    if let Some(s) = global_strings.get(data as usize) {
                                        if !s.is_empty() {
                                            return Some(s.clone());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            sub += scs;
        }

        pos += cs;
    }

    None
}
