# Root folder containing three.module.js
$threeModulePath = "../three.module.js"  # relative to rootFolder

# Recursively get all .js files in subfolders
Get-ChildItem -Path . -Recurse -Filter "*.js" | ForEach-Object {
    $file = $_.FullName
    # Skip the main three.module.js itself
    if ($_.Name -eq $threeModulePath) { return }

    # Compute relative path from the JS file to three.module.js
    $fileDir = Split-Path $file -Parent
    $relativePath = Resolve-Path "$fileDir\$threeModulePath" -Relative

    # Adjust path to be suitable for import (forward slashes)
    $relativePath = $relativePath -replace '\\','/'

    Write-Host "Processing $file → relative path: $relativePath"

    # Read file content
    $content = Get-Content $file -Raw

    # Replace from 'three' with the computed relative path
    $newContent = $content -replace "from 'three'", "from '$relativePath'"

    # Overwrite file
    Set-Content -Path $file -Value $newContent
}
