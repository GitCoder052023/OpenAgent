"""Regression checks for WhatsApp's empty clipboard-paste path."""
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import pytest

from bridge.desktop import Desktop


def cfg():
    return SimpleNamespace(number='+16508702892', safe_mode=True,
                           header_path='', attach_label='Attach',
                           document_label='Document', attachment_send_label='Send',
                           send_route='auto')


def test_empty_paste_goes_directly_to_picker_without_menu_retry(tmp_path):
    path = tmp_path / 'clip.m4a'
    path.write_bytes(b'x' * 1001)
    desktop = Desktop(cfg())
    state = dict(caption=False, cancel=False, filename_seen=False,
                 composer_polluted=False, composer_chars=0)
    with patch.object(desktop, '_stage_clipboard', return_value=True), \
         patch.object(desktop, 'assert_locked'), \
         patch('bridge.desktop.focus_composer', return_value=True), \
         patch.object(desktop, '_keystroke_paste'), \
         patch.object(desktop, '_menu_paste') as menu, \
         patch.object(desktop, '_await_preview', return_value=('empty', state)):
        assert desktop._paste_audio(path) == 'picker'
        menu.assert_not_called()


def test_empty_paste_picker_failure_is_logged_and_raised(tmp_path):
    path = tmp_path / 'clip.m4a'
    path.write_bytes(b'x' * 1001)
    desktop = Desktop(cfg())
    with patch('bridge.desktop.ensure_whatsapp_ready'), \
         patch('bridge.desktop.activate_whatsapp'), \
         patch('bridge.desktop.time.sleep'), \
         patch.object(desktop, 'assert_locked'), \
         patch.object(desktop, '_paste_audio', return_value='picker'), \
         patch.object(desktop, '_send_audio_picker', side_effect=RuntimeError('picker blocked')), \
         patch('bridge.desktop.event') as log:
        with pytest.raises(RuntimeError, match='picker blocked'):
            desktop.send_audio(path)
        assert any(call.args[0] == 'picker_failed' for call in log.call_args_list)
