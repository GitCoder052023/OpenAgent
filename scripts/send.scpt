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
      set textFieldCount to count of text areas of window 1
      if textFieldCount is not 1 then error "Expected one message text area; found " & textFieldCount
      set focused of text area 1 of window 1 to true
    end tell
    set the clipboard to theText
    keystroke "v" using command down
    delay 0.15
    -- Keep send separate so the Python caller can re-check the chat after paste.
  end tell
end run
