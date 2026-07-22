"""Generate sanitized live status and control-tower records from SQLite."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from improvement_contract import frontier_snapshot
from runtime_utils import (
    atomic_write_json,
    atomic_write_text,
    localhost_port_open,
    parse_time,
    process_matches,
    utc_now,
)
from state_store import StateStore


class Reporter:
    def __init__(self, workspace: Path, runtime_dir: Path, store: StateStore):
        self.workspace = workspace.resolve()
        self.runtime_dir = runtime_dir.resolve()
        self.control_tower = self.workspace / "CANA_CONTROL_TOWER"
        self.control_tower.mkdir(parents=True, exist_ok=True)
        self.store = store

    def snapshot(self) -> dict[str, Any]:
        heartbeat = self.store.latest_heartbeat()
        supervisor_pid = self.store.get_runtime("supervisor_pid")
        opencode_pid = self.store.get_runtime("opencode_pid")
        ending = self.store.get_runtime("ending_condition", {})
        provider = self.store.get_runtime("provider_status", {})
        lanes = self.store.get_runtime("lane_assignments", [])
        missions = self.store.rows(
            """
            SELECT mission_id,state,lane,primary_model,secret_reference,priority,
              attempt_number,maximum_attempts,lease_owner,lease_expires_at,
              blocker_classification,next_action,worktree,integration_reference,
              rollback_reference,assumptions_json,sota_gap,brittle_point,
              success_metrics_json,feedback_signals_json,strategy_revision,
              benchmark_evidence_json,measurement_contract_json,
              falsification_test,promotion_rule,next_frontier,frontier_epoch,
              progress_delta_json,updated_at
            FROM missions ORDER BY
              CASE WHEN state IN ('completed','superseded','failed_terminal') THEN 1 ELSE 0 END,
              priority DESC,created_at
            LIMIT 100
            """
        )
        active_lane_runs = self.store.rows(
            """
            SELECT lane_run_id,mission_id,cycle_id,lane_id,lane_name,model,
              secret_reference,state,attempt,started_at
            FROM lane_runs WHERE state='running' ORDER BY started_at
            """
        )
        latest_events = self.store.rows(
            "SELECT created_at,event_type,mission_id,details_json FROM events ORDER BY event_id DESC LIMIT 30"
        )
        latest_progress = next(
            (event for event in latest_events if event["event_type"] in {
                "lane_completed",
                "verification_passed",
                "integration_completed",
                "mission_transition",
            }),
            None,
        )
        external_executed = bool(self.store.row("SELECT 1 FROM lane_runs WHERE state='completed' AND session_id NOT LIKE 'mock-%' LIMIT 1"))
        codex_missions = self.store.rows(
            """
            SELECT mission_id,parent_mission_id,state,objective,priority,
              codex_mode,baseline_revision,worktree,branch_name,session_id,
              process_id,lease_owner,lease_expires_at,attempt_count,
              maximum_attempts,candidate_revision,changed_files_json,
              blocker_classification,next_action,rollback_reference,
              terminal_state,assumptions_json,sota_gap,brittle_point,
              success_metrics_json,feedback_signals_json,strategy_revision,
              benchmark_evidence_json,measurement_contract_json,
              falsification_test,promotion_rule,next_frontier,frontier_epoch,
              progress_delta_json,updated_at
            FROM codex_missions
            ORDER BY
              CASE WHEN state IN (
                'CODEX_COMPLETED','CODEX_TERMINAL_FAILURE','CODEX_REJECTED',
                'CODEX_INTEGRATED','CODEX_REVERTED'
              ) THEN 1 ELSE 0 END,
              priority DESC,created_at
            LIMIT 100
            """
        )
        active_codex_runs = self.store.rows(
            """
            SELECT run_id,mission_id,state,process_id,session_id,prompt_hash,
              started_at,error_class
            FROM codex_runs WHERE state='running' ORDER BY started_at
            """
        )
        codex_capabilities = self.store.get_runtime("codex_capabilities", {})
        if not isinstance(codex_capabilities, dict):
            codex_capabilities = {}
        codex_capabilities = dict(codex_capabilities)
        codex_usage = self.store.rows(
            """
            SELECT * FROM codex_usage_daily
            ORDER BY usage_day DESC LIMIT 30
            """
        )
        today_usage = next(
            (
                row
                for row in codex_usage
                if row["usage_day"] == utc_now()[:10]
            ),
            None,
        )
        codex_capabilities["usage_today"] = (
            int(today_usage["job_count"]) if today_usage else 0
        )
        codex_pid = self.store.get_runtime("codex_child_pid")
        server_url = self.store.get_runtime("opencode_server_url")
        parsed_server = urlparse(str(server_url or ""))
        server_port = parsed_server.port or 4096
        supervisor_alive = process_matches(
            supervisor_pid, ("supervisor.py", "--workspace")
        )
        opencode_identity = process_matches(opencode_pid, ("opencode", "serve"))
        opencode_alive = opencode_identity and localhost_port_open(server_port)
        codex_alive = process_matches(codex_pid, ("codex", "exec"))
        phase = heartbeat["phase"] if heartbeat else "not_started"
        return {
            "schema_version": 1,
            "generated_at": utc_now(),
            "workspace": str(self.workspace),
            "runtime_dir": str(self.runtime_dir),
            "runtime_mode": self.store.get_runtime("mode", "not_started"),
            "baseline": {
                "commit": self.store.get_runtime("baseline_commit"),
                "protected_integration_base": self.store.get_runtime(
                    "protected_integration_base"
                ),
            },
            "phase": phase,
            "supervisor": {
                "pid": supervisor_pid,
                "alive": supervisor_alive,
                "identity_verified": supervisor_alive,
            },
            "opencode": {
                "pid": opencode_pid,
                "alive": opencode_alive,
                "identity_verified": opencode_identity,
                "server_url": server_url,
                "headless": opencode_alive,
            },
            "ending_condition": ending,
            "heartbeat": heartbeat,
            "provider": provider,
            "external_model_execution_observed": external_executed,
            "configured_lanes": lanes,
            "active_lane_runs": active_lane_runs,
            "codex": {
                "enabled": self.store.get_runtime("codex_enabled", False),
                "capabilities": codex_capabilities,
                "pid": codex_pid,
                "alive": codex_alive,
                "identity_verified": codex_alive,
                "maximum_parallel": self.store.get_runtime(
                    "max_parallel_codex", 1
                ),
                "active_runs": active_codex_runs,
                "missions": codex_missions,
                "daily_usage": codex_usage,
                "next_mission": self.store.get_runtime("codex_next_mission"),
            },
            "missions": missions,
            "cooldowns": self.store.active_cooldowns(),
            "daily_usage": self.store.rows(
                "SELECT * FROM usage_daily ORDER BY usage_day DESC,secret_reference,model LIMIT 50"
            ),
            "improvement_loop": {
                "contract_version": 3,
                "frontier": frontier_snapshot(self.store),
                "active_sota_gaps": [
                    {
                        "mission_id": mission["mission_id"],
                        "sota_gap": mission["sota_gap"],
                        "brittle_point": mission["brittle_point"],
                        "strategy_revision": mission["strategy_revision"],
                    }
                    for mission in [*missions, *codex_missions]
                    if mission["state"]
                    not in {
                        "completed",
                        "superseded",
                        "failed_terminal",
                        "CODEX_COMPLETED",
                        "CODEX_TERMINAL_FAILURE",
                        "CODEX_REJECTED",
                        "CODEX_INTEGRATED",
                        "CODEX_REVERTED",
                    }
                ][:10],
                "strategy_pivots": int(
                    (
                        self.store.row(
                            """
                            SELECT COUNT(*) AS count FROM events
                            WHERE event_type='strategy_pivot_queued'
                            """
                        )
                        or {"count": 0}
                    )["count"]
                ),
                "idle_is_progress": False,
            },
            "last_progress": latest_progress,
            "next_actions": [
                {"mission_id": mission["mission_id"], "next_action": mission["next_action"]}
                for mission in missions
                if mission["state"] not in {"completed", "superseded", "failed_terminal"}
            ][:10],
            "codex_next_actions": [
                {
                    "mission_id": mission["mission_id"],
                    "next_action": mission["next_action"],
                }
                for mission in codex_missions
                if mission["state"]
                not in {
                    "CODEX_COMPLETED",
                    "CODEX_TERMINAL_FAILURE",
                    "CODEX_REJECTED",
                    "CODEX_INTEGRATED",
                    "CODEX_REVERTED",
                }
            ][:10],
        }

    @staticmethod
    def _table(headers: list[str], rows: list[list[Any]]) -> str:
        def cell(value: Any) -> str:
            return str(value if value is not None else "—").replace("|", "\\|").replace("\n", " ")

        lines = [
            "| " + " | ".join(headers) + " |",
            "| " + " | ".join("---" for _ in headers) + " |",
        ]
        lines.extend("| " + " | ".join(cell(item) for item in row) + " |" for row in rows)
        return "\n".join(lines)

    def write(self) -> dict[str, Any]:
        status = self.snapshot()
        atomic_write_json(self.control_tower / "EXTERNAL_LOOP_STATUS.json", status)
        heartbeat = status["heartbeat"] or {}
        runtime_health = (
            "# CANA Runtime Health\n\n"
            f"Generated: {status['generated_at']}\n\n"
            f"- Mode: `{status['runtime_mode']}`\n"
            f"- Phase: `{status['phase']}`\n"
            f"- Supervisor: PID `{status['supervisor']['pid']}`, alive `{status['supervisor']['alive']}`\n"
            f"- OpenCode headless: PID `{status['opencode']['pid']}`, alive `{status['opencode']['alive']}`\n"
            f"- Server: `{status['opencode']['server_url']}`\n"
            f"- Heartbeat: `{heartbeat.get('created_at', 'none')}`\n"
            f"- External model execution observed: `{status['external_model_execution_observed']}`\n"
            f"- Provider-ready lanes: `{status['provider'].get('accepted_count', 0)}/5`\n"
            f"- Active cooldowns: `{len(status['cooldowns'])}`\n"
            f"- Blade 0 enabled: `{status['codex']['enabled']}`\n"
            f"- Codex child: PID `{status['codex']['pid']}`, alive `{status['codex']['alive']}`\n"
        )
        atomic_write_text(self.control_tower / "RUNTIME_HEALTH.md", runtime_health)
        lane_rows = [
            [
                lane["lane_id"],
                lane["name"],
                lane["model"],
                lane["secret_reference"],
                "accepted" if lane["secret_reference"] in status["provider"].get("accepted_references", []) else "blocked",
            ]
            for lane in status["configured_lanes"]
        ]
        atomic_write_text(
            self.control_tower / "LANE_STATUS.md",
            "# CANA Lane Status\n\n"
            + self._table(["Lane", "Role", "Primary model", "Secret reference", "Provider state"], lane_rows)
            + "\n",
        )
        mission_rows = [
            [
                mission["mission_id"],
                mission["state"],
                mission["lane"],
                mission["attempt_number"],
                mission["priority"],
                mission["next_action"],
            ]
            for mission in status["missions"]
        ]
        atomic_write_text(
            self.control_tower / "MISSION_QUEUE.md",
            "# CANA Mission Queue\n\n"
            + self._table(["Mission", "State", "Lane", "Attempt", "Priority", "Next action"], mission_rows)
            + "\n",
        )
        codex_rows = [
            [
                mission["mission_id"],
                mission["state"],
                mission["codex_mode"],
                mission["attempt_count"],
                mission["candidate_revision"],
                mission["blocker_classification"],
                mission["next_action"],
            ]
            for mission in status["codex"]["missions"]
        ]
        atomic_write_text(
            self.control_tower / "CODEX_MISSION_QUEUE.md",
            "# CANA Blade 0 Mission Queue\n\n"
            + self._table(
                [
                    "Mission",
                    "State",
                    "Mode",
                    "Attempt",
                    "Candidate",
                    "Blocker",
                    "Next action",
                ],
                codex_rows,
            )
            + "\n",
        )
        capability = status["codex"]["capabilities"]
        capability_rows = [
            ["Installed", capability.get("installed")],
            ["Version", capability.get("version")],
            ["Authenticated", capability.get("authenticated")],
            ["Noninteractive exec", capability.get("noninteractive_exec")],
            ["Session resume", capability.get("session_resume")],
            ["Working-directory scoping", capability.get("workspace_scoping")],
            ["Sandbox modes", capability.get("sandbox_modes")],
            ["Approval never", capability.get("approval_never")],
            ["JSONL output", capability.get("jsonl_output")],
            ["Output schema", capability.get("output_schema")],
            ["Model control", capability.get("model_control")],
            ["Reasoning control", capability.get("reasoning_control")],
            ["Native timeout", capability.get("native_timeout")],
            ["Adapter timeout", capability.get("adapter_timeout")],
            ["Usage today", capability.get("usage_today")],
            ["Daily ceiling", capability.get("daily_job_ceiling")],
            ["Blocker", capability.get("blocker")],
            ["Checked", capability.get("checked_at")],
        ]
        atomic_write_text(
            self.control_tower / "CODEX_CAPABILITIES.md",
            "# CANA Blade 0 — Detected Codex Capabilities\n\n"
            "Credential material was neither inspected nor recorded. Detection used "
            "read-only CLI help, version, and login-status commands through the sole "
            "authorized adapter boundary.\n\n"
            + self._table(["Capability", "Detected value"], capability_rows)
            + "\n",
        )
        atomic_write_text(
            self.control_tower / "CODEX_RUNTIME_STATUS.md",
            "# CANA Blade 0 Runtime Status\n\n"
            f"Generated: {status['generated_at']}\n\n"
            f"- Enabled: `{status['codex']['enabled']}`\n"
            f"- Child PID: `{status['codex']['pid']}`\n"
            f"- Child alive: `{status['codex']['alive']}`\n"
            f"- Active runs: `{len(status['codex']['active_runs'])}`\n"
            f"- Durable missions: `{len(status['codex']['missions'])}`\n"
            f"- Next mission: `{status['codex']['next_mission']}`\n"
            "- Maximum parallel Codex workers: `1`\n"
            "- Maximum parallel modifying Codex candidates: `1`\n",
        )
        cycle_rows = self.store.rows(
            """
            SELECT cycle_id,mission_id,COUNT(*) AS lanes,
              SUM(CASE WHEN state='completed' THEN 1 ELSE 0 END) AS completed_lanes,
              MIN(started_at) AS started_at,MAX(finished_at) AS finished_at
            FROM lane_runs GROUP BY cycle_id,mission_id ORDER BY started_at DESC LIMIT 100
            """
        )
        atomic_write_text(
            self.control_tower / "CYCLE_HISTORY.md",
            "# CANA Cycle History\n\n"
            + self._table(
                ["Cycle", "Mission", "Lanes", "Completed", "Started", "Finished"],
                [[r["cycle_id"], r["mission_id"], r["lanes"], r["completed_lanes"], r["started_at"], r["finished_at"]] for r in cycle_rows],
            )
            + "\n",
        )
        integrations = self.store.rows(
            "SELECT * FROM integrations ORDER BY created_at DESC LIMIT 100"
        )
        atomic_write_text(
            self.control_tower / "INTEGRATION_HISTORY.md",
            "# CANA Integration History\n\n"
            + self._table(
                ["Mission", "State", "Integration", "Rollback", "Updated"],
                [[r["mission_id"], r["state"], r["integration_reference"], r["rollback_reference"], r["updated_at"]] for r in integrations],
            )
            + "\n",
        )
        rejections = self.store.rows(
            """
            SELECT mission_id,state,critic_findings_json,release_judge_decision,
              blocker_classification,updated_at
            FROM missions
            WHERE state IN ('rejected','repairing','failed_terminal')
              OR release_judge_decision IN ('REJECT','HOLD')
            ORDER BY updated_at DESC
            """
        )
        atomic_write_text(
            self.control_tower / "REJECTION_HISTORY.md",
            "# CANA Rejection History\n\n"
            + self._table(
                ["Mission", "State", "Critic findings", "Release decision", "Blocker", "Updated"],
                [[r["mission_id"], r["state"], r["critic_findings_json"], r["release_judge_decision"], r["blocker_classification"], r["updated_at"]] for r in rejections],
            )
            + "\n",
        )
        research = self.store.rows("SELECT * FROM research ORDER BY retrieved_at DESC LIMIT 200")
        atomic_write_text(
            self.control_tower / "RESEARCH_LEDGER.md",
            "# CANA Research Ledger\n\n"
            + self._table(
                ["Mission", "Claim", "Source type", "URL", "Status", "Retrieved"],
                [[r["mission_id"], r["claim"], r["source_type"], r["source_url"], r["status"], r["retrieved_at"]] for r in research],
            )
            + "\n",
        )
        if not (self.control_tower / "AMBITION_ROADMAP.md").exists():
            atomic_write_text(
                self.control_tower / "AMBITION_ROADMAP.md",
                "# CANA Ambition Roadmap\n\n"
                "## Horizon A — Release integrity\n\nClose verified security, truth, transaction, deployment, and recovery gates.\n\n"
                "## Horizon B — Category leadership\n\nBuild evidence freshness, transparent source history, merchant self-service, and explainable discovery.\n\n"
                "## Horizon C — Category creation\n\nTest differentiated trust and neighborhood-intelligence capabilities with explicit evidence, risks, metrics, cost, and rollback.\n",
            )
        completed = sum(1 for mission in status["missions"] if mission["state"] == "completed")
        blocked = sum(1 for mission in status["missions"] if mission["state"] in {"blocked_external", "blocked_human"})
        atomic_write_text(
            self.control_tower / "RELEASE_READINESS.md",
            "# CANA Release Readiness\n\n"
            f"Generated: {status['generated_at']}\n\n"
            f"- Completed sovereign missions: `{completed}`\n"
            f"- Blocked missions: `{blocked}`\n"
            f"- Required provider lanes accepted: `{status['provider'].get('accepted_count', 0)}/5`\n"
            "- Public release: `NOT AUTHORIZED`\n"
            "- Release-ready condition: all quality-constitution gates pass with qualified human-only reviews recorded.\n",
        )
        return status


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--runtime-dir", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    runtime_dir = (args.runtime_dir or (workspace / ".cana-loop")).resolve()
    store = StateStore(runtime_dir / "state.sqlite3")
    try:
        status = Reporter(workspace, runtime_dir, store).write()
        print(json.dumps(status, indent=2) if args.json else f"CANA status written: {status['phase']}")
        return 0
    finally:
        store.close()


if __name__ == "__main__":
    raise SystemExit(main())
