import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import random
import subprocess
import tempfile
import unittest

from PIL import Image


module_path = Path(__file__).resolve().parents[1] / "scripts" / "participant-portal-media.py"
spec = importlib.util.spec_from_file_location("participant_portal_media", module_path)
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


class MediaPreviewTests(unittest.TestCase):
    def test_preview_preserves_source_rotates_and_strips_exif(self):
        with tempfile.TemporaryDirectory() as directory:
            original = Path(directory) / "original.jpg"
            image = Image.new("RGB", (1200, 800), (20, 30, 40))
            exif = Image.Exif()
            exif[274] = 6
            exif[306] = "2026:01:01 12:00:00"
            image.save(original, exif=exif)
            before = hashlib.sha256(original.read_bytes()).hexdigest()
            preview, width, height = media.make_preview(original, max_edge=640)
            self.assertEqual((width, height), (427, 640))
            self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(), before)
            with Image.open(io.BytesIO(preview)) as result:
                self.assertEqual(len(result.getexif()), 0)
                self.assertGreater(result.convert("L").getextrema()[1], 60)

    def test_dry_run_writes_nothing_and_apply_outputs_private_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            originals = root / "originals"
            originals.mkdir()
            Image.new("RGB", (800, 600), "navy").save(originals / "example.jpg")
            manifest = root / "photos.json"
            manifest.write_text(json.dumps({"version": 1, "eventId": "event-example", "dances": [
                {"danceId": "dance-example", "directory": "originals"}]}))
            output = root / "output"
            media.main(["--manifest", str(manifest), "--out", str(output)])
            self.assertFalse(output.exists())
            assets = media.main(["--manifest", str(manifest), "--out", str(output), "--apply"])
            self.assertEqual(len(assets), 1)
            self.assertTrue(assets[0]["watermarked"])
            self.assertFalse(assets[0]["allowDownload"])
            for file in [output / "media-previews.json", output / assets[0]["file"]]:
                self.assertEqual(os.stat(file).st_mode & 0o777, 0o600)
            self.assertEqual(os.stat(output).st_mode & 0o777, 0o700)

    def test_assignments_must_be_explicit_and_unique(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dance = {"danceId": "dance-example", "directory": "."}
            with self.assertRaisesRegex(ValueError, "duplicados"):
                media.normalize_manifest({"version": 1, "eventId": "event-example", "dances": [dance, dance]}, root)

    def test_upload_preparation_burns_watermark_and_records_integrity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            originals = root / "originals"
            originals.mkdir()
            Image.new("RGB", (800, 600), "navy").save(originals / "example.jpg")
            manifest = root / "photos.json"
            manifest.write_text(json.dumps({"version": 1, "eventId": "event-example", "dances": [
                {"danceId": "dance-example", "directory": "originals"}]}))
            output = root / "output"
            assets = media.main(["--manifest", str(manifest), "--out", str(output), "--for-upload", "--apply"])
            self.assertTrue(assets[0]["watermarked"])
            self.assertEqual(assets[0]["watermarkVersion"], media.PHOTO_WATERMARK_VERSION)
            prepared_path = output / assets[0]["file"]
            content = prepared_path.read_bytes()
            self.assertEqual(content[:4], b"\xff\xd8\xff\xef")
            marker_end = 4 + int.from_bytes(content[4:6], "big")
            payload = content[6:marker_end]
            self.assertTrue(payload.startswith(media.PREVIEW_MARKER_PREFIX))
            fields = json.loads(payload[len(media.PREVIEW_MARKER_PREFIX):])
            jpeg = content[:2] + content[marker_end:]
            self.assertEqual(fields, {"version": media.PHOTO_WATERMARK_VERSION, "width": 800,
                                      "height": 600, "sha256": hashlib.sha256(jpeg).hexdigest()})
            with Image.open(prepared_path) as prepared:
                self.assertGreater(prepared.convert("L").getextrema()[1], 60)
                self.assertEqual(len(prepared.getexif()), 0)
            # Exercise the same validator used by the Worker, rather than a
            # Python-only reimplementation of the marker contract.
            validator = (module_path.parent.parent / "shared" / "participant-photo-watermark.js").as_uri()
            code = (f"import {{validatePreparedParticipantPhoto}} from {json.dumps(validator)};"
                    "import fs from 'node:fs/promises';"
                    "const result=await validatePreparedParticipantPhoto(await fs.readFile(process.argv[1]));"
                    "process.stdout.write(JSON.stringify({width:result.width,height:result.height,watermarkVersion:result.watermarkVersion}));")
            result = subprocess.run(["node", "--input-type=module", "-e", code, str(prepared_path)],
                                    capture_output=True, text=True, check=True)
            self.assertEqual(json.loads(result.stdout), {"width": 800, "height": 600,
                                                        "watermarkVersion": media.PHOTO_WATERMARK_VERSION})
            media.main(["--manifest", str(manifest), "--out", str(output), "--for-upload", "--apply"])
            self.assertEqual(prepared_path.read_bytes(), content)

    def test_upload_preparation_rejects_prepared_sources_and_oversize_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            originals = root / "originals"
            originals.mkdir()
            image = io.BytesIO()
            Image.new("RGB", (100, 100), "navy").save(image, format="JPEG")
            prepared = media.add_prepared_photo_marker(image.getvalue(), 100, 100)
            (originals / "already-prepared.jpg").write_bytes(prepared)
            manifest = root / "photos.json"
            manifest.write_text(json.dumps({"version": 1, "eventId": "event-example", "dances": [
                {"danceId": "dance-example", "directory": "originals"}]}))
            with self.assertRaisesRegex(ValueError, "ya es una vista preparada"):
                media.main(["--manifest", str(manifest), "--for-upload"])
            with self.assertRaisesRegex(ValueError, "supera 1 MB"):
                media.add_prepared_photo_marker(b"\xff\xd8\xff" + bytes(media.UPLOAD_BYTE_LIMIT), 100, 100)

    def test_upload_budget_fits_high_detail_photo_without_changing_its_original(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            originals = root / "originals"
            originals.mkdir()
            source = originals / "detailed.png"
            pixels = random.Random(42).randbytes(1600 * 1600 * 3)
            Image.frombytes("RGB", (1600, 1600), pixels).save(source)
            before = hashlib.sha256(source.read_bytes()).hexdigest()
            local_preview, _, _ = media.make_preview(source)
            self.assertGreater(len(local_preview), media.UPLOAD_BYTE_LIMIT)
            manifest = root / "photos.json"
            manifest.write_text(json.dumps({"version": 1, "eventId": "event-example", "dances": [
                {"danceId": "dance-example", "directory": "originals"}]}))
            output = root / "output"
            assets = media.main(["--manifest", str(manifest), "--out", str(output), "--for-upload", "--apply"])
            prepared_path = output / assets[0]["file"]
            self.assertLessEqual(prepared_path.stat().st_size, 1024 * 1024)
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), before)
            with Image.open(prepared_path) as prepared:
                self.assertEqual(prepared.size, (assets[0]["width"], assets[0]["height"]))
                self.assertLessEqual(max(prepared.size), 1600)
                self.assertEqual(len(prepared.getexif()), 0)


if __name__ == "__main__":
    unittest.main()
