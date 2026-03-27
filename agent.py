import os
import sys
import json
import re
import shutil
import difflib
import datetime
from pathlib import Path
from openai import OpenAI

CLIENT = OpenAI(
    base_url="https://api.gapgpt.app/v1",
    api_key=os.environ.get("GAPGPT_API_KEY", "")
)

PLANNER_MODEL = "claude-opus-4-6"
CODER_MODEL = "claude-opus-4-6"
PROJECT_PATH = Path(".")
BACKUP_DIR = Path("./.backups")

ALLOWED_EXTENSIONS = {".py", ".js", ".ts", ".tsx", ".jsx", ".php", ".go", ".java", ".html", ".css", ".scss", ".json", ".yaml", ".yml", ".toml", ".md", ".sql", ".sh", ".bat", ".rs", ".c", ".cpp", ".h", ".cs", ".rb", ".swift", ".kt", ".vue", ".svelte", ".dockerfile", ".xml", ".graphql", ".prisma"}

IGNORED_DIRS = {"node_modules", ".git", "__pycache__", "venv", ".venv", "env", "dist", "build", ".next", ".nuxt", "vendor", ".idea", ".vscode", "target", "bin", "obj", ".backups"}

MAX_FILE_SIZE = 100000
FENCE = chr(96) * 3

def scan_project():
    results = []
    for root, dirs, filenames in os.walk(PROJECT_PATH):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for fname in filenames:
            fpath = Path(root) / fname
            if fpath.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue
            try:
                fsize = fpath.stat().st_size
            except Exception:
                continue
            if fsize > MAX_FILE_SIZE:
                continue
            rel_path = str(fpath.relative_to(PROJECT_PATH))
            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                content = "[UNREADABLE]"
            results.append({"path": rel_path, "content": content, "size": fsize})
    return results

def create_backup(file_path):
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    rel = file_path.relative_to(PROJECT_PATH)
    backup_path = BACKUP_DIR / timestamp / rel
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(file_path, backup_path)
    return backup_path

def strip_code_fences(text):
    text = text.strip()
    lines = text.split("\n")
    if len(lines) >= 2 and lines[0].strip().startswith(FENCE) and lines[-1].strip() == FENCE:
        return "\n".join(lines[1:-1])
    return text

def generate_diff(old, new, filename):
    old_lines = old.splitlines(keepends=True)
    new_lines = new.splitlines(keepends=True)
    diff = difflib.unified_diff(old_lines, new_lines, fromfile="a/" + filename, tofile="b/" + filename, lineterm="")
    return "\n".join(diff)

def plan_changes(file_list, user_request):
    file_summary = []
    for f in file_list:
        preview = "\n".join(f["content"].split("\n")[:20])
        file_summary.append("FILE: " + f["path"] + " (" + str(f["size"]) + " bytes)\n" + preview + "\n---")
    file_summary_str = "\n".join(file_summary)
    system_prompt = "You are an expert coding agent planner. Analyze the request and determine which files to modify/create.\n\nRespond with ONLY valid JSON:\n{\n  \"plan\": \"description\",\n  \"edit_files\": [\"path/file.py\"],\n  \"create_files\": [\"path/new.py\"],\n  \"context_files\": [\"path/ref.py\"]\n}\n\nRules:\n- edit_files: files to MODIFY\n- create_files: files to CREATE\n- context_files: files for context only\n- Use exact paths\n- No explanation outside JSON"
    response = CLIENT.chat.completions.create(model=PLANNER_MODEL, temperature=0, messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": "Project files:\n\n" + file_summary_str + "\n\nRequest:\n" + user_request}])
    raw = response.choices[0].message.content.strip()
    raw = strip_code_fences(raw)
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            plan = json.loads(match.group())
        else:
            raise ValueError("Cannot parse: " + raw)
    plan.setdefault("plan", "")
    plan.setdefault("edit_files", [])
    plan.setdefault("create_files", [])
    plan.setdefault("context_files", [])
    return plan

def edit_file(file_path, user_request, current_code, context):
    context_section = ""
    if context:
        parts = []
        for cp, cc in context.items():
            parts.append("--- " + cp + " ---\n" + cc)
        context_section = "\nRelated files (DO NOT modify):\n\n" + "\n".join(parts) + "\n"
    system_prompt = "You are an expert coding agent. Modify source code precisely.\n\nRULES:\n1. Return ONLY complete modified file\n2. NO markdown fences\n3. NO explanation\n4. Return FULL file\n5. Preserve style\n6. Add imports if needed\n7. Minimal changes\n8. Syntactically correct"
    user_msg = "Request:\n" + user_request + "\n\n" + context_section + "\nFile: " + file_path + "\n\nCurrent:\n" + current_code + "\n\nReturn complete modified file:"
    response = CLIENT.chat.completions.create(model=CODER_MODEL, temperature=0, messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_msg}])
    return strip_code_fences(response.choices[0].message.content)

def create_file(file_path, user_request, context):
    context_section = ""
    if context:
        parts = []
        for cp, cc in context.items():
            parts.append("--- " + cp + " ---\n" + cc)
        context_section = "\nRelated files:\n\n" + "\n".join(parts) + "\n"
    system_prompt = "You are an expert coding agent. Create new files.\n\nRULES:\n1. Return ONLY file content\n2. NO markdown fences\n3. NO explanation\n4. Follow project style\n5. Include imports"
    user_msg = "Request:\n" + user_request + "\n\n" + context_section + "\nNew file: " + file_path + "\n\nReturn complete file:"
    response = CLIENT.chat.completions.create(model=CODER_MODEL, temperature=0, messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_msg}])
    return strip_code_fences(response.choices[0].message.content)

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def print_colored_diff(diff_text):
    for line in diff_text.split("\n"):
        if line.startswith("+") and not line.startswith("+++"):
            print(GREEN + line + RESET)
        elif line.startswith("-") and not line.startswith("---"):
            print(RED + line + RESET)
        elif line.startswith("@@"):
            print(CYAN + line + RESET)
        else:
            print(line)

def print_header(text):
    print("\n" + BOLD + BLUE + "=" * 60 + "\n  " + text + "\n" + "=" * 60 + RESET + "\n")

def print_step(step, text):
    print(BOLD + YELLOW + "[" + step + "]" + RESET + " " + text)

def main():
    print_header("AI Coding Agent - Full Access")
    if not PROJECT_PATH.exists():
        print("ERROR: Project folder not found: " + str(PROJECT_PATH))
        sys.exit(1)
    print_step("1/5", "Scanning...")
    project_files = scan_project()
    print("     Found " + str(len(project_files)) + " files\n")
    if not project_files:
        print("ERROR: No files found")
        sys.exit(1)
    for f in project_files:
        print("     - " + f["path"] + " (" + str(f["size"]) + " bytes)")
    print()
    user_request = input(BOLD + "Command: " + RESET)
    if not user_request.strip():
        print("ERROR: Empty")
        sys.exit(1)
    print_step("2/5", "Planning...")
    try:
        plan = plan_changes(project_files, user_request)
    except Exception as e:
        print("ERROR: " + str(e))
        sys.exit(1)
    print("\n     Plan: " + plan["plan"])
    print("     Edit: " + str(plan["edit_files"]))
    print("     Create: " + str(plan["create_files"]))
    print("     Context: " + str(plan["context_files"]))
    if not plan["edit_files"] and not plan["create_files"]:
        print("\n  No changes")
        sys.exit(0)
    print()
    confirm = input(BOLD + "Continue? (y/n): " + RESET).strip().lower()
    if confirm not in ("y", "yes"):
        print("Cancelled")
        sys.exit(0)
    context_contents = {}
    for cf in plan.get("context_files", []):
        cf_path = PROJECT_PATH / cf
        if cf_path.exists():
            try:
                context_contents[cf] = cf_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                pass
    edit_contents = {}
    for ef in plan["edit_files"]:
        ef_path = PROJECT_PATH / ef
        if ef_path.exists():
            try:
                edit_contents[ef] = ef_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                pass
    all_context = {}
    all_context.update(context_contents)
    all_context.update(edit_contents)
    print_step("3/5", "Editing...")
    changes = []
    for file_rel in plan["edit_files"]:
        file_abs = PROJECT_PATH / file_rel
        if not file_abs.exists():
            print("     WARNING: Not found: " + file_rel)
            continue
        old_code = file_abs.read_text(encoding="utf-8", errors="ignore")
        file_context = {k: v for k, v in all_context.items() if k != file_rel}
        print("     Processing: " + file_rel)
        try:
            new_code = edit_file(file_rel, user_request, old_code, file_context)
        except Exception as e:
            print("     ERROR: " + str(e))
            continue
        if new_code.strip() == old_code.strip():
            print("     No changes: " + file_rel)
            continue
        changes.append({"type": "edit", "path": file_rel, "abs_path": file_abs, "old": old_code, "new": new_code})
    print_step("4/5", "Creating...")
    for file_rel in plan.get("create_files", []):
        file_abs = PROJECT_PATH / file_rel
        if file_abs.exists():
            print("     WARNING: Exists: " + file_rel)
            continue
        print("     Creating: " + file_rel)
        try:
            new_code = create_file(file_rel, user_request, all_context)
        except Exception as e:
            print("     ERROR: " + str(e))
            continue
        changes.append({"type": "create", "path": file_rel, "abs_path": file_abs, "old": "", "new": new_code})
    if not changes:
        print("\n  No changes")
        sys.exit(0)
    print_step("5/5", "Reviewing...\n")
    for change in changes:
        icon = "[EDIT]" if change["type"] == "edit" else "[NEW]"
        print(BOLD + icon + "  " + change["path"] + RESET)
        diff = generate_diff(change["old"], change["new"], change["path"])
        if diff:
            print_colored_diff(diff)
        else:
            print("     [New - " + str(len(change["new"].splitlines())) + " lines]")
        print()
    final = input(BOLD + YELLOW + "Apply " + str(len(changes)) + " change(s)? (y/n): " + RESET).strip().lower()
    if final not in ("y", "yes"):
        print("Cancelled")
        sys.exit(0)
    for change in changes:
        file_abs = change["abs_path"]
        if change["type"] == "edit":
            backup = create_backup(file_abs)
            print("     Backup: " + str(backup))
        file_abs.parent.mkdir(parents=True, exist_ok=True)
        file_abs.write_text(change["new"], encoding="utf-8")
        print("     " + ("UPDATED" if change["type"] == "edit" else "CREATED") + ": " + change["path"])
    print_header("Success!")
    print("   Backups: " + str(BACKUP_DIR) + "\n")

if __name__ == "__main__":
    main()
