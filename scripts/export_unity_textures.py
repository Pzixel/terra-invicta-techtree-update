from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Iterable, Mapping, Set

try:
    import UnityPy  # type: ignore[import]
except ModuleNotFoundError as exc:  # pragma: no cover - import guard
    UnityPy = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


LOGGER = logging.getLogger("unity_texture_exporter")


def iter_bundle_files(root: Path, skip_suffixes: Set[str] | None = None) -> Iterable[Path]:
    """Yield candidate Unity asset containers from the given root directory."""
    if skip_suffixes is None:
        skip_suffixes = {".manifest", ".meta"}

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() in skip_suffixes:
            continue
        yield path


def _coerce_to_str(value: str | bytes | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def sanitize_name(name: str | bytes | None, default: str = "unnamed") -> str:
    """Return a filesystem-friendly representation of a Unity asset name."""
    safe = _coerce_to_str(name).replace("\\", "/").strip()
    if not safe:
        safe = default
    safe = safe.replace(":", "_").replace("*", "_")
    safe = safe.replace("?", "_").replace("\"", "_")
    safe = safe.replace("<", "_").replace(">", "_").replace("|", "_")
    safe = safe.replace("..", "_")
    return safe


def get_object_name(data, obj) -> str | bytes | None:
    """Attempt to extract a readable name from a UnityPy object payload."""
    for attr in ("name", "m_Name"):
        try:
            value = getattr(data, attr)
        except AttributeError:
            continue
        if value:
            return value

    # Fall back to the container object metadata
    for attr in ("name", "m_Name"):
        try:
            value = getattr(obj, attr)
        except AttributeError:
            continue
        if value:
            return value

    return None


def load_habmodule_icon_names(template_path: Path) -> Set[str]:
    """Return lowercase habmodule icon names referenced in the template JSON."""
    try:
        with template_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except FileNotFoundError:
        LOGGER.warning("Hab module template %s not found", template_path)
        return set()
    except json.JSONDecodeError as exc:
        LOGGER.warning("Failed to parse %s (%s)", template_path, exc)
        return set()

    allowed: Set[str] = set()
    if not isinstance(data, list):
        LOGGER.warning("Unexpected template format in %s", template_path)
        return allowed

    resource_keys = ("stationIconResource", "baseIconResource")
    for entry in data:
        if not isinstance(entry, dict):
            continue
        for key in resource_keys:
            resource = entry.get(key)
            if not isinstance(resource, str):
                continue
            name = resource.split("/")[-1]
            sanitized = sanitize_name(name)
            if not sanitized:
                continue
            allowed.add(sanitized.lower())

    return allowed


def export_textures(
    asset_root: Path,
    output_dir: Path,
    *,
    bundle_filters: Mapping[str, Set[str]] | None = None,
) -> None:
    if UnityPy is None:  # pragma: no cover - runtime guard
        raise RuntimeError(
            "UnityPy is not installed. Install it with `pip install UnityPy Pillow`."
        ) from _IMPORT_ERROR

    output_dir.mkdir(parents=True, exist_ok=True)
    bundle_filters = bundle_filters or {}

    for bundle_path in iter_bundle_files(asset_root):
        LOGGER.info("Processing %s", bundle_path)
        try:
            env = UnityPy.load(str(bundle_path))
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.warning("Skipping %s (%s)", bundle_path, exc)
            continue

        bundle_key_raw = bundle_path.stem or bundle_path.name
        bundle_key = sanitize_name(bundle_key_raw)
        bundle_root = output_dir / bundle_key
        bundle_filter = bundle_filters.get(bundle_key)
        filtered_out = 0
        exported = 0

        for obj in env.objects:
            if obj.type.name not in {"Texture2D", "Sprite"}:
                continue

            data = obj.read()
            image = getattr(data, "image", None)
            if image is None:
                continue

            asset_name_raw = get_object_name(data, obj)
            asset_name = sanitize_name(asset_name_raw)
            if asset_name == "unnamed":
                asset_name = f"unnamed_{obj.path_id}"

            if bundle_filter:
                asset_key = asset_name.lower()
                if asset_key not in bundle_filter:
                    filtered_out += 1
                    continue

            export_path = bundle_root / f"{asset_name}.png"
            export_path.parent.mkdir(parents=True, exist_ok=True)
            if export_path.exists():
                LOGGER.debug("Overwriting existing file %s", export_path)
            image.save(export_path)
            exported += 1

        if exported or filtered_out:
            LOGGER.info(
                "Exported %d texture(s) from %s (filtered %d)",
                exported,
                bundle_path.name,
                filtered_out,
            )
        else:
            LOGGER.info("No textures found in %s", bundle_path.name)


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract Texture2D/Sprite assets from Unity bundles into PNG files",
    )
    parser.add_argument(
        "asset_root",
        type=Path,
        help="Path to the folder containing Unity AssetBundle files",
    )
    parser.add_argument(
        "output_dir",
        type=Path,
        help="Where to place the extracted PNG files",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Verbosity for log output",
    )
    parser.add_argument(
        "--hab-template",
        type=Path,
        default=Path("public/gamefiles/experimental/Templates/TIHabModuleTemplate.json"),
        help="Path to TIHabModuleTemplate.json for filtering station icons",
    )
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    logging.basicConfig(level=getattr(logging, args.log_level), format="%(levelname)s: %(message)s")

    asset_root = args.asset_root.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()

    if not asset_root.exists():
        LOGGER.error("Asset root %s does not exist", asset_root)
        return 1

    bundle_filters: dict[str, Set[str]] = {}

    template_path = args.hab_template.expanduser().resolve()
    if template_path.exists():
        allowed = load_habmodule_icon_names(template_path)
        if allowed:
            bundle_filters["habmodules"] = allowed
        else:
            LOGGER.warning("Habmodule filter list is empty; exporting all habmodule textures")
    else:
        LOGGER.warning("Hab module template %s not found; exporting all habmodule textures", template_path)

    export_textures(asset_root, output_dir, bundle_filters=bundle_filters)
    return 0


if __name__ == "__main__":
    sys.exit(main())
