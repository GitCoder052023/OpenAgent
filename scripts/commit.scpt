on run argv
  tell application "System Events"
    if not (exists (first process whose bundle identifier is "net.whatsapp.WhatsApp" or name contains "WhatsApp")) then
      error "WhatsApp is not open"
    end if
    set waProc to (first process whose bundle identifier is "net.whatsapp.WhatsApp" or name contains "WhatsApp")
    set visible of waProc to true
    set frontmost of waProc to true
  end tell

  tell application "WhatsApp"
    activate
  end tell

  set windowReady to false
  tell application "System Events"
    set waProc to (first process whose bundle identifier is "net.whatsapp.WhatsApp" or name contains "WhatsApp")
    set frontmost of waProc to true
    repeat with attempt from 1 to 20
      try
        if exists window 1 of waProc then
          try
            set taCount to (count of text areas of window 1 of waProc)
            if taCount > 0 then
              if not (focused of text area taCount of window 1 of waProc) then
                set focused of text area taCount of window 1 of waProc to true
              end if
            end if
          end try
          set windowReady to true
          exit repeat
        end if
      end try
      delay 0.1
    end repeat

    if not windowReady then
      error "No WhatsApp window"
    end if

    key code 36
  end tell
end run

