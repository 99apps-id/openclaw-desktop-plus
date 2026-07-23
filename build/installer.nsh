; NSIS custom script — included via electron-builder nsis.include (keep this file in Git).
;
; 1) Before uninstall, if the main exe still exists, run --clear-login-item.
; 2) Between the install-dir page and "Installing", validate that the final install
;    path leaf folder name contains no spaces (same idea as assistedInstaller.nsh
;    instFilesPre: append APP_FILENAME when missing, then check).
;    This rejects e.g. ...\OpenClaw Desktop Plus while still allowing Program Files
;    (spaces in a parent folder are OK).
;
; electron-builder runs makensis again for the uninstaller with BUILD_UNINSTALLER;
; that pass does not insert Page custom — defining PathValidate* there triggers
; warning 6010 (fatal under -WX). Install pages/functions are install-only.
;
; Do not !include "StrContains.nsh": assistedInstaller.nsh already includes it.

!macro customUnInit
  IfFileExists "$INSTDIR\OpenClaw Desktop Plus.exe" 0 +3
  ExecWait '"$INSTDIR\OpenClaw Desktop Plus.exe" --clear-login-item' $0
  Goto clear_login_item_done
  IfFileExists "$INSTDIR\OpenClaw Desktop.exe" 0 clear_login_item_done
  ExecWait '"$INSTDIR\OpenClaw Desktop.exe" --clear-login-item' $0
  clear_login_item_done:
!macroend

!macro customPageAfterChangeDir
  !ifndef BUILD_UNINSTALLER
    Page custom PathValidateShow PathValidateLeave
  !endif
!macroend

!ifndef BUILD_UNINSTALLER

; No UI: validation runs on Leave only (avoids double-including nsDialogs.nsh with MUI).
Function PathValidateShow
  IfSilent path_validate_show_skip
path_validate_show_skip:
FunctionEnd

; Equivalent to ${StrContains} $R3 "${APP_FILENAME}" $R9 — non-empty $R3 means found ("1").
Function PathValidateLeave
  StrCpy $R9 "$INSTDIR"
  StrCpy $R3 ""
  StrLen $R4 "${APP_FILENAME}"
  StrLen $R5 $R9
  IntCmp $R4 0 path_has_app_done
  IntCmp $R5 0 path_has_app_done
  IntOp $R6 $R5 - $R4
  IntCmp $R6 -1 path_has_app_done path_has_app_done +1
  StrCpy $R7 0
  IntOp $R8 $R6 + 1
path_has_app_loop:
  StrCpy $0 $R9 $R4 $R7
  StrCmp $0 "${APP_FILENAME}" path_has_app_found
  IntOp $R7 $R7 + 1
  IntCmp $R7 $R8 path_has_app_done path_has_app_loop path_has_app_done
path_has_app_found:
  StrCpy $R3 "1"
path_has_app_done:
  StrCmp $R3 "" append_app_subdir
  Goto after_append_app_subdir
append_app_subdir:
  StrCpy $R9 "$R9\${APP_FILENAME}"
after_append_app_subdir:
  StrLen $0 $R9
  IntCmp $0 0 path_validate_ok
  IntOp $1 $0 - 1
  StrCpy $2 $R9 1 $1
  StrCmp $2 "\" 0 +3
  StrCpy $R9 $R9 $1
  Push $R9
  Call GetLeafSegment
  Pop $R0
  StrCmp $R0 "" path_validate_ok
  Push $R0
  Call StrHasSpace
  Pop $R1
  IntCmp $R1 0 path_validate_ok
  MessageBox MB_OK|MB_ICONEXCLAMATION "The install folder name cannot contain spaces.$\n$\nUse e.g. OpenClawDesktopPlus instead of OpenClaw Desktop Plus."
  Abort
path_validate_ok:
FunctionEnd

Function GetLeafSegment
  Pop $R9
  Push $R6
  Push $R7
  Push $R8
  StrCpy $R6 ""
  StrCpy $R7 0
leafloop:
  StrCpy $R8 $R9 1 $R7
  StrCmp $R8 "" leafdone
  StrCmp $R8 "\" leafreset
  StrCpy $R6 "$R6$R8"
  IntOp $R7 $R7 + 1
  Goto leafloop
leafreset:
  StrCpy $R6 ""
  IntOp $R7 $R7 + 1
  Goto leafloop
leafdone:
  StrCpy $R9 $R6
  Pop $R8
  Pop $R7
  Pop $R6
  Push $R9
FunctionEnd

Function StrHasSpace
  Pop $0
  Push $1
  Push $2
  StrCpy $1 0
spaceloop:
  StrCpy $2 $0 1 $1
  StrCmp $2 "" space_no
  StrCmp $2 " " space_yes
  StrCmp $2 "$\t" space_yes
  IntOp $1 $1 + 1
  Goto spaceloop
space_yes:
  StrCpy $0 1
  Goto space_out
space_no:
  StrCpy $0 0
space_out:
  Pop $2
  Pop $1
  Push $0
FunctionEnd

!endif
