# Measures TCP connect time to the deployed ReFound API, for the "Region and location"
# section of Docs/responsibility-map.md. Run it on campus Wi-Fi:
#   powershell -ExecutionPolicy Bypass -File Docs/measure-connect.ps1 https://refound-api.onrender.com
param([Parameter(Mandatory = $true)][string]$Url)

$target = $Url.TrimEnd('/') + '/api/health'

# Free services sleep after 15 minutes idle. Wake it first so we time the network, not the cold start.
Write-Host "Warming up $target ..."
curl.exe -s -o NUL --max-time 90 $target

$times = 1..5 | ForEach-Object {
  [double](curl.exe -s -o NUL -w "%{time_connect}" $target)
}
$sorted = $times | Sort-Object
$median = $sorted[2]

Write-Host ""
Write-Host ("Runs (s): " + ($times -join ", "))
Write-Host ("Median connect time: {0:N3} s" -f $median)
Write-Host ""
Write-Host "Paste into the map:"
Write-Host ("**Result: ``{0:N3}`` s** (median of 5, campus Wi-Fi, {1})." -f $median, (Get-Date -Format "yyyy-MM-dd"))
