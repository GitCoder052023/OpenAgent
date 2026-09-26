-- Prepare a file attachment in the already-selected WhatsApp chat. No send here.
-- UI labels differ across WhatsApp versions; fail closed on any mismatch.
on run argv
  set audioPath to item 1 of argv
  set attachLabel to item 2 of argv
  set documentLabel to item 3 of argv
  if audioPath is "" or attachLabel is "" or documentLabel is "" then error "Attachment controls not calibrated"
  tell application "WhatsApp" to activate
  tell application "System Events"
    if not (exists process "WhatsApp") then error "WhatsApp is not open"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      set frontmost to true
      set matches to (every button of window 1 whose description contains attachLabel or name contains attachLabel)
      if (count of matches) is 0 then
        set matches to (every button of group 1 of window 1 whose description contains attachLabel)
      end if
      if (count of matches) is not 1 then error "Attachment button missing/ambiguous"
      click item 1 of matches
      delay 0.3
      set popovers to (every UI element of window 1 whose role is "AXPopover")
      if (count of popovers) > 0 then
        set pop to item 1 of popovers
        set choices to (every button of pop whose description contains documentLabel or name contains documentLabel)
        if (count of choices) is 0 then
          set choices to (every button of group 1 of pop whose description contains documentLabel or name contains documentLabel)
        end if
        if (count of choices) is 0 then error "Document button in popover missing"
        click item 1 of choices
      else if (exists menu 1 of window 1) then
        set choices to (every menu item of menu 1 of window 1 whose name contains documentLabel)
        if (count of choices) is not 1 then error "Document menu item missing/ambiguous"
        click item 1 of choices
      else
        error "Neither popover nor menu found after clicking attach"
      end if
    end tell
    delay 0.3
    if not (exists sheet 1 of window 1 of process "WhatsApp") then error "File chooser missing; no attachment"
    keystroke "g" using {command down, shift down}
    delay 0.3
    keystroke audioPath
    key code 36
    delay 0.3
    key code 36
  end tell
end run
