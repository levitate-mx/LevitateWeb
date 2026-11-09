import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
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
                self.assertGreater(max(result.convert("L").getdata()), 60)

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

    def test_upload_preparation_leaves_watermark_to_server_once(self):
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
            self.assertFalse(assets[0]["watermarked"])
            self.assertTrue(assets[0]["watermarkOnUpload"])
            with Image.open(output / assets[0]["file"]) as prepared:
                # A flat source stays flat until the server adds the watermark.
                self.assertLess(max(prepared.convert("L").getdata()), 30)


if __name__ == "__main__":
    unittest.main()
