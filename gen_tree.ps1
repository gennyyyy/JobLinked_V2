# gen_tree.ps1 — regenerate the repo file-tree listing in the docs/arch/file-tree.md format.
#   ./gen_tree.ps1                 # prints the tree
#   ./gen_tree.ps1 -Out out.txt    # writes to a file
# Excludes node_modules / .git by default; pass -Exclude name1,name2 for more.

[CmdletBinding()]
param(
  [string]$Out,
  [string[]]$Exclude = @(),
  [string]$Root = (Get-Location).Path
)

$script:excludedNames = @('node_modules', '.git') + $Exclude
$script:lines = New-Object System.Collections.Generic.List[string]

function Add-Branch([System.IO.DirectoryInfo]$Dir, [string]$Prefix, [bool]$IsLast) {
  $kids = @(Get-ChildItem -Force -LiteralPath $Dir.FullName |
    Where-Object { $script:excludedNames -notcontains $_.Name } |
    Sort-Object @{ Expression = { $_.PSIsContainer }; Descending = $true },
                 @{ Expression = { $_.Name.ToLower() } })

  for ($i = 0; $i -lt $kids.Count; $i++) {
    $last = $i -eq $kids.Count - 1
    $marker = if ($last) { '+--' } else { '|--' }
    $script:lines.Add("${Prefix}${marker} $($kids[$i].Name)")
    if ($kids[$i].PSIsContainer) {
      $childPrefix = "${Prefix}|   "
      if ($last) { $childPrefix = "$Prefix    " }
      Add-Branch -Dir $kids[$i] -Prefix $childPrefix -IsLast $last
    }
  }
}

Push-Location $Root
try {
  Add-Branch -Dir (Get-Item $Root) -Prefix '' -IsLast $true
  $text = ($script:lines -join [Environment]::NewLine)
  if ($Out) { Set-Content -Path $Out -Value $text -Encoding utf8 }
  else { Write-Output $text }
}
finally { Pop-Location }
