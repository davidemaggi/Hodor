; Hodor: add the CLI folder to the user's PATH (per-user install, no admin) and remove it on uninstall.
; PowerShell edits the registry value directly, avoiding setx's 1024-character truncation.

!macro customInstall
  nsExec::ExecToLog `powershell -NoProfile -ExecutionPolicy Bypass -Command "$$d = '$INSTDIR\resources\bin'; $$p = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($$p -eq $$null) { $$p = '' }; $$parts = $$p -split ';' | Where-Object { $$_ -ne '' }; if ($$parts -notcontains $$d) { [Environment]::SetEnvironmentVariable('Path', (($$parts + $$d) -join ';'), 'User') }"`
!macroend

!macro customUnInstall
  nsExec::ExecToLog `powershell -NoProfile -ExecutionPolicy Bypass -Command "$$d = '$INSTDIR\resources\bin'; $$p = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($$p -ne $$null) { $$parts = $$p -split ';' | Where-Object { $$_ -ne '' -and $$_ -ne $$d }; [Environment]::SetEnvironmentVariable('Path', ($$parts -join ';'), 'User') }"`
!macroend
