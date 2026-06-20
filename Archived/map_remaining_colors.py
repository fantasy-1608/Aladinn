import re

extra_map = {
    # blues
    '#007bff': 'var(--al-primary)',
    '#1a56db': 'var(--al-primary)',
    '#1e5494': 'var(--al-primary)',
    '#2563a8': 'var(--al-primary)',
    '#d2e3fc': 'var(--al-primary-container)',
    '#e3f2fd': 'var(--al-primary-container)',
    '#90caf9': 'var(--al-outline)',
    '#9ECAFF': 'var(--al-primary)',
    '#60A5FA': 'var(--al-primary)',
    '#e6f2ff': 'var(--al-primary-container)',
    '#e8f4fd': 'var(--al-primary-container)',
    '#003258': 'var(--al-on-primary-container)',
    
    # reds/errors
    '#e74c3c': 'var(--al-error)',
    '#fef2f2': 'var(--al-error-container)',
    '#ef4444': 'var(--al-error)',
    '#fff5f5': 'var(--al-error-container)',
    '#ffc9c9': 'var(--al-error-container)',
    '#c92a2a': 'var(--al-error)',
    '#fa5252': 'var(--al-error)',
    '#dc2626': 'var(--al-error)',
    '#ffebee': 'var(--al-error-container)',
    '#ef9a9a': 'var(--al-error-container)',
    '#c62828': 'var(--al-error)',
    
    # greens/success
    '#2ecc71': 'var(--al-success)',
    '#099268': 'var(--al-success)',
    '#10b981': 'var(--al-success)',
    '#4ADE80': 'var(--al-success)',
    '#1e7e34': 'var(--al-success)',
    '#e6fcf5': 'var(--al-success-bg)',
    '#ebfbee': 'var(--al-success-bg)',
    '#c3fae8': 'var(--al-success-bg)',
    '#eafaf1': 'var(--al-success-bg)',
    
    # yellows/warnings
    '#d97706': 'var(--al-warning)',
    '#fffbeb': 'var(--al-warning-bg)',
    '#fde68a': 'var(--al-warning-bg)',
    '#fff3cd': 'var(--al-warning-bg)',
    '#ffeb3b': 'var(--al-warning)',
    '#fef9e7': 'var(--al-warning-bg)',
    '#fff4e6': 'var(--al-warning-bg)',
    '#d9480f': 'var(--al-warning)',
    '#ffd8a8': 'var(--al-warning-bg)',
    '#fff8e1': 'var(--al-warning-bg)',
    '#ffe082': 'var(--al-warning-bg)',
    '#ff8f00': 'var(--al-warning)',
    
    # grays/surfaces/text
    '#95a5a6': 'var(--al-text-muted)',
    '#475569': 'var(--al-text-muted)',
    '#e5e7eb': 'var(--al-surface-container)',
    '#ddd': 'var(--al-outline-variant)',
    '#dddddd': 'var(--al-outline-variant)',
    '#cccccc': 'var(--al-outline-variant)',
    '#555': 'var(--al-text-muted)',
    '#C2C6D2': 'var(--al-text-muted)',
    '#f8f9fa': 'var(--al-surface-container-low)',
    '#f1f3f5': 'var(--al-surface-container)',
    '#495057': 'var(--al-text)',
    '#868e96': 'var(--al-text-muted)',
    '#adb5bd': 'var(--al-text-muted)',
    '#e0e0e0': 'var(--al-surface-container-high)',
    '#f8fafc': 'var(--al-surface)',
    '#E1E2E8': 'var(--al-text-muted)',
    '#f9f9f9': 'var(--al-surface-container)',
    
    # purples
    '#a78bfa': 'var(--al-tertiary)',
    '#f3e5f5': 'var(--al-tertiary-container)',
    '#ce93d8': 'var(--al-tertiary-container)',
    '#6a1b9a': 'var(--al-tertiary)',
}

files = ['styles/aladinn-scanner.css', 'styles/aladinn-sign.css', 'styles/aladinn-voice.css']

for f_path in files:
    with open(f_path, 'r') as f:
        content = f.read()

    def repl(m):
        hex_val = m.group(1)
        if len(hex_val) == 4:
            hex_val = '#' + hex_val[1]*2 + hex_val[2]*2 + hex_val[3]*2
        
        # Case insensitive match
        for k, v in extra_map.items():
            if k.lower() == hex_val.lower():
                return v
        return m.group(0)

    content = re.sub(r'(#[0-9a-fA-F]{3,6})\b', repl, content)
        
    with open(f_path, 'w') as f:
        f.write(content)
