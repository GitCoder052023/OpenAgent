-- Send exactly one staged attachment by its calibrated preview button label.
on run argv
  set sendLabel to item 1 of argv
  if sendLabel is "" then error "Attachment send button not calibrated"
  tell application "WhatsApp" to activate
  tell application "System Events"
    tell process "WhatsApp"
      if not (exists window 1) then error "No WhatsApp window"
      set matches to (every button of window 1 whose description is sendLabel or name is sendLabel)
      if (count of matches) is not 1 then error "Attachment send button missing/ambiguous; no send"
      click item 1 of matches
    end tell
  end tell
end run
