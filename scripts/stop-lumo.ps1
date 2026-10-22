# 關閉在背景執行的光光：先關掉自動重開的迴圈，再關掉它底下的所有程式
param([switch]$Silent)

$all = Get-CimInstance Win32_Process
$loops = $all | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'lumo-loop\.bat' }

function Get-Tree($id) {
  $all | Where-Object { $_.ParentProcessId -eq $id } | ForEach-Object { $_.ProcessId; Get-Tree $_.ProcessId }
}

$stopped = $false
foreach ($loop in $loops) {
  $children = @(Get-Tree $loop.ProcessId)
  Stop-Process -Id $loop.ProcessId -Force -ErrorAction SilentlyContinue
  $children | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  $stopped = $true
}

if (-not $Silent) {
  Add-Type -AssemblyName PresentationFramework
  $msg = if ($stopped) { '光光已經下線了。' } else { '光光本來就沒有在執行。' }
  [System.Windows.MessageBox]::Show($msg, 'LUMO CHATBOT') | Out-Null
}
