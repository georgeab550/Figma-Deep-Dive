#!/usr/bin/env python3
"""Validate every bundled design-system profile against the schema."""
import json, sys
from pathlib import Path
import jsonschema

root = Path(__file__).resolve().parent.parent
schema = json.loads((root / "schemas/design-system-profile.schema.json").read_text())
jsonschema.Draft202012Validator.check_schema(schema)
failed = False
for f in sorted((root / "profiles").glob("*.json")):
    errors = list(jsonschema.Draft202012Validator(schema).iter_errors(json.loads(f.read_text())))
    for e in errors:
        print(f"{f.relative_to(root)}: {'/'.join(map(str, e.path)) or '<root>'}: {e.message}")
    failed |= bool(errors)
    if not errors:
        print(f"valid  {f.relative_to(root)}")
sys.exit(1 if failed else 0)
