-- Send exactly one staged attachment by its calibrated preview button label or Enter key.
on run argv
  set sendLabel to item 1 of argv
  if sendLabel is "" then set sendLabel to "Send"
  tell application "WhatsApp" to activate
  tell application "System Events"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      set matches to (every button of window 1 whose description contains sendLabel or name contains sendLabel)
      if (count of matches) > 0 then
        click item 1 of matches
      else
        key code 36
      end if
    end tell
  end tell
end run
