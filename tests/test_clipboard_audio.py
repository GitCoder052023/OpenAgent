from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import pytest
from bridge.desktop import Desktop, _audio_preview_visible, _classify_paste_state


def cfg(**overrides):
    base = dict(number='+16508702892', safe_mode=True,
                header_path='/0/1', attach_label='Attach',
                document_label='Document', attachment_send_label='Send',
                send_route='auto')
    base.update(overrides)
    return SimpleNamespace(**base)


def test_preview_requires_filename_and_preview_control():
    rows = [{'role':'AXButton','description':'Cancel','title':''},
            {'role':'AXStaticText','description':'','title':'clip.m4a'}]
    assert _audio_preview_visible(rows, 'clip.m4a')
    assert not _audio_preview_visible(rows, 'other.m4a')
    assert not _audio_preview_visible(rows[1:], 'clip.m4a')


def test_classify_detects_composer_pollution_not_preview():
    rows = [{'role':'AXTextArea','description':'Compose message','title':'',
             'value':'/var/folders/x/clip.m4a'}]
    state = _classify_paste_state(rows, 'clip.m4a')
    assert state['composer_polluted']
    assert not state['preview']


def test_classify_ignores_filename_in_message_list_without_preview():
    rows = [{'role':'AXStaticText','description':'','title':'clip.m4a'},
            {'role':'AXTextArea','description':'Compose message','title':'','value':''}]
    state = _classify_paste_state(rows, 'clip.m4a')
    assert state['filename_seen']
    assert not state['preview']
    assert not state['composer_polluted']


def test_fallback_when_paste_safe_to_retry(tmp_path):
    path = tmp_path / 'clip.m4a'
    path.write_bytes(b'x' * 1001)
    d = Desktop(cfg())
    with patch('bridge.desktop.ensure_whatsapp_ready'), patch.object(d, 'assert_locked'), \
         patch('bridge.desktop.activate_whatsapp'), patch('bridge.desktop.hide_whatsapp'), \
         patch('bridge.desktop.time.sleep'), patch.object(d, '_paste_audio', return_value='picker'), \
         patch.object(d, '_send_audio_picker') as picker:
        d.send_audio(path)
        picker.assert_called_once_with(path)
    d2 = Desktop(cfg())
    with patch('bridge.desktop.ensure_whatsapp_ready'), patch.object(d2, 'assert_locked'), \
         patch('bridge.desktop.activate_whatsapp'), patch('bridge.desktop.hide_whatsapp'), \
         patch('bridge.desktop.time.sleep'), patch.object(d2, '_paste_audio', side_effect=RuntimeError('unknown')), \
         patch.object(d2, '_send_audio_picker') as picker:
        with pytest.raises(RuntimeError, match='unknown'):
            d2.send_audio(path)
        picker.assert_not_called()


def test_confirmed_paste_send_skips_picker(tmp_path):
    path = tmp_path / 'clip.m4a'
    path.write_bytes(b'x' * 1001)
    d = Desktop(cfg())
    with patch('bridge.desktop.ensure_whatsapp_ready'), patch.object(d, 'assert_locked'), \
         patch('bridge.desktop.activate_whatsapp'), patch('bridge.desktop.hide_whatsapp'), \
         patch('bridge.desktop.time.sleep'), patch.object(d, '_paste_audio', return_value=True), \
         patch.object(d, '_send_audio_picker') as picker:
        d.send_audio(path)
        picker.assert_not_called()


def test_picker_route_config_skips_clipboard(tmp_path):
    path = tmp_path / 'clip.m4a'
    path.write_bytes(b'x' * 1001)
    d = Desktop(cfg(send_route='picker'))
    with patch('bridge.desktop.ensure_whatsapp_ready'), patch.object(d, 'assert_locked'), \
         patch('bridge.desktop.activate_whatsapp'), patch('bridge.desktop.hide_whatsapp'), \
         patch('bridge.desktop.time.sleep'), patch.object(d, '_paste_audio') as paste, \
         patch.object(d, '_send_audio_picker') as picker:
        d.send_audio(path)
        paste.assert_not_called()
        picker.assert_called_once_with(path)


def test_clipboard_only_route_forbids_picker_fallback(tmp_path):
    path = tmp_path / 'clip.m4a'
    path.write_bytes(b'x' * 1001)
    d = Desktop(cfg(send_route='clipboard'))
    with patch('bridge.desktop.ensure_whatsapp_ready'), patch.object(d, 'assert_locked'), \
         patch('bridge.desktop.activate_whatsapp'), patch('bridge.desktop.hide_whatsapp'), \
         patch('bridge.desktop.time.sleep'), patch.object(d, '_paste_audio', return_value='picker'), \
         patch.object(d, '_send_audio_picker') as picker:
        with pytest.raises(RuntimeError, match='forbids the picker fallback'):
            d.send_audio(path)
        picker.assert_not_called()


def test_session_memory_skips_clipboard_after_unsupported(tmp_path):
    path = tmp_path / 'clip.m4a'
    path.write_bytes(b'x' * 1001)
    d = Desktop(cfg())
    with patch('bridge.desktop.ensure_whatsapp_ready'), patch.object(d, 'assert_locked'), \
         patch('bridge.desktop.activate_whatsapp'), patch('bridge.desktop.hide_whatsapp'), \
         patch('bridge.desktop.time.sleep'), patch.object(d, '_paste_audio', return_value='picker') as paste, \
         patch.object(d, '_send_audio_picker'):
        d.send_audio(path)
        d.send_audio(path)
        assert paste.call_count == 1
