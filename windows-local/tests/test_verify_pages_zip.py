"""Negative controls for the same ZIP verifier used in PR CI and Pages."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from zipfile import ZipFile, ZipInfo, ZIP_STORED

MODULE_PATH=Path(__file__).resolve().parents[1]/"verify-pages-zip.py"
spec=importlib.util.spec_from_file_location("verify_pages_zip",MODULE_PATH)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PortablePagesContract(unittest.TestCase):
    def make_zip(self, root, *, missing=None, extra=None, duplicate=None, symlink=None):
        path=Path(root)/"portable.zip"
        with ZipFile(path,"w",compression=ZIP_STORED) as archive:
            for name in sorted(module.REQUIRED):
                if name!=missing:
                    archive.writestr(name,b"valid-placeholder")
            if extra:
                archive.writestr(extra,b"unapproved")
            if duplicate:
                archive.writestr(duplicate,b"second-entry")
            if symlink:
                info=ZipInfo(symlink)
                info.create_system=3
                info.external_attr=(0o120777<<16)
                archive.writestr(info,b"target")
        return path

    def test_approved_portable_layout(self):
        with TemporaryDirectory() as directory:
            module.verify(self.make_zip(directory))

    def test_missing_module_refuses(self):
        with TemporaryDirectory() as directory:
            path=self.make_zip(directory,missing="vessie-phiserve-draft-v0.1/adapter.mjs")
            with self.assertRaisesRegex(ValueError,"ENTRY_COUNT"):
                module.verify(path)

    def test_extra_unapproved_payload_refuses(self):
        with TemporaryDirectory() as directory:
            path=self.make_zip(directory,extra="external-cloud-provider.exe")
            with self.assertRaisesRegex(ValueError,"ENTRY_COUNT"):
                module.verify(path)

    def test_duplicate_entry_refuses(self):
        with TemporaryDirectory() as directory:
            path=self.make_zip(directory,duplicate="local-console/server.mjs")
            with self.assertRaisesRegex(ValueError,"DUPLICATE"):
                module.verify(path)

    def test_symlink_payload_refuses(self):
        with TemporaryDirectory() as directory:
            path=self.make_zip(directory,missing="local-console/server.mjs",
                               symlink="local-console/server.mjs")
            with self.assertRaisesRegex(ValueError,"SYMLINK"):
                module.verify(path)


if __name__=="__main__":
    unittest.main()
