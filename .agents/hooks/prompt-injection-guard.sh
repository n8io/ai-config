#!/bin/bash
# Prompt injection guard — runs on UserPromptSubmit.
# Detects attempts to override Claude's instructions via injected text.
# Exit 2 = block prompt; exit 0 = allow.

input=$(cat)
prompt=$(printf '%s' "$input" | jq -r '.prompt // ""' 2>/dev/null)

# If parsing fails or prompt is empty, allow through (fail open)
[ -z "$prompt" ] && exit 0

# Classic prompt injection patterns — attempts to override instructions
INJECTION_PATTERN='(ignore (all |your )?(previous|prior|above|earlier) (instructions?|prompt|rules?|guidelines?|constraints?))'\
'|(disregard (all |your )?(previous|prior|above|earlier) (instructions?|prompt|rules?|guidelines?))'\
'|(forget (all )?(your )?(previous|prior) (instructions?|prompt|rules?|guidelines?))'\
'|(your (new|updated|actual|real|true) (system |)instructions? (are|is|:))'\
'|(new system prompt\s*:)'\
'|(override (all |your )?(previous|prior|safety|ethical) (rules?|guidelines?|instructions?|restrictions?))'\
'|(pretend (you have no|there are no) (restrictions?|constraints?|rules?|guidelines?|safety))'\
'|(you are now (a |an )?(different|new|unrestricted|jailbroken|uncensored) (ai|model|assistant|bot))'\
'|(act as (a |an )?(DAN|jailbroken|unrestricted|uncensored) (ai|model|assistant|bot|version))'\
'|(\bDAN\b.{0,40}(mode|enabled|activated|prompt))'\
'|((ADMIN|SYSTEM|ROOT) ?(OVERRIDE|ACCESS|COMMAND)\s*:)'\
'|(</?(system|assistant|human|prompt)>\s*(ignore|forget|new|override|your))'

if printf '%s' "$prompt" | grep -qiE "$INJECTION_PATTERN"; then
    echo "SECURITY: Prompt injection attempt detected — contains patterns that try to override Claude's instructions. If this is legitimate, rephrase your request." >&2
    exit 2
fi

exit 0
