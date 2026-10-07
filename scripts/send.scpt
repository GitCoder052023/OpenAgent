on run argv
  set expectedNumber to item 1 of argv
  set theText to item 2 of argv
  if theText is "" then error "Empty message"

  tell application "System Events"
    if not (exists (first process whose bundle identifier is "net.whatsapp.WhatsApp" or name contains "WhatsApp")) then
      error "WhatsApp is not open"
    end if
    set waProc to (first process whose bundle identifier is "net.whatsapp.WhatsApp" or name contains "WhatsApp")
    set visible of waProc to true
    set frontmost of waProc to true
  end tell

  tell application "WhatsApp"
    reopen
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
              set focused of text area taCount of window 1 of waProc to true
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

    set oldClip to the clipboard
    set the clipboard to theText
    keystroke "v" using command down
    delay 0.15
    try
      set the clipboard to oldClip
    end try
    -- Keep send separate so the Python caller can re-check the chat after paste.
  end tell
end run

