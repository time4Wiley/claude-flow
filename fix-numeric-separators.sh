#!/bin/bash

# Fix malformed numeric separators in TypeScript and JavaScript files
find /workspaces/claude-code-flow/src -name "*.ts" -o -name "*.js" | while read file; do
    echo "Processing: $file"
    
    # Fix numeric separators like 0._9 -> 0.9
    sed -i 's/0\._\([0-9]\)/0.\1/g' "$file"
    
    # Fix standalone underscored numbers like _true -> true, _false -> false
    sed -i 's/: _true/: true/g' "$file"
    sed -i 's/: _false/: false/g' "$file"
    sed -i 's/(_true)/(true)/g' "$file"
    sed -i 's/(_false)/(false)/g' "$file"
    sed -i 's/, _true/, true/g' "$file"
    sed -i 's/, _false/, false/g' "$file"
    
    # Fix numeric literals like _5 -> 5, _1024 -> 1024, etc.
    sed -i 's/: _\([0-9][0-9]*\)/: \1/g' "$file"
    sed -i 's/(_\([0-9][0-9]*\))/(\1)/g' "$file"
    sed -i 's/, _\([0-9][0-9]*\)/, \1/g' "$file"
    sed -i 's/\* _\([0-9][0-9]*\)/* \1/g' "$file"
    
    # Fix variable assignments like _null -> null
    sed -i 's/, _null/, null/g' "$file"
    sed -i 's/: _null/: null/g' "$file"
    
    # Fix underscored identifiers in specific contexts
    sed -i 's/_string/string/g' "$file"
    sed -i 's/_number/number/g' "$file"
    sed -i 's/_boolean/boolean/g' "$file"
done

echo "Fixed numeric separators in all TypeScript and JavaScript files"