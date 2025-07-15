#!/bin/bash

# Comprehensive linting fix script
echo "Starting comprehensive linting fixes..."

# Step 1: Fix numeric separator issues (already mostly done)
echo "Step 1: Fixing remaining numeric separators..."
find /workspaces/claude-code-flow/src -name "*.ts" -o -name "*.js" | while read file; do
    # Fix any remaining _number patterns
    sed -i 's/\b_\([0-9]\+\)\b/\1/g' "$file"
    # Fix decimal patterns like 0._9
    sed -i 's/0\._\([0-9]\+\)/0.\1/g' "$file"
done

# Step 2: Fix prefer-const issues by finding 'let' that should be 'const'
echo "Step 2: Fixing prefer-const issues..."
find /workspaces/claude-code-flow/src -name "*.ts" -o -name "*.js" | while read file; do
    # Change let _variable to const _variable (underscore prefixed unused vars)
    sed -i 's/let \(_[a-zA-Z][a-zA-Z0-9_]*\) =/const \1 =/g' "$file"
done

# Step 3: Remove problematic unused variable assignments
echo "Step 3: Removing assignments to unused variables..."
find /workspaces/claude-code-flow/src -name "*.ts" -o -name "*.js" | while read file; do
    # Convert assignments to unused variables to just the expression
    # Example: const _unused = expensive(); becomes expensive();
    sed -i 's/const _[a-zA-Z][a-zA-Z0-9_]* = \([^;]*\);/\1;/g' "$file"
    sed -i 's/let _[a-zA-Z][a-zA-Z0-9_]* = \([^;]*\);/\1;/g' "$file"
done

echo "Comprehensive fixes completed."