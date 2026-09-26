-- Prepare a file attachment in the already-selected WhatsApp chat. No send here.
-- UI labels differ across WhatsApp versions; fail closed on any mismatch.
on run argv
  set audioPath to item 1 of argv
  set attachLabel to item 2 of argv
  set documentLabel to item 3 of argv
  if audioPath is "" then error "No audio path provided"
  tell application "WhatsApp" to activate
  tell application "System Events"
    if not (exists process "WhatsApp") then error "WhatsApp is not open"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      set frontmost to true
      -- If sheet is not open yet, try to click buttons as fallback
      if not (exists sheet 1 of window 1) then
        set matches to (every button of window 1 whose description contains attachLabel or name contains attachLabel)
        if (count of matches) is 0 then
          set matches to (every button of group 1 of window 1 whose description contains attachLabel)
        end if
        if (count of matches) is 1 then
          click item 1 of matches
          delay 0.3
          set popovers to (every UI element of window 1 whose role is "AXPopover")
          if (count of popovers) > 0 then
            set pop to item 1 of popovers
            set choices to (every button of pop whose description contains documentLabel or name contains documentLabel)
            if (count of choices) > 0 then click item 1 of choices
          end if
        end if
      end if
    end tell
    delay 0.4
    if not (exists sheet 1 of window 1 of process "WhatsApp") then error "File chooser missing; no attachment"
    keystroke "g" using {command down, shift down}
    delay 0.3
    keystroke audioPath
    key code 36
    delay 0.3
    key code 36
  end tell
end run
