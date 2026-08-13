; installer.nsh — include via electron-builder’s nsis.include

; Remove an extension mapping only when it still belongs to MarkText-ja.
; This prevents uninstalling MarkText-ja from deleting another editor's
; association after the user has changed the default application.
!macro unassociateMarkTextJaExtension EXT
  ReadRegStr $0 HKCU "Software\Classes\${EXT}" ""
  StrCmp $0 "MarkTextJa.Document" 0 +2
    DeleteRegValue HKCU "Software\Classes\${EXT}" ""
!macroend

;======================================================================
; customInstall macro is invoked by electron-builder after files are in $INSTDIR
!macro customInstall
  ; Ask the user if they want to register file associations
  MessageBox MB_YESNO|MB_ICONQUESTION \
  "Do you want to associate Markdown files (.md, .markdown, .mmd, .mdown, .mdtext, .mdx) with MarkText-ja?" /SD IDNO IDNO SkipAssoc

  ;— User clicked YES, perform the registry writes —
  WriteRegStr HKCU "Software\Classes\.md"       "" "MarkTextJa.Document"
  WriteRegStr HKCU "Software\Classes\.markdown" "" "MarkTextJa.Document"
  WriteRegStr HKCU "Software\Classes\.mmd"      "" "MarkTextJa.Document"
  WriteRegStr HKCU "Software\Classes\.mdown"    "" "MarkTextJa.Document"
  WriteRegStr HKCU "Software\Classes\.mdtxt"    "" "MarkTextJa.Document"
  WriteRegStr HKCU "Software\Classes\.mdtext"   "" "MarkTextJa.Document"
  WriteRegStr HKCU "Software\Classes\.mdx"      "" "MarkTextJa.Document"

  WriteRegStr HKCU "Software\Classes\MarkTextJa.Document" \
    "" "MarkText-ja Markdown Document"
  WriteRegExpandStr HKCU "Software\Classes\MarkTextJa.Document\DefaultIcon" \
    "" "$INSTDIR\resources\icons\md.ico,0"
  WriteRegExpandStr HKCU "Software\Classes\MarkTextJa.Document\shell\open\command" \
    "" '"$INSTDIR\marktext-ja.exe" "%1"'

SkipAssoc:
!macroend

;======================================================================
; customUnInstall macro cleans up on uninstall
!macro customUnInstall
  ; Delete the open command subtree
  DeleteRegKey HKCU "Software\Classes\MarkTextJa.Document\shell\open\command"
  DeleteRegKey HKCU "Software\Classes\MarkTextJa.Document\shell\open"
  DeleteRegKey HKCU "Software\Classes\MarkTextJa.Document\shell"

  ; Delete the DefaultIcon and ProgID
  DeleteRegKey HKCU "Software\Classes\MarkTextJa.Document\DefaultIcon"
  DeleteRegKey HKCU "Software\Classes\MarkTextJa.Document"

  ; Delete only extension mappings that still point to MarkText-ja.
  !insertmacro unassociateMarkTextJaExtension ".md"
  !insertmacro unassociateMarkTextJaExtension ".markdown"
  !insertmacro unassociateMarkTextJaExtension ".mmd"
  !insertmacro unassociateMarkTextJaExtension ".mdown"
  !insertmacro unassociateMarkTextJaExtension ".mdtxt"
  !insertmacro unassociateMarkTextJaExtension ".mdtext"
  !insertmacro unassociateMarkTextJaExtension ".mdx"

  MessageBox MB_YESNO "Do you want to delete user settings?" /SD IDNO IDNO SkipRemoval
    SetShellVarContext current
    RMDir /r "$APPDATA\marktext-ja"
  SkipRemoval:
!macroend
