# Combines draco_decoder.js and ../three/addons/loaders/DRACOLoader.js DRACOWorker to single file
# So it can be loaded directly instead of from a blob (which seems not allowed in Firefox Extensions)
Set-Content draco_worker.js "/* draco decoder */"
Get-Content draco_decoder.js -Raw | Add-Content draco_worker.js
Add-Content draco_worker.js "`n/* worker */"
$content = Get-Content ../three/addons/loaders/DRACOLoader.js -Raw
if ($content -match '(?s)function\s+DRACOWorker\(\)\s*\{(.*)\}\s*export') {
    $matches[1] | Add-Content draco_worker.js
}