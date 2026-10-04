on run argv
  set expectedNumber to item 1 of argv
  set theText to item 2 of argv
  if theText is "" then error "Empty message"
  tell application "WhatsApp" to activate
  delay 0.15
  tell application "System Events"
    if not (exists process "WhatsApp") then error "WhatsApp is not open"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      -- Do not navigate by contact name. Operator must manually open and lock the exact chat.
      set frontmost to true
      set taCount to (count of text areas of window 1)
      if taCount > 0 then
        set focused of text area taCount of window 1 to true
      end if
    end tell
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
