#!/usr/bin/env python3
"""Prepare explicitly assigned, watermarked participant photo previews."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile

from PIL import Image, ImageCms, ImageDraw, ImageFont, ImageOps


SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def required_text(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} debe ser texto no vacío.")
    return value.strip()


def normalize_manifest(value, base_directory):
    if not isinstance(value, dict) or value.get("version") != 1:
        raise ValueError("Se requiere un manifiesto version: 1.")
    event_id = required_text(value.get("eventId"), "eventId")
    dances = value.get("dances")
    if not isinstance(dances, list) or not dances:
        raise ValueError("dances debe contener carpetas asignadas explícitamente.")
    normalized = []
    seen = set()
    for dance in dances:
        dance_id = required_text(dance.get("danceId"), "danceId")
        if dance_id in seen:
            raise ValueError("Hay danceId duplicados.")
        seen.add(dance_id)
        directory = (base_directory / required_text(dance.get("directory"), "directory")).resolve()
        if not directory.is_dir():
            raise ValueError("Una carpeta de fotos no existe.")
        caption = dance.get("captionPrefix", "Presentación Levitate MX")
        caption = required_text(caption, "captionPrefix")
        normalized.append({"danceId": dance_id, "directory": directory, "captionPrefix": caption})
    return {"eventId": event_id, "dances": normalized}


def private_write(destination, contents):
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(destination.parent, 0o700)
    descriptor, temporary = tempfile.mkstemp(prefix=".preview-", dir=destination.parent)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(contents)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, destination)
        os.chmod(destination, 0o600)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load_font(size, requested=None):
    candidates = [requested] if requested else []
    candidates += ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "DejaVuSans-Bold.ttf", "Arial.ttf"]
    for candidate in candidates:
        try:
            return ImageFont.truetype(str(candidate), size)
        except OSError:
            continue
    raise ValueError("No se encontró una fuente para la marca de agua. Especifica --font.")


def make_preview(source, max_edge=1600, font_path=None):
    with Image.open(source) as original:
        profile = original.info.get("icc_profile")
        image = ImageOps.exif_transpose(original)
        if profile:
            try:
                image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)),
                                                ImageCms.createProfile("sRGB"), outputMode="RGB")
            except (OSError, ValueError, ImageCms.PyCMSError):
                image = image.convert("RGB")
        else:
            image = image.convert("RGB")
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        image = image.copy()
    width, height = image.size
    font = load_font(max(14, round(min(width, height) * 0.043)), font_path)
    label = "LEVITATE MX · VISTA PREVIA"
    layer = Image.new("RGBA", (width * 2, height * 2))
    drawing = ImageDraw.Draw(layer)
    bounds = drawing.textbbox((0, 0), label, font=font)
    label_width = bounds[2] - bounds[0]
    step_x = label_width + max(24, width // 10)
    step_y = max(55, height // 4)
    for row, y in enumerate(range(0, height * 2, step_y)):
        for x in range(-step_x, width * 2, step_x):
            drawing.text((x + (step_x // 2 if row % 2 else 0), y), label, font=font,
                         fill=(255, 255, 255, 102), stroke_width=1, stroke_fill=(0, 0, 0, 45))
    layer = layer.rotate(24, resample=Image.Resampling.BICUBIC)
    left, top = width // 2, height // 2
    layer = layer.crop((left, top, left + width, top + height))
    image = Image.alpha_composite(image.convert("RGBA"), layer).convert("RGB")
    encoded = io.BytesIO()
    image.save(encoded, format="JPEG", quality=82, optimize=True, exif=b"")
    return encoded.getvalue(), width, height


def build_parser():
    parser = argparse.ArgumentParser(description="Crea vistas JPEG con marca de agua, sin modificar originales.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--out", help="Carpeta privada de salida. Obligatoria con --apply.")
    parser.add_argument("--apply", action="store_true", help="Escribe las vistas. El valor predeterminado es simulación.")
    parser.add_argument("--limit-per-dance", type=int, default=20)
    parser.add_argument("--max-edge", type=int, default=1600)
    parser.add_argument("--font", help="Fuente TTF/OTF opcional para la marca de agua.")
    return parser


def main(arguments=None):
    parser = build_parser()
    args = parser.parse_args(arguments)
    if not 1 <= args.limit_per_dance <= 20:
        parser.error("--limit-per-dance debe estar entre 1 y 20.")
    if not 320 <= args.max_edge <= 2000:
        parser.error("--max-edge debe estar entre 320 y 2000.")
    if args.apply and not args.out:
        parser.error("--apply requiere --out explícito.")
    manifest_path = Path(args.manifest).resolve()
    with manifest_path.open(encoding="utf-8") as source:
        manifest = normalize_manifest(json.load(source), manifest_path.parent)
    output_directory = Path(args.out).resolve() if args.out else None
    public_directory = (Path(__file__).resolve().parent.parent / "public").resolve()
    if output_directory and (output_directory == public_directory or public_directory in output_directory.parents):
        raise ValueError("Guarda las vistas privadas fuera de public/.")
    assets = []
    for dance in manifest["dances"]:
        source_directory = dance["directory"]
        if output_directory and (output_directory == source_directory or source_directory in output_directory.parents):
            raise ValueError("La salida debe quedar fuera de las carpetas originales.")
        candidates = sorted((file for file in source_directory.iterdir() if file.is_file() and not file.is_symlink()
                             and file.suffix.lower() in SUPPORTED_SUFFIXES), key=lambda file: file.name.casefold())
        candidates = candidates[:args.limit_per_dance]
        if not candidates:
            raise ValueError("Una carpeta asignada no contiene fotos JPEG, PNG o WebP.")
        dance_key = hashlib.sha256(dance["danceId"].encode()).hexdigest()[:16]
        for index, source_file in enumerate(candidates, start=1):
            content = source_file.read_bytes()
            source_hash = hashlib.sha256(content).hexdigest()[:16]
            key = f"photo-{dance_key}-{index:02d}-{source_hash}"
            preview, width, height = make_preview(io.BytesIO(content), args.max_edge, args.font)
            relative_file = Path("previews") / dance_key / f"{key}.jpg"
            if args.apply:
                private_write(output_directory / relative_file, preview)
            assets.append({"key": key, "kind": "photo", "danceId": dance["danceId"],
                           "file": relative_file.as_posix(), "width": width, "height": height,
                           "caption": f"{dance['captionPrefix']} · {index:02d}",
                           "watermarked": True, "allowDownload": False})
    if args.apply:
        encoded = json.dumps({"version": 1, "eventId": manifest["eventId"], "assets": assets},
                             ensure_ascii=False, indent=2).encode()
        private_write(output_directory / "media-previews.json", encoded)
    mode = "Preparadas" if args.apply else "Simulación"
    print(f"{mode}: {len(assets)} vistas, en {len(manifest['dances'])} coreografías.")
    if args.apply:
        print(f"Manifiesto privado: {output_directory / 'media-previews.json'}")
    return assets


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise SystemExit(f"No se pudo preparar el lote: {error}") from None
