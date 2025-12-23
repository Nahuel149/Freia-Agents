#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


def load_json(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def node_index(flow: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {node.get("id"): node for node in flow.get("nodes", []) if isinstance(node, dict)}


def collect_issues(label: str, items: Iterable[str], issues: List[str]) -> None:
    for item in items:
        issues.append(f"{label}: {item}")


def validate_top_level(flow: Dict[str, Any], issues: List[str]) -> None:
    if not isinstance(flow, dict):
        issues.append("top-level: not an object")
        return
    keys = set(flow.keys())
    if keys != {"nodes", "edges"}:
        issues.append(f"top-level: keys {sorted(keys)} (expected ['edges', 'nodes'])")
    if not isinstance(flow.get("nodes"), list):
        issues.append("top-level: nodes is not an array")
    if not isinstance(flow.get("edges"), list):
        issues.append("top-level: edges is not an array")


def validate_edges(flow: Dict[str, Any], issues: List[str]) -> None:
    nodes = node_index(flow)
    for edge in flow.get("edges", []):
        if not isinstance(edge, dict):
            issues.append("edge: not an object")
            continue
        edge_id = edge.get("id")
        src = edge.get("source")
        tgt = edge.get("target")
        sh = edge.get("sourceHandle")
        th = edge.get("targetHandle")
        if src not in nodes:
            issues.append(f"edge {edge_id}: source missing {src}")
        if tgt not in nodes:
            issues.append(f"edge {edge_id}: target missing {tgt}")
        if th != tgt:
            issues.append(f"edge {edge_id}: targetHandle {th} != target {tgt}")

        src_node = nodes.get(src)
        if not src_node:
            continue
        anchors = src_node.get("data", {}).get("outputAnchors", [])
        if isinstance(anchors, list):
            anchor_ids = {a.get("id") for a in anchors if isinstance(a, dict)}
            if sh not in anchor_ids:
                issues.append(f"edge {edge_id}: sourceHandle {sh} not in outputAnchors of {src}")


def validate_input_types(flow: Dict[str, Any], issues: List[str]) -> None:
    for node in flow.get("nodes", []):
        if not isinstance(node, dict):
            continue
        node_id = node.get("id")
        data = node.get("data", {})
        inputs = data.get("inputs")
        input_params = data.get("inputParams")
        if not isinstance(inputs, dict) or not isinstance(input_params, list):
            continue
        params_by_name = {p.get("name"): p for p in input_params if isinstance(p, dict)}
        for name, param in params_by_name.items():
            if name not in inputs:
                if param.get("optional") or "default" in param or "show" in param:
                    continue
                issues.append(f"node {node_id}: missing input {name}")
        for name, value in inputs.items():
            param = params_by_name.get(name)
            if not param:
                continue
            ptype = param.get("type")
            if ptype == "array" and not isinstance(value, list):
                issues.append(f"node {node_id}: input {name} expected array, got {type(value).__name__}")
            if ptype == "boolean" and not isinstance(value, bool):
                issues.append(f"node {node_id}: input {name} expected boolean, got {type(value).__name__}")
            if ptype == "number" and not isinstance(value, (int, float)):
                issues.append(f"node {node_id}: input {name} expected number, got {type(value).__name__}")
            if ptype == "string" and not isinstance(value, str):
                issues.append(f"node {node_id}: input {name} expected string, got {type(value).__name__}")
            if ptype in ("json", "object") and not isinstance(value, dict):
                issues.append(f"node {node_id}: input {name} expected object, got {type(value).__name__}")


def validate_array_item_keys(flow: Dict[str, Any], issues: List[str]) -> None:
    for node in flow.get("nodes", []):
        if not isinstance(node, dict):
            continue
        node_id = node.get("id")
        data = node.get("data", {})
        inputs = data.get("inputs")
        input_params = data.get("inputParams")
        if not isinstance(inputs, dict) or not isinstance(input_params, list):
            continue
        for param in input_params:
            if not isinstance(param, dict) or param.get("type") != "array":
                continue
            name = param.get("name")
            array_def = param.get("array")
            if not name or not isinstance(array_def, list):
                continue
            expected_keys = [item.get("name") for item in array_def if isinstance(item, dict) and item.get("name")]
            values = inputs.get(name)
            if not isinstance(values, list):
                continue
            for idx, item in enumerate(values):
                if not isinstance(item, dict):
                    continue
                missing = [key for key in expected_keys if key not in item]
                if missing:
                    issues.append(f"node {node_id}: input {name}[{idx}] missing keys {missing}")


def extract_flow_state_keys(flow: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    start_keys: List[str] = []
    for node in flow.get("nodes", []):
        if node.get("data", {}).get("name") == "startAgentflow":
            inputs = node.get("data", {}).get("inputs", {})
            start_state = inputs.get("startState")
            if isinstance(start_state, str):
                try:
                    start_state = json.loads(start_state)
                except json.JSONDecodeError:
                    start_state = []
            if isinstance(start_state, list):
                for item in start_state:
                    if isinstance(item, dict) and item.get("key"):
                        start_keys.append(item.get("key"))
            break

    used_keys = set()
    pattern = re.compile(r"\\$flow\\.state\\.([A-Za-z0-9_]+)")

    def scan(value: Any) -> None:
        if isinstance(value, str):
            used_keys.update(pattern.findall(value))
        elif isinstance(value, list):
            for v in value:
                scan(v)
        elif isinstance(value, dict):
            for v in value.values():
                scan(v)

    for node in flow.get("nodes", []):
        inputs = node.get("data", {}).get("inputs", {})
        scan(inputs)

    return start_keys, sorted(used_keys)


def validate_flow_state(flow: Dict[str, Any], issues: List[str]) -> None:
    start_keys, used_keys = extract_flow_state_keys(flow)
    missing = sorted(set(used_keys) - set(start_keys))
    for key in missing:
        issues.append(f"flow state: key '{key}' used but not initialized in startState")


def compare_with_reference(flow: Dict[str, Any], ref: Dict[str, Any], issues: List[str]) -> None:
    ref_by_component: Dict[str, Dict[str, Any]] = {}
    for node in ref.get("nodes", []):
        data = node.get("data", {})
        name = data.get("name")
        if name and name not in ref_by_component:
            ref_by_component[name] = data

    missing_components = set()
    for node in flow.get("nodes", []):
        data = node.get("data", {})
        name = data.get("name")
        if not name:
            continue
        ref_data = ref_by_component.get(name)
        if not ref_data:
            if name not in missing_components:
                issues.append(f"reference: component {name} missing in reference")
                missing_components.add(name)
            continue

        for key in ("type", "version"):
            if data.get(key) != ref_data.get(key):
                issues.append(f"reference: component {name} {key} {data.get(key)} != {ref_data.get(key)}")

        params = data.get("inputParams")
        ref_params = ref_data.get("inputParams")
        if isinstance(params, list) and isinstance(ref_params, list):
            param_map = {p.get("name"): p.get("type") for p in params if isinstance(p, dict)}
            ref_map = {p.get("name"): p.get("type") for p in ref_params if isinstance(p, dict)}
            missing = sorted(set(ref_map) - set(param_map))
            extra = sorted(set(param_map) - set(ref_map))
            for param_name in missing:
                issues.append(f"reference: component {name} missing inputParam {param_name}")
            for param_name in extra:
                issues.append(f"reference: component {name} extra inputParam {param_name}")
            for param_name in sorted(set(param_map) & set(ref_map)):
                if param_map[param_name] != ref_map[param_name]:
                    issues.append(
                        f"reference: component {name} inputParam {param_name} type {param_map[param_name]} != {ref_map[param_name]}"
                    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Agentflow exports.")
    parser.add_argument("--flow", required=True, help="Path to the agentflow export JSON to validate.")
    parser.add_argument("--ref", help="Optional reference export JSON for schema diffing.")
    args = parser.parse_args()

    flow_path = Path(args.flow)
    ref_path = Path(args.ref) if args.ref else None

    flow = load_json(flow_path)
    ref = load_json(ref_path) if ref_path else None

    issues: List[str] = []
    validate_top_level(flow, issues)
    validate_edges(flow, issues)
    validate_input_types(flow, issues)
    validate_array_item_keys(flow, issues)
    validate_flow_state(flow, issues)
    if ref:
        compare_with_reference(flow, ref, issues)

    if issues:
        print("Issues found:")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print("No issues found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
