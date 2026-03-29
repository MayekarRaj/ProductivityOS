#!/bin/bash
# UserPromptSubmit hook — reads prompt, matches against skill-rules.json, suggests relevant skills
# Outputs suggestion banners to stderr (Claude sees them before responding)

INPUT=$(cat)
RULES_FILE="$CLAUDE_PROJECT_DIR/.claude/skills/skill-rules.json"

if [ ! -f "$RULES_FILE" ]; then
  exit 0
fi

python3 - <<EOF
import json, re, sys

try:
    input_data = json.loads("""$INPUT""".replace('\\n', ' ').replace('"', '\\"') if False else open('/dev/stdin').read() if False else '''$INPUT''')
    prompt = input_data.get('prompt', '').lower()
except:
    sys.exit(0)

try:
    with open('$RULES_FILE') as f:
        data = json.load(f)
except:
    sys.exit(0)

suggestions = []
skills = data.get('skills', {})

priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
badges = {
    'critical': '⚠️  CRITICAL (REQUIRED)',
    'high':     '📚 RECOMMENDED',
    'medium':   '💡 SUGGESTED',
    'low':      '📌 OPTIONAL'
}

for skill_name, config in skills.items():
    triggers = config.get('promptTriggers', {})
    keywords = triggers.get('keywords', [])
    patterns = triggers.get('intentPatterns', [])
    matched = False

    for kw in keywords:
        if kw.lower() in prompt:
            matched = True
            break

    if not matched:
        for pattern in patterns:
            if re.search(pattern, prompt, re.IGNORECASE):
                matched = True
                break

    if matched:
        priority = config.get('priority', 'medium')
        suggestions.append((skill_name, priority))

suggestions.sort(key=lambda x: priority_order.get(x[1], 99))

if suggestions:
    print('\n' + '─' * 55, file=sys.stderr)
    for skill_name, priority in suggestions:
        badge = badges.get(priority, '💡 SUGGESTED')
        print(f'  {badge}: /{skill_name}', file=sys.stderr)
    print('─' * 55 + '\n', file=sys.stderr)
EOF
