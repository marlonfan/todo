; Add Simplified Chinese language support to the MyGo NSIS installer wizard so
; Chinese Windows systems display the directory chooser, install progress,
; desktop shortcut checkbox, finish page, and uninstaller in Simplified Chinese.
!insertmacro MUI_LANGUAGE "SimpChinese"
LangString MYGO_DESKTOP_SHORTCUT ${LANG_SIMPCHINESE} "创建桌面快捷方式"
