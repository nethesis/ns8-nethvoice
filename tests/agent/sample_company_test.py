"""Deterministic company-tool acceptance case; no calls or provider credentials.

Use --profiles-json to check a sanitized export of the installed profiles.
Use --satellite-source for the reviewed local Satellite worktree; omit it when
running in the deployed Satellite container (where /app provides the package).
"""

import argparse
import asyncio
import copy
import json
import sys
from pathlib import Path


async def run(fixture, profiles):
    from agent.tools import ToolRegistry

    company = fixture["company"]
    for key in ("internal", "external"):
        assert profiles[key]["company"] == company, f"{key}: sample company differs"
        assert profiles[key]["tools"]["company.get_information"] == "enabled"
        for scope, mode in fixture["profiles"][key]["company_permissions"].items():
            assert profiles[key]["permissions"][scope] == mode, f"{key}: {scope} differs"

    registry = ToolRegistry()
    results = []

    def context(profile_key, origin=None):
        return {"run_id": f"sample-company-{profile_key}-{origin or profile_key}",
                "agent_id": profile_key, "origin": origin or profile_key,
                "profile": copy.deepcopy(profiles[profile_key]),
                "external_profile": copy.deepcopy(profiles["external"])}

    async def expect(name, ctx, fields, permitted, expected=None):
        result = await registry.dispatch("nv_company_information_v1", {"fields": fields}, name, ctx)
        if permitted:
            assert result["ok"] is True, f"{name}: tool rejected"
            assert result["result"]["fields"] == expected, f"{name}: unexpected company data"
        else:
            assert result["ok"] is False, f"{name}: denied field returned"
            assert result["error"]["code"] == "permission_denied", f"{name}: unexpected error"
            assert "result" not in result and company["vat_number"] not in json.dumps(result)
        results.append({"case": name, "pass": True})

    internal, external = context("internal"), context("external")
    for key, ctx in (("internal", internal), ("external", external)):
        for field in ("company_name", "locations", "email"):
            await expect(f"{key}-{field}", ctx, [field], True, {field: company[field]})
    await expect("internal-vat", internal, ["vat_number"], True,
                 {"vat_number": company["vat_number"]})
    await expect("external-vat-denied", external, ["vat_number"], False)
    await expect("external-mixed-fields-denied", external, ["company_name", "vat_number"], False)
    await expect("external-origin-internal-profile-denied", context("internal", "external"),
                 ["vat_number"], False)
    await expect("unsupported-field-denied", internal, ["api_key"], False)

    for key, ctx in (("internal", internal), ("external", external)):
        tool = next(t for t in registry.provider_tools(ctx) if t["name"] == "nv_company_information_v1")
        advertised = tool["parameters"]["properties"]["fields"]["items"]["enum"]
        assert ("vat_number" in advertised) == (key == "internal")
    results.append({"case": "provider-schema-policy", "pass": True})

    disabled = context("internal")
    disabled["profile"]["tools"]["company.get_information"] = "disabled"
    await expect("disabled-tool-denied", disabled, ["company_name"], False)
    print(json.dumps({"passed": len(results), "cases": results}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path,
                        default=Path(__file__).parent / "fixtures" / "sample-company.json")
    parser.add_argument("--satellite-source", type=Path)
    parser.add_argument("--profiles-json", type=Path)
    args = parser.parse_args()
    if args.satellite_source:
        sys.path.insert(0, str(args.satellite_source.resolve()))
    else:
        sys.path.insert(0, "/app")
    fixture = json.loads(args.fixture.read_text())
    if args.profiles_json:
        profiles = json.loads(args.profiles_json.read_text())
    else:
        from agent.tools.registry import PERMISSIONS, MANIFESTS
        profiles = {}
        for key, sample in fixture["profiles"].items():
            permissions = dict.fromkeys(PERMISSIONS, "deny")
            permissions.update(sample["company_permissions"])
            tools = dict.fromkeys((m.id for m in MANIFESTS), "disabled")
            tools["company.get_information"] = "enabled"
            profiles[key] = {"company": copy.deepcopy(fixture["company"]),
                             "permissions": permissions, "tools": tools}
    asyncio.run(run(fixture, profiles))


if __name__ == "__main__":
    main()
