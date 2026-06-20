import re
import os

color_map = {
    '#004f9e': 'var(--al-primary)',
    '#003d7a': 'var(--al-primary)',
    '#0891b2': 'var(--al-primary)',
    '#22d3ee': 'var(--al-secondary)',
    '#134e4a': 'var(--al-on-surface)',
    '#22c55e': 'var(--al-success)',
    '#28a745': 'var(--al-success)',
    '#218838': 'var(--al-success)',
    '#dc3545': 'var(--al-error)',
    '#bd2130': 'var(--al-error)',
    '#ffc107': 'var(--al-warning)',
    '#17a2b8': 'var(--al-info)',
    '#a6c9e2': 'var(--al-outline)',
    '#d3d3d3': 'var(--al-outline-variant)',
    '#ffffff': 'var(--al-surface)',
    '#f5f5f5': 'var(--al-surface-container)',
    '#eeeeee': 'var(--al-surface-container-high)',
    '#e5e5e5': 'var(--al-surface-container-highest)',
    '#333333': 'var(--al-text)',
    '#666666': 'var(--al-text-muted)',
    '#999999': 'var(--al-text-muted)',
    '#e0f0ff': 'var(--al-primary-container)',
    '#eef6ff': 'var(--al-tertiary-container)',
    '#f8d7da': 'var(--al-error-container)',
    '#721c24': 'var(--al-on-error-container)',
}

var_map = {
    '--vnpt-primary': '--al-primary',
    '--vnpt-primary-hover': '--al-primary',
    '--vnpt-secondary': '--al-secondary',
    '--vnpt-success': '--al-success',
    '--vnpt-warning': '--al-warning',
    '--vnpt-danger': '--al-error',
    '--vnpt-info': '--al-info',
    '--vnpt-glass-bg': '--al-surface',
    '--vnpt-glass-border': '--al-outline',
    '--vnpt-glass-shadow': '--al-shadow-md',
    '--vnpt-glass-blur': '--al-blur',
    '--vnpt-text-main': '--al-text',
    '--vnpt-text-muted': '--al-text-muted',
    '--vnpt-text-light': '--al-on-primary',
    '--vnpt-radius': '--al-radius-none',
    '--vnpt-spacing': '--al-space-150',
    '--vnpt-font': '--al-font',
    '--vnpt-ease': '--al-ease',
    
    '--his-primary': '--al-primary',
    '--his-primary-hover': '--al-primary',
    '--his-success': '--al-success',
    '--his-danger': '--al-error',
    '--his-bg-glass': '--al-surface',
    '--his-bg-secondary': '--al-surface-container-low',
    '--his-bg-tertiary': '--al-surface-container',
    '--his-text-primary': '--al-text',
    '--his-text-secondary': '--al-text-muted',
    '--his-border': '--al-outline',
    '--his-shadow': '--al-shadow-md',
    '--his-glass-shadow': '--al-shadow-none',
    '--his-lit-edge': '--al-shadow-none',
    '--his-warning': '--al-warning',
}

files = ['styles/aladinn-scanner.css', 'styles/aladinn-sign.css', 'styles/aladinn-voice.css']

for f_path in files:
    with open(f_path, 'r') as f:
        content = f.read()

    # replace hex colors
    for hex_code, var_name in color_map.items():
        content = re.compile(re.escape(hex_code), re.IGNORECASE).sub(var_name, content)
        
    # strip hardcoded hex colors that aren't mapped
    def repl_hex(m):
        hex_val = m.group(1).lower()
        if len(hex_val) == 4:
            hex_val = '#' + hex_val[1]*2 + hex_val[2]*2 + hex_val[3]*2
        return color_map.get(hex_val, m.group(0))
    content = re.sub(r'(#[0-9a-fA-F]{3,6})\b', repl_hex, content)

    # replace border-radius: XXpx; with 0px
    content = re.sub(r'border-radius:\s*[^;]+;', 'border-radius: 0px;', content)
    
    # replace vars
    for old_var, new_var in var_map.items():
        content = content.replace(old_var, new_var)
        
    with open(f_path, 'w') as f:
        f.write(content)
