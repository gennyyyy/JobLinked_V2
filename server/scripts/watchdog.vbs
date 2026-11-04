' Hidden launcher for watchdog.ps1: wscript.exe runs it with no console window,
' so the scheduled task tick every minute never flashes a terminal.
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ps1 = fso.GetParentFolderName(WScript.ScriptFullName) & "\watchdog.ps1"
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & ps1 & """", 0, False
