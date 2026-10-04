on run argv
  tell application "WhatsApp" to activate
  tell application "System Events"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      set taCount to (count of text areas of window 1)
      if taCount > 0 then
        if not (focused of text area taCount of window 1) then
          set focused of text area taCount of window 1 to true
        end if
      end if
    end tell
    key code 36
  end tell
end run
