tell application "WhatsApp" to activate
tell application "System Events"
  tell process "WhatsApp"
    set frontmost to true
    set taCount to (count of text areas of window 1)
    if taCount > 0 then
      set focused of text area taCount of window 1 to true
    end if
  end tell
  keystroke "v" using command down
end tell
