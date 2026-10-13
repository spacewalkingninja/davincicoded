param(
  [Parameter(Mandatory=$true)][ValidateSet('dock','restore')][string]$Action,
  [double]$Fraction = 0.2,
  [string]$StateFile = "$env:TEMP\opencode-terminal-dock.json",
  [string]$ProcessName = 'Resolve'
)

# Moves / restores the DaVinci Resolve main window so the OpenCode panel can sit
# beside it without overlap. Emits a one-line JSON result on stdout.

Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public class Win {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@

try { [Win]::SetProcessDPIAware() | Out-Null } catch {}

$SW_RESTORE  = 9
$SW_MAXIMIZE = 3
$SWP_NOZORDER   = 0x0004
$SWP_NOACTIVATE = 0x0010
$FLAGS = ($SWP_NOZORDER -bor $SWP_NOACTIVATE)

$proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $proc) { Write-Output '{"ok":false,"error":"resolve window not found"}'; exit 0 }
$h = $proc.MainWindowHandle

if ($Action -eq 'dock') {
  $zoomed = [Win]::IsZoomed($h)
  if ($zoomed) { [Win]::ShowWindow($h, $SW_RESTORE) | Out-Null; Start-Sleep -Milliseconds 350 }
  $r = New-Object RECT
  [Win]::GetWindowRect($h, [ref]$r) | Out-Null
  $w  = $r.Right - $r.Left
  $ht = $r.Bottom - $r.Top
  @{ left=$r.Left; top=$r.Top; width=$w; height=$ht; zoomed=$zoomed } | ConvertTo-Json -Compress | Set-Content -Path $StateFile -Encoding UTF8
  $newW = [int][Math]::Round($w * (1.0 - $Fraction))
  [Win]::SetWindowPos($h, [IntPtr]::Zero, $r.Left, $r.Top, $newW, $ht, $FLAGS) | Out-Null
  @{ ok=$true; left=$r.Left; top=$r.Top; width=$w; height=$ht; newWidth=$newW } | ConvertTo-Json -Compress | Write-Output
  exit 0
}

if ($Action -eq 'restore') {
  if (-not (Test-Path $StateFile)) { Write-Output '{"ok":false,"error":"no state"}'; exit 0 }
  $state = Get-Content $StateFile -Raw | ConvertFrom-Json
  if ($state.zoomed) {
    [Win]::ShowWindow($h, $SW_MAXIMIZE) | Out-Null
  } else {
    [Win]::SetWindowPos($h, [IntPtr]::Zero, [int]$state.left, [int]$state.top, [int]$state.width, [int]$state.height, $FLAGS) | Out-Null
  }
  Remove-Item $StateFile -Force -ErrorAction SilentlyContinue
  Write-Output '{"ok":true}'
  exit 0
}
