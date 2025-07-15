#!/bin/bash

# Fix the simplest unused variable cases
echo "Fixing simple unused variable patterns..."

# Pattern 1: Simple unused assignments that can be removed
# const _unused = value; -> // removed
find /workspaces/claude-code-flow/src -name "*.ts" -o -name "*.js" | while read file; do
    echo "Processing: $file"
    
    # Remove lines with unused variable assignments (simple cases)
    sed -i '/^[[:space:]]*const _[a-zA-Z][a-zA-Z0-9_]* = [^;]*;[[:space:]]*$/d' "$file"
    sed -i '/^[[:space:]]*let _[a-zA-Z][a-zA-Z0-9_]* = [^;]*;[[:space:]]*$/d' "$file"
    
done

echo "Fixed simple unused variable patterns."