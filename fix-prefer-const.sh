#!/bin/bash

# Fix specific prefer-const errors by finding let variables that are never reassigned
# and changing them to const

# Run eslint and capture prefer-const errors
npm run lint 2>&1 | grep "prefer-const" | while read -r line; do
    # Extract file path and line number
    if [[ $line =~ ^([^:]+):([0-9]+):([0-9]+) ]]; then
        file="${BASH_REMATCH[1]}"
        line_num="${BASH_REMATCH[2]}"
        
        echo "Fixing prefer-const in $file at line $line_num"
        
        # Read the specific line and replace let with const
        sed -i "${line_num}s/let \(_\w\+\)/const \1/g" "$file"
    fi
done

echo "Fixed prefer-const errors"