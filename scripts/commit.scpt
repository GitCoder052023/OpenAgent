on run argv
  tell application "WhatsApp" to activate
  tell application "System Events"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      if (count of text areas of window 1) is 1 then
        if not (focused of text area 1 of window 1) then error "Composer not focused; no send"
      end if
    end tell
    key code 36
  end tell
end run
