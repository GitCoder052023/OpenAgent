-- Prepare a file attachment in the already-selected WhatsApp chat. No send here.
-- The file chooser must already be opening (the Python caller clicked Attach > Document,
-- or the build opened the chooser directly). This script never clicks Attach/Document
-- itself: a second click can toggle the popover closed. Fail closed on any mismatch.
-- Second arg "loose": skip the sheet-exists check (chooser verified via AX as a
-- separate window instead of a sheet); used only as a caller-gated retry.
on run argv
  set audioPath to item 1 of argv
  set loose to false
  if (count of argv) > 1 and item 2 of argv is "loose" then set loose to true
  if audioPath is "" then error "No audio path provided"
  tell application "WhatsApp" to activate
  tell application "System Events"
    if not (exists process "WhatsApp") then error "WhatsApp is not open"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      set frontmost to true
    end tell
    if loose then
      delay 0.8
    else
      -- Wait briefly for the file chooser sheet; never try to re-open it here.
      set waited to 0.0
      repeat while waited < 5.0
        if (exists sheet 1 of window 1 of process "WhatsApp") then exit repeat
        delay 0.5
        set waited to waited + 0.5
      end repeat
      if not (exists sheet 1 of window 1 of process "WhatsApp") then error "File chooser missing; no attachment"
    end if
    keystroke "g" using {command down, shift down}
    delay 0.3
    keystroke audioPath
    key code 36
    delay 0.3
    key code 36
  end tell
end run
