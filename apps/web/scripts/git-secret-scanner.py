import os
import re
import subprocess
import sys

print("[SCAN] RUNNING SECURE GIT HISTORY AND SECRET INCIDENT SCANNER...")
failed = False

# Define match pattern for OpenRouter API keys
KEY_PATTERN = re.compile(r"sk-or-v1-[a-fA-F0-9]{64}")

# 1. Scan gitignore for secret file configurations
print("\n[STEP 1] Checking .gitignore for credential exclusions...")
gitignore_path = ".gitignore"
if os.path.exists(gitignore_path):
    with open(gitignore_path, "r", encoding="utf-8") as f:
        git_content = f.read()
    ignored_patterns = [".env", ".env.local", "governor_state.db", "*.db"]
    for pat in ignored_patterns:
        if pat in git_content:
            print(f"  PASS: '{pat}' is covered in .gitignore.")
        else:
            print(f"  FAIL: '{pat}' is NOT properly ignored in .gitignore.")
            failed = True
else:
    print("  FAIL: .gitignore file not found in root.")
    failed = True

# 2. Check current working tree files (excluding node_modules, .git, .next)
print("\n[STEP 2] Scanning current tracked files for plaintext secrets...")
exposed_keys = []
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", ".next", "dist", "build"]]
    for file in files:
        if file.endswith((".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml")):
            fpath = os.path.join(root, file)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                matches = KEY_PATTERN.findall(content)
                for m in matches:
                    exposed_keys.append(fpath)
                    print(f"  WARNING: OpenRouter API key detected in: {fpath}")
            except Exception as e:
                pass

if not exposed_keys:
    print("  PASS: No plaintext keys found in current tracking code repository paths.")
else:
    failed = True

# 3. Scan full git commit history log for key leaks
print("\n[STEP 3] Scanning full Git history for committed secret patterns...")
history_leaks = []
try:
    res = subprocess.run(
        ["git", "log", "-p", "--all"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    if res.returncode == 0:
        log_content = res.stdout
        matches = KEY_PATTERN.findall(log_content)
        lines = log_content.splitlines()
        current_commit = "unknown"
        for line in lines:
            if line.startswith("commit "):
                current_commit = line.partition(" ")[2].strip()
            key_matches = KEY_PATTERN.findall(line)
            for km in key_matches:
                history_leaks.append(current_commit)
                print(f"  INCIDENT: OpenRouter API key leaked in commit: {current_commit[:12]}")
    else:
        print("  Notice: Not a git repository or git command failed.")
        failed = True
except Exception as e:
    print(f"  Error running git scanner: {e}")
    failed = True

print("\n--- INCIDENT SCAN COMPLETE ---")
if not history_leaks:
    print("Git history is completely clean of OpenRouter secret leaks!")
else:
    print(f"ALERT: Leaked keys detected in {len(history_leaks)} locations in Git log. Revocation required!")
    failed = True

if failed:
    print("RESULT: FAIL - secret incident remediation is required.")
    sys.exit(1)

print("RESULT: PASS")
