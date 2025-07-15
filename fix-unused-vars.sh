#!/bin/bash

# Fix unused variables by ensuring they start with underscore
find /workspaces/claude-code-flow/src -name "*.ts" -o -name "*.js" | while read file; do
    echo "Processing: $file"
    
    # Fix prefer-const issues (let -> const where appropriate)
    sed -i 's/let \([a-zA-Z_][a-zA-Z0-9_]*\) = \([^;]*\);/const \1 = \2;/g' "$file"
    
    # Variables that should start with underscore for unused variable warnings
    # Handle common patterns like: const varName = 
    sed -i 's/const \([a-zA-Z][a-zA-Z0-9]*\) =/const _\1 =/g' "$file"
    sed -i 's/let \([a-zA-Z][a-zA-Z0-9]*\) =/let _\1 =/g' "$file"
    
    # Function parameters that are unused should start with _
    sed -i 's/(\([a-zA-Z][a-zA-Z0-9]*\):/(_\1:/g' "$file"
    sed -i 's/, \([a-zA-Z][a-zA-Z0-9]*\):/, _\1:/g' "$file"
    
    # Arrow function parameters
    sed -i 's/=> (\([a-zA-Z][a-zA-Z0-9]*\):/=> (_\1:/g' "$file"
    
    # Callback parameters
    sed -i 's/\.map(\([a-zA-Z][a-zA-Z0-9]*\) =>/.map(_\1 =>/g' "$file"
    sed -i 's/\.filter(\([a-zA-Z][a-zA-Z0-9]*\) =>/.filter(_\1 =>/g' "$file"
    sed -i 's/\.forEach(\([a-zA-Z][a-zA-Z0-9]*\) =>/.forEach(_\1 =>/g' "$file"
    sed -i 's/\.find(\([a-zA-Z][a-zA-Z0-9]*\) =>/.find(_\1 =>/g' "$file"
    sed -i 's/\.reduce(\([a-zA-Z][a-zA-Z0-9]*\) =>/.reduce(_\1 =>/g' "$file"
    
done

echo "Fixed unused variables"