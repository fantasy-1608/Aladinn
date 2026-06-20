import re

files = ['styles/aladinn-scanner.css', 'styles/aladinn-sign.css', 'styles/aladinn-voice.css']
patterns_to_extract = [
    r'(?:\/\*.*?\*\/[\s]*)*(?:\.[a-zA-Z0-9_-]*(?:btn|panel|input)[a-zA-Z0-9_-]*(?:\s*::?[a-zA-Z0-9_-]+)*\s*(?:,\s*\.[a-zA-Z0-9_-]*(?:btn|panel|input)[a-zA-Z0-9_-]*(?:\s*::?[a-zA-Z0-9_-]+)*)*)\s*\{[^}]*\}',
]

extracted_blocks = []

for f_path in files:
    with open(f_path, 'r') as f:
        content = f.read()

    # Find blocks using a balanced brace approach because regex can fail on nested braces, 
    # but CSS classes without media queries usually don't have nested braces.
    # Let's write a simple parser instead of regex.
    lines = content.split('\n')
    new_lines = []
    i = 0
    in_target_block = False
    brace_level = 0
    current_block = []
    
    while i < len(lines):
        line = lines[i]
        
        # very simple heuristic: if line starts with .his-btn, .vnpt-btn, .al-btn, .his-input, .his-panel etc
        # we start extraction
        if brace_level == 0 and re.match(r'^[\s]*\.(his|vnpt|al)-(btn|input|panel|toast|glass)', line):
            in_target_block = True
            
        if in_target_block:
            current_block.append(line)
            brace_level += line.count('{') - line.count('}')
            if brace_level == 0:
                in_target_block = False
                extracted_blocks.append('\n'.join(current_block))
                current_block = []
        else:
            new_lines.append(line)
        i += 1
        
    with open(f_path, 'w') as f:
        f.write('\n'.join(new_lines))

with open('styles/aladinn-components.css', 'a') as f:
    f.write('\n\n/* ── Extracted Components ── */\n')
    f.write('\n\n'.join(extracted_blocks))
