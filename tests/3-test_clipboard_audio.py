from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import pytest
from bridge.desktop import Desktop, _audio_preview_visible


def cfg():
    return SimpleNamespace(number='+16508702892', safe_mode=True,
                           header_path='/0/1', attach_label='Attach',
                           document_label='Document', attachment_send_label='Send')


def test_preview_requires_filename_and_preview_control():
    rows = [{'role':'AXButton','description':'Cancel','title':''},
            {'role':'AXStaticText','description':'','title':'clip.m4a'}]
    assert _audio_preview_visible(rows, 'clip.m4a')
    assert not _audio_preview_visible(rows, 'other.m4a')
    assert not _audio_preview_visible(rows[1:], 'clip.m4a')


def test_fallback_only_before_paste(tmp_path):
    path = tmp_path / 'clip.m4a'
    path.write_bytes(b'x' * 1001)
    d = Desktop(cfg())
    with patch('bridge.desktop.ensure_whatsapp_ready'), patch.object(d, 'assert_locked'), \
         patch('bridge.desktop.activate_whatsapp'), patch('bridge.desktop.hide_whatsapp'), \
         patch('bridge.desktop.time.sleep'), patch.object(d, '_paste_audio', return_value=False), \
         patch.object(d, '_send_audio_picker') as picker:
        d.send_audio(path)
        picker.assert_called_once_with(path)
    with patch('bridge.desktop.ensure_whatsapp_ready'), patch.object(d, 'assert_locked'), \
         patch('bridge.desktop.activate_whatsapp'), patch('bridge.desktop.hide_whatsapp'), \
         patch('bridge.desktop.time.sleep'), patch.object(d, '_paste_audio', side_effect=RuntimeError('unknown')), \
         patch.object(d, '_send_audio_picker') as picker:
        with pytest.raises(RuntimeError, match='unknown'):
            d.send_audio(path)
        picker.assert_not_called()
