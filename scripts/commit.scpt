on run argv
  tell application "WhatsApp" to activate
  tell application "System Events"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      if not (focused of text area 1 of window 1) then error "Composer not focused; no send"
    end tell
    key code 36
  end tell
end run
